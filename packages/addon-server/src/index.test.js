import { afterEach, describe, expect, it } from 'vitest';
import { defineAddonManifest } from '@addons-poc/protocol';
import { createAddonServer } from './index.js';

const manifest = defineAddonManifest({
  id: 'text-test',
  version: '1.0.0',
  name: 'Text Test',
  description: 'Test server',
  author: 'AC Team',
  license: 'MIT',
  ui: { title: 'Test', body: 'A test tab.' },
  resources: [
    { name: 'catalog', types: ['text'] },
    { name: 'search', types: ['text'] },
    { name: 'text', types: ['text'] },
  ],
  types: ['text'],
  catalogs: [{ type: 'text', id: 'classics', name: 'Classics' }],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming', method: 'GET', path: '/catalog/{type}/{catalogId}.json', purpose: 'Returns a catalog.', resource: 'catalog', returns: { description: 'Catalog.', schema: { type: 'object', description: 'Catalog.', classification: 'public' } } },
      { id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Searches a catalog.', resource: 'search', returns: { description: 'Search.', schema: { type: 'object', description: 'Search.', classification: 'public' } } },
      { id: 'text', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}.json', purpose: 'Returns text.', resource: 'text', returns: { description: 'Text.', schema: { type: 'object', description: 'Text.', classification: 'public' } } },
      { id: 'content-json', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}/content.json', purpose: 'Returns structured content.', receives: { description: 'Article.', schema: { type: 'object', description: 'Parameters.', classification: 'personal' } }, returns: { description: 'Structured content.', schema: { type: 'object', description: 'Content.', classification: 'public' } } },
      { id: 'debug-traffic', direction: 'incoming', method: 'GET', path: '/debug/traffic.json', purpose: 'Inspects traffic.', returns: { description: 'History.', schema: { type: 'object', description: 'History.', classification: 'public' } } },
    ],
    logs: [],
  },
});

const searchPages = [];
const handlers = {
  catalog: async (type, catalogId) => ({
      metas: [{ id: '1', type, name: `Item from ${catalogId}` }],
  }),
  search: async (type, query, page) => {
    searchPages.push(page);
    return {
    metas: [{ id: '2', type, name: `Result for ${query}` }],
      ...(page ? { pagination: { limit: page.limit ?? 10, next: 'next' } } : {}),
    };
  },
  text: async (type, id) => ({
    texts: [
      { id, url: `/text/${type}/${id}/content.txt`, contentJsonUrl: `/text/${type}/${id}/content.json`, lang: 'pt', name: 'Text' },
      { id: 'rel', url: '/text/text/rel/content.txt', lang: 'en', name: 'Relative' },
    ],
  }),
  content: async (_type, id) => `Text content ${id}`,
  contentJson: async (_type, id) => ({
    body: { id, content: { text: `Text content ${id}` } },
    headers: {
      ETag: 'W/"test-revision"',
      'Last-Modified': 'Mon, 01 Jan 2024 00:00:00 GMT',
      'Content-Language': 'pt',
    },
  }),
};

let servers = [];

async function startServer(port = 0, options = {}) {
  const server = await createAddonServer({ manifest, port, handlers, name: 'test', ...options });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()));
  servers = [];
});

