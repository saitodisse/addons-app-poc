import { createServer } from 'node:http';
import { validateManifest as validateProtocolManifest } from '@addons-poc/protocol';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const CONTENT_TYPES = {
  json: 'application/json',
  txt: 'text/plain; charset=utf-8',
};

function json(res, body) {
  res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': CONTENT_TYPES.json });
  res.end(JSON.stringify(body));
}

function plain(res, body) {
  res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': CONTENT_TYPES.txt });
  res.end(body);
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
 * }} options.handlers Handlers dos resources.
 * @param {string} [options.name] Nome para logs.
 * @returns {Promise<{ url: string, manifestUrl: string, close(): Promise<void> }>}
 */
export async function createAddonServer(options) {
  const { manifest, port, handlers, name } = options;

  const validation = validateProtocolManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Manifest inválido: ${validation.errors.join(', ')}`);
  }

  const server = createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const url = requestUrl.pathname;

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    try {
      // Manifesto
      if (url === '/manifest.json') {
        json(res, manifest);
        return;
      }

      // /catalog/<type>/<catalogId>.json
      let match = url.match(/^\/catalog\/([^/]+)\/([^/]+)\.json$/);
      if (match) {
        const [, type, catalogId] = match;
        json(res, await handlers.catalog(decodeURIComponent(type), decodeURIComponent(catalogId), pageRequest(requestUrl.searchParams)));
        return;
      }

      // /search/<type>/<query>.json
      match = url.match(/^\/search\/([^/]+)\/([^/]+)\.json$/);
      if (match) {
        const [, type, query] = match;
        json(res, await handlers.search(decodeURIComponent(type), decodeURIComponent(query), pageRequest(requestUrl.searchParams)));
        return;
      }

      // /text/<type>/<id>/content.txt
      match = url.match(/^\/text\/([^/]+)\/([^/]+)\/content\.txt$/);
      if (match) {
        const [, type, id] = match;
        plain(res, await handlers.content(decodeURIComponent(type), decodeURIComponent(id)));
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
          if (typeof t.url === 'string' && t.url.startsWith('/')) {
            t.url = `${base}${t.url}`;
          }
          return t;
        });
        json(res, { texts });
        return;
      }

      res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'text/plain' });
      res.end('Add-on: rota não encontrada');
    } catch (error) {
      res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'text/plain' });
      res.end(`Erro interno: ${error.message}`);
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
