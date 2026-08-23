import { createServer } from 'node:http';

const VALID_RESOURCE_NAMES = ['catalog', 'search', 'text', 'meta', 'subtitles', 'stream'];

/**
 * Validación mínima del manifiesto (estilo Stremio) para servidores add-ons.
 * La versión canónica vive en `@addons/core` (validateManifest); esta copia en
 * JS puro mantiene al add- on desplegado autónomo, sin arrastrar el runtime TS.
 */
function validateManifest(data) {
  const errors = [];
  const required = ['id', 'version', 'name', 'description', 'author', 'license', 'tab'];
  for (const field of required) {
    if (data[field] == null || data[field] === '') {
      errors.push(`Campo '${field}' es obligatorio`);
    }
  }
  if (!data.tab || typeof data.tab !== 'object' || !data.tab.title || !data.tab.body) {
    errors.push('tab debe declarar title y body');
  }
  const hasResources = Array.isArray(data.resources) && data.resources.length > 0;
  const hasServices = Array.isArray(data.services) && data.services.length > 0;
  if (!hasResources && !hasServices) {
    errors.push('Manifiesto debe declarar services (en-proceso) o resources (HTTP/Stremio)');
  }
  if (hasResources) {
    for (let i = 0; i < data.resources.length; i++) {
      const res = data.resources[i];
      if (typeof res.name !== 'string' || !VALID_RESOURCE_NAMES.includes(res.name)) {
        errors.push(`resources[${i}].name debe ser uno de: ${VALID_RESOURCE_NAMES.join(', ')}`);
      }
      if (!Array.isArray(res.types) || res.types.length === 0) {
        errors.push(`resources[${i}].types debe ser un array no vacío`);
      }
    }
  }
  const interactions = data.interactions;
  if (!interactions || typeof interactions !== 'object' || Array.isArray(interactions)) {
    errors.push('interactions es obligatorio y debe ser un objeto');
  } else {
    if (interactions.version !== '1.0.0') errors.push('interactions.version debe ser 1.0.0');
    if (!Array.isArray(interactions.services) || !interactions.tab || !Array.isArray(interactions.tab.fields) || !Array.isArray(interactions.tab.actions) || !Array.isArray(interactions.state) || !Array.isArray(interactions.http) || !Array.isArray(interactions.logs)) {
      errors.push('interactions debe declarar services, tab, state, http y logs');
    }
  }
  return { valid: errors.length === 0, errors };
}

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

/**
 * Monta um servidor HTTP para um add-on de texto estilo Stremio.
 *
 * Rotas servidas:
 *   GET /manifest.json                     → manifesto validado
 *   GET /catalog/<type>/<catalogId>.json   → { metas: [...] }
 *   GET /search/<type>/<query>.json        → { metas: [...] }
 *   GET /text/<type>/<id>.json             → { texts: [{ id, url, lang, name }] }
 *   GET /text/<type>/<id>/content.txt      → conteúdo em texto puro
 *
 * A identidade do add-on é a URL do manifesto (mesma regra do Stremio).
 *
 * @param {object} options
 * @param {Record<string, unknown>} options.manifest Manifesto estilo Stremio.
 * @param {number} options.port Porta HTTP.
 * @param {{
 *   catalog(type: string, catalogId: string): Promise<{ metas: unknown[] }>,
 *   search(type: string, query: string): Promise<{ metas: unknown[] }>,
 *   text(type: string, id: string): Promise<{ texts: unknown[] }>,
 *   content(type: string, id: string): Promise<string>,
 * }} options.handlers Handlers dos resources.
 * @param {string} [options.name] Nome para logs.
 * @returns {Promise<{ url: string, manifestUrl: string, close(): Promise<void> }>}
 */
export async function createAddonServer(options) {
  const { manifest, port, handlers, name } = options;

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new Error(`Manifest inválido: ${validation.errors.join(', ')}`);
  }

  const server = createServer(async (req, res) => {    const url = (req.url ?? '/').split('?')[0] ?? '/';

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
        json(res, await handlers.catalog(decodeURIComponent(type), decodeURIComponent(catalogId)));
        return;
      }

      // /search/<type>/<query>.json
      match = url.match(/^\/search\/([^/]+)\/([^/]+)\.json$/);
      if (match) {
        const [, type, query] = match;
        json(res, await handlers.search(decodeURIComponent(type), decodeURIComponent(query)));
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
