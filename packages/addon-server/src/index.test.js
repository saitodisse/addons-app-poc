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
    ],
    logs: [],
  },
});

const handlers = {
  catalog: async (type, catalogId) => ({
    metas: [{ id: '1', type, name: `Item de ${catalogId}` }],
  }),
  search: async (type, query) => ({
    metas: [{ id: '2', type, name: `Resultado de ${query}` }],
  }),
  text: async (type, id) => ({
    texts: [
      { id, url: `/text/${type}/${id}/content.txt`, lang: 'pt', name: 'Texto' },
      { id: 'rel', url: '/text/text/rel/content.txt', lang: 'en', name: 'Relativo' },
    ],
  }),
  content: async (_type, id) => `Conteúdo do texto ${id}`,
};

let servers = [];

async function startServer(port = 0) {
  const server = await createAddonServer({ manifest, port, handlers, name: 'teste' });
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
    const res = await fetch(`${server.url}/search/text/amor.json`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metas[0].name).toBe('Resultado de amor');
  });

  it('serve /text/<type>/<id>.json com urls absolutas de conteúdo', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/text/text/1.json`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.texts[0].url).toBe(`${server.url}/text/text/1/content.txt`);
    expect(body.texts[1].url).toBe(`${server.url}/text/text/rel/content.txt`);
  });

  it('serve o conteúdo em texto puro em /text/<type>/<id>/content.txt', async () => {
    const server = await startServer();
    const res = await fetch(`${server.url}/text/text/1/content.txt`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Conteúdo do texto 1');
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
