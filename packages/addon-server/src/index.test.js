import { afterEach, describe, expect, it } from 'vitest';
import { defineAddonManifest } from '@addons-poc/protocol';
import { createAddonServer } from './index.js';

const manifest = defineAddonManifest({
  id: 'text-teste',
  version: '1.0.0',
  name: 'Teste de Textos',
  description: 'Servidor de teste',
  author: 'Equipe AC',
  license: 'MIT',
  ui: { title: 'Teste', body: 'Uma aba de teste.' },
  resources: [
    { name: 'catalog', types: ['text'] },
    { name: 'search', types: ['text'] },
    { name: 'text', types: ['text'] },
  ],
  types: ['text'],
  catalogs: [{ type: 'text', id: 'classicos', name: 'Clássicos' }],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming', method: 'GET', path: '/catalog/{type}/{catalogId}.json', purpose: 'Entrega catálogo.', resource: 'catalog', returns: { description: 'Catálogo.', schema: { type: 'object', description: 'Catálogo.', classification: 'public' } } },
      { id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Busca catálogo.', resource: 'search', returns: { description: 'Busca.', schema: { type: 'object', description: 'Busca.', classification: 'public' } } },
      { id: 'text', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}.json', purpose: 'Entrega texto.', resource: 'text', returns: { description: 'Texto.', schema: { type: 'object', description: 'Texto.', classification: 'public' } } },
      { id: 'content-json', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}/content.json', purpose: 'Entrega conteúdo estruturado.', receives: { description: 'Artigo.', schema: { type: 'object', description: 'Parâmetros.', classification: 'personal' } }, returns: { description: 'Conteúdo estruturado.', schema: { type: 'object', description: 'Conteúdo.', classification: 'public' } } },
      { id: 'debug-traffic', direction: 'incoming', method: 'GET', path: '/debug/traffic.json', purpose: 'Inspeciona o tráfego.', returns: { description: 'Histórico.', schema: { type: 'object', description: 'Histórico.', classification: 'public' } } },
    ],
    logs: [],
  },
});

const searchPages = [];
const handlers = {
  catalog: async (type, catalogId) => ({
    metas: [{ id: '1', type, name: `Item de ${catalogId}` }],
  }),
  search: async (type, query, page) => {
    searchPages.push(page);
    return {
    metas: [{ id: '2', type, name: `Resultado de ${query}` }],
      ...(page ? { pagination: { limit: page.limit ?? 10, next: 'seguinte' } } : {}),
    };
  },
  text: async (type, id) => ({
    texts: [
      { id, url: `/text/${type}/${id}/content.txt`, contentJsonUrl: `/text/${type}/${id}/content.json`, lang: 'pt', name: 'Texto' },
      { id: 'rel', url: '/text/text/rel/content.txt', lang: 'en', name: 'Relativo' },
    ],
  }),
  content: async (_type, id) => `Conteúdo do texto ${id}`,
  contentJson: async (_type, id) => ({
    body: { id, content: { text: `Conteúdo do texto ${id}` } },
    headers: {
      ETag: 'W/"test-revision"',
      'Last-Modified': 'Mon, 01 Jan 2024 00:00:00 GMT',
      'Content-Language': 'pt',
    },
  }),
};

let servers = [];

async function startServer(port = 0, options = {}) {
  const server = await createAddonServer({ manifest, port, handlers, name: 'teste', ...options });
  servers.push(server);
  return server;
}

afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()));
  servers = [];
});