describe('createAddonServer (estilo Stremio)', () => {
  it('serves the manifest at /manifest.json', async () => {
    const server = await startServer();
    const res = await fetch(server.manifestUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('text-test');
    expect(body.contract.resources[0].name).toBe('catalog');
  });

  it('serves /catalog/<type>/<id>.json', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/catalog/text/classics.json`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metas[0].name).toBe('Item from classics');
  });

  it('serves /search/<type>/<query>.json', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/search/text/amor.json?limit=20&cursor=page-2`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metas[0].name).toBe('Result for amor');
    expect(body.pagination).toEqual({ limit: 20, next: 'next' });
    expect(searchPages.at(-1)).toEqual({ limit: 20, cursor: 'page-2' });
  });

  it('passes the query language to paginated and content handlers', async () => {
    const received = {};
    const server = await startServer(0, {
      handlers: {
        ...handlers,
        search: async (type, query, page) => {
          received.search = page;
          return { metas: [{ id: '2', type, name: `Result for ${query}` }] };
        },
        content: async (type, id, options) => {
          received.content = options;
          return `Content ${type}/${id}`;
        },
      },
    });

    await fetch(`${server.url}/search/text/amor.json?lang=en`);
    await fetch(`${server.url}/text/text/1/content.txt?lang=en`);

    expect(received.search).toEqual({ lang: 'en' });
    expect(received.content).toEqual({ lang: 'en' });
  });

  it('serves /text/<type>/<id>.json with absolute content URLs', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/text/text/1.json`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.texts[0].url).toBe(`${server.url}/text/text/1/content.txt`);
    expect(body.texts[0].contentJsonUrl).toBe(`${server.url}/text/text/1/content.json`);
    expect(body.texts[1].url).toBe(`${server.url}/text/text/rel/content.txt`);
  });

  it('serves plain text content at /text/<type>/<id>/content.txt', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/text/text/1/content.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Text content 1');
  });

  it('serves structured content and passes response-specific headers', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/text/text/1/content.json`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: '1', content: { text: 'Text content 1' } });
    expect(res.headers.get('etag')).toBe('W/"test-revision"');
    expect(res.headers.get('last-modified')).toBe('Mon, 01 Jan 2024 00:00:00 GMT');
    expect(res.headers.get('content-language')).toBe('pt');
    expect(res.headers.get('content-length')).toBe(String(Buffer.byteLength(JSON.stringify(body), 'utf8')));
  });

  it('returns a specific 404 for a missing article in content.json', async () => {
    const server = await startServer(0, {
      handlers: {
        ...handlers,
        contentJson: async () => {
          const error = new Error('Article not found: Missing');
          error.status = 404;
          error.code = 'ARTICLE_NOT_FOUND';
          throw error;
        },
      },
    });
    const res = await fetch(`${server.url}/text/text/Missing/content.json`);

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({
      error: 'ARTICLE_NOT_FOUND',
      message: 'Article not found: Missing',
      status: 404,
    });
  });

  it('returns a specific plain-text 404 for a missing content.txt', async () => {
    const server = await startServer(0, {
      handlers: {
        ...handlers,
        content: async () => {
          const error = new Error('Article not found: Missing');
          error.status = 404;
          error.code = 'ARTICLE_NOT_FOUND';
          throw error;
        },
      },
    });
    const res = await fetch(`${server.url}/text/text/Missing/content.txt`);

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('Article not found: Missing');
  });

  it('records complete requests and responses and exposes local history', async () => {
    const events = [];
    const server = await startServer(0, {
      onTraffic: (event) => events.push(event),
      handlers: {
        ...handlers,
        debugTraffic: () => ({ entries: events }),
      },
    });

    const response = await fetch(`${server.url}/search/text/amor.json?limit=20&cursor=page-2`);
    expect(response.status).toBe(200);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      direction: 'incoming',
      request: {
        method: 'GET',
        path: '/search/text/amor.json',
        queryString: '?limit=20&cursor=page-2',
        query: { limit: '20', cursor: 'page-2' },
      },
    });
    expect(events[1]).toMatchObject({
      direction: 'outgoing',
      response: { status: 200, body: { metas: [{ name: 'Result for amor' }] } },
    });

    const history = await fetch(`${server.url}/debug/traffic.json`);
    expect(history.status).toBe(200);
    expect((await history.json()).entries).toHaveLength(2);
  });

  it('returns 404 for an unknown route', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/does-not-exist.json`);
    expect(res.status).toBe(404);
  });

  it('rejects an invalid manifest', async () => {
    await expect(
      createAddonServer({ manifest: { id: 'x' }, port: 0, handlers }),
    ).rejects.toThrow('Invalid manifest');
  });
});
