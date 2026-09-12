import { createServer } from 'node:http';
import { validateManifest as validateProtocolManifest } from '@addons-poc/protocol';
export { createTrafficRecorder } from './traffic.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CONTENT_TYPES = {
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
};

const DEBUG_TRAFFIC_PATH = '/debug/traffic.json';
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'x-client-ip',
  'x-forwarded-for',
  'x-real-ip',
  'forwarded',
  'cf-connecting-ip',
  'true-client-ip',
]);

function headersToObject(headers) {
  return Object.fromEntries(
    Object.entries(headers ?? {}).map(([name, value]) => [
      name,
      SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[redacted]' : Array.isArray(value) ? value.join(', ') : String(value ?? ''),
    ]),
  );
}

function pageRequest(searchParams) {
  const rawLimit = searchParams.get('limit');
  const cursor = searchParams.get('cursor') ?? undefined;
  if (rawLimit === null && cursor === undefined) return undefined;

  let limit;
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Parâmetro limit inválido');
  }
  return { ...(limit === undefined ? {} : { limit }), ...(cursor === undefined ? {} : { cursor }) };
}

/**
 * Monta um servidor HTTP para um add-on de texto estilo Stremio.
 *
 * Rotas servidas:
 *   GET /manifest.json                     → manifesto validado
 *   GET /catalog/<type>/<catalogId>.json   → { metas: [...], pagination? }
 *   GET /search/<type>/<query>.json        → { metas: [...], pagination? }
 *   GET /text/<type>/<id>.json             → { texts: [{ id, url, lang, name }] }
 *   GET /text/<type>/<id>/content.txt      → conteúdo em texto puro
 *   GET /text/<type>/<id>/content.json     → conteúdo estruturado e metadados
 *   GET /debug/traffic.json                → histórico local de requisições e respostas
 *
 * A identidade do add-on é a URL do manifesto (mesma regra do Stremio).
 *
 * @param {object} options
 * @param {Record<string, unknown>} options.manifest Manifesto estilo Stremio.
 * @param {number} options.port Porta HTTP.
 * @param {{
 *   catalog(type: string, catalogId: string, page?: { limit?: number, cursor?: string }): Promise<{ metas: unknown[], pagination?: { limit: number, total?: number, next?: string } }>,
 *   search(type: string, query: string, page?: { limit?: number, cursor?: string }): Promise<{ metas: unknown[], pagination?: { limit: number, total?: number, next?: string } }>,
 *   text(type: string, id: string): Promise<{ texts: unknown[] }>,
 *   content(type: string, id: string): Promise<string>,
 *   contentJson?(type: string, id: string): Promise<unknown | { body: unknown, headers?: Record<string, string> }>,
 *   debugTraffic?(): unknown | Promise<unknown>,
 * }} options.handlers Handlers dos resources.
 * @param {string} [options.name] Nome para logs.
 * @param {(event: Record<string, unknown>) => void} [options.onTraffic] Observador local de tráfego.
 * @returns {Promise<{ url: string, manifestUrl: string, close(): Promise<void> }>}
 */