describe('createAddonServer (estilo Stremio)', () => {
  it('serve o manifesto em /manifest.json', async () => {
    const server = await startServer();
    const res = await fetch(server.manifestUrl);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('text-teste');
    expect(body.contract.resources[0].name).toBe('catalog');
  });

  it('serve /catalog/<type>/<id>.json', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/catalog/text/classicos.json`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metas[0].name).toBe('Item de classicos');
  });

  it('serve /search/<type>/<query>.json', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/search/text/amor.json?limit=20&cursor=pagina-2`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metas[0].name).toBe('Resultado de amor');
    expect(body.pagination).toEqual({ limit: 20, next: 'seguinte' });
    expect(searchPages.at(-1)).toEqual({ limit: 20, cursor: 'pagina-2' });
  });

  it('serve /text/<type>/<id>.json com urls absolutas de conteúdo', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/text/text/1.json`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.texts[0].url).toBe(`${server.url}/text/text/1/content.txt`);
    expect(body.texts[0].contentJsonUrl).toBe(`${server.url}/text/text/1/content.json`);
    expect(body.texts[1].url).toBe(`${server.url}/text/text/rel/content.txt`);
  });

  it('serve o conteúdo em texto puro em /text/<type>/<id>/content.txt', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/text/text/1/content.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Conteúdo do texto 1');
  });

  it('serve conteúdo estruturado e repassa headers específicos da resposta', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/text/text/1/content.json`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ id: '1', content: { text: 'Conteúdo do texto 1' } });
    expect(res.headers.get('etag')).toBe('W/"test-revision"');
    expect(res.headers.get('last-modified')).toBe('Mon, 01 Jan 2024 00:00:00 GMT');
    expect(res.headers.get('content-language')).toBe('pt');
    expect(res.headers.get('content-length')).toBe(String(Buffer.byteLength(JSON.stringify(body), 'utf8')));
  });

  it('devolve 404 específico para artigo ausente em content.json', async () => {
    const server = await startServer(0, {
      handlers: {
        ...handlers,
        contentJson: async () => {
          const error = new Error('Artigo não encontrado: Inexistente');
          error.status = 404;
          error.code = 'ARTICLE_NOT_FOUND';
          throw error;
        },
      },
    });
    const res = await fetch(`${server.url}/text/text/Inexistente/content.json`);

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({
      error: 'ARTICLE_NOT_FOUND',
      message: 'Artigo não encontrado: Inexistente',
      status: 404,
    });
  });

  it('devolve 404 específico em texto puro para content.txt ausente', async () => {
    const server = await startServer(0, {
      handlers: {
        ...handlers,
        content: async () => {
          const error = new Error('Artigo não encontrado: Inexistente');
          error.status = 404;
          error.code = 'ARTICLE_NOT_FOUND';
          throw error;
        },
      },
    });
    const res = await fetch(`${server.url}/text/text/Inexistente/content.txt`);

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(await res.text()).toBe('Artigo não encontrado: Inexistente');
  });

  it('registra request e response completos e expõe o histórico local', async () => {
    const events = [];
    const server = await startServer(0, {
      onTraffic: (event) => events.push(event),
      handlers: {
        ...handlers,
        debugTraffic: () => ({ entries: events }),
      },
    });

    const response = await fetch(`${server.url}/search/text/amor.json?limit=20&cursor=pagina-2`);
    expect(response.status).toBe(200);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      direction: 'incoming',
      request: {
        method: 'GET',
        path: '/search/text/amor.json',
        queryString: '?limit=20&cursor=pagina-2',
        query: { limit: '20', cursor: 'pagina-2' },
      },
    });
    expect(events[1]).toMatchObject({
      direction: 'outgoing',
      response: { status: 200, body: { metas: [{ name: 'Resultado de amor' }] } },
    });

    const history = await fetch(`${server.url}/debug/traffic.json`);
    expect(history.status).toBe(200);
    expect((await history.json()).entries).toHaveLength(2);
  });

  it('responde 404 para rota desconhecida', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/nao-existe.json`);
    expect(res.status).toBe(404);
  });

  it('rejeita manifesto inválido', async () => {
    await expect(
      createAddonServer({ manifest: { id: 'x' }, port: 0, handlers }),
    ).rejects.toThrow('Manifest inválido');
  });
});