export async function createAddonServer(options) {
  const { manifest, port, handlers, name, onTraffic } = options;

  const validation = validateProtocolManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Manifest inválido: ${validation.errors.join(', ')}`);
  }

  let requestSequence = 0;
  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const url = requestUrl.pathname;
    const requestId = `${name ?? manifest.id}-http-${++requestSequence}`;
    const observed = url !== DEBUG_TRAFFIC_PATH;
    const startedAt = Date.now();

    const record = (event) => {
      if (!observed) return;
      try {
        onTraffic?.({
          source: name ?? manifest.id,
          requestId,
          method: req.method,
          url: requestUrl.href,
          path: url,
          ...event,
        });
      } catch (error) {
        console.error(`[${name ?? manifest.id}] não foi possível registrar tráfego`, error);
      }
    };

    const requestBody = {
      method: req.method,
      url: requestUrl.href,
      path: url,
      queryString: requestUrl.search,
      query: Object.fromEntries(requestUrl.searchParams.entries()),
      headers: headersToObject(req.headers),
      body: null,
    };
    record({ direction: 'incoming', phase: 'request', request: requestBody });

    const respond = (status, body, contentType, extraHeaders = {}) => {
      const bodyText = typeof body === 'string' ? body : JSON.stringify(body) ?? '';
      const customHeaders = Object.fromEntries(
        Object.entries(extraHeaders ?? {})
          .filter(([, value]) => value != null)
          .map(([name, value]) => [name, String(value)]),
      );
      const headers = {
        ...CORS_HEADERS,
        ...customHeaders,
        'Content-Type': contentType,
        'Content-Length': String(Buffer.byteLength(bodyText, 'utf8')),
      };
      res.writeHead(status, headers);
      res.end(status === 204 ? undefined : bodyText);
      record({
        direction: 'outgoing',
        phase: 'response',
        status,
        ok: status >= 200 && status < 300,
        headers,
        response: { status, ok: status >= 200 && status < 300, headers, body, bodyText },
        durationMs: Date.now() - startedAt,
      });
    };

    const respondJson = (body, status = 200, extraHeaders = {}) => respond(status, body, CONTENT_TYPES.json, extraHeaders);
    const respondText = (body, status = 200, extraHeaders = {}) => respond(status, body, CONTENT_TYPES.txt, extraHeaders);

    if (req.method === 'OPTIONS') {
      respond(204, '', 'text/plain; charset=utf-8');
      return;
    }

    try {
      // Manifesto
      if (url === '/manifest.json') {
        respondJson(manifest);
        return;
      }

      // Histórico local para o terminal de observabilidade do host.
      if (url === DEBUG_TRAFFIC_PATH) {
        if (typeof handlers.debugTraffic !== 'function') {
          respondText('Add-on: observabilidade não habilitada', 404);
          return;
        }
        respondJson(await handlers.debugTraffic());
        return;
      }

      // /catalog/<type>/<catalogId>.json
      let match = url.match(/^\/catalog\/([^/]+)\/([^/]+)\.json$/);
      if (match) {
        const [, type, catalogId] = match;
        respondJson(await handlers.catalog(decodeURIComponent(type), decodeURIComponent(catalogId), pageRequest(requestUrl.searchParams)));
        return;
      }

      // /search/<type>/<query>.json
      match = url.match(/^\/search\/([^/]+)\/([^/]+)\.json$/);
      if (match) {
        const [, type, query] = match;
        respondJson(await handlers.search(decodeURIComponent(type), decodeURIComponent(query), pageRequest(requestUrl.searchParams)));
        return;
      }

      // /text/<type>/<id>/content.txt
      match = url.match(/^\/text\/([^/]+)\/([^/]+)\/content\.txt$/);
      if (match) {
        const [, type, id] = match;
        respondText(await handlers.content(decodeURIComponent(type), decodeURIComponent(id)));
        return;
      }

      // /text/<type>/<id>/content.json
      match = url.match(/^\/text\/([^/]+)\/([^/]+)\/content\.json$/);
      if (match) {
        const [, type, id] = match;
        if (typeof handlers.contentJson !== 'function') {
          respondJson({ error: 'NOT_IMPLEMENTED', message: 'Este add-on não publica conteúdo estruturado.' }, 404);
          return;
        }
        const result = await handlers.contentJson(decodeURIComponent(type), decodeURIComponent(id));
        if (result && typeof result === 'object' && Object.prototype.hasOwnProperty.call(result, 'body')) {
          respondJson(result.body, 200, result.headers);
        } else {
          respondJson(result);
        }
        return;
      }

      // /text/<type>/<id>.json
      match = url.match(/^\/text\/([^/]+)\/([^/]+)\.json$/);
      if (match) {
        const [, type, id] = match;
        const payload = await handlers.text(decodeURIComponent(type), decodeURIComponent(id));
        // URLs relativas de conteúdo viram URLs absolutas deste servidor
        // (mesmo comportamento do Stremio com os arquivos de legenda).
        const texts = (payload.texts ?? []).map((item) => {
          const t = item;
          for (const field of ['url', 'contentJsonUrl']) {
            if (typeof t[field] === 'string' && t[field].startsWith('/')) {
              t[field] = `${base}${t[field]}`;
            }
          }
          return t;
        });
        respondJson({ texts });
        return;
      }

      respondText('Add-on: rota não encontrada', 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
        ? error.status
        : 500;
      if (status === 404 && url.endsWith('.json')) {
        respondJson({ error: error?.code ?? 'NOT_FOUND', message, status }, status);
      } else {
        respondText(status === 404 ? message : `Erro interno: ${message}`, status);
      }
    }
  });

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, () => {
      server.removeListener('error', rejectListen);
      resolveListen();
    });
  });

  // Porta efetiva (importante quando port = 0, o Node escolhe uma livre).
  const address = server.address();
  const effectivePort = typeof address === 'object' && address ? address.port : port;
  const base = `http://localhost:${effectivePort}`;

  return {
    url: base,
    manifestUrl: `${base}/manifest.json`,
    close: () =>
      new Promise((done) => {
        server.close(() => done());
      }),
  };
}
