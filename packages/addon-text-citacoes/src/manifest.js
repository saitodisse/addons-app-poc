import { defineAddonManifest } from '@addons-poc/protocol';
/**
 * Manifesto do add-on Citações, formato estilo Stremio.
 * Este add-on faz processamento externo: busca citações de uma API pública.
 */
export const manifest = defineAddonManifest({
  id: 'text-citacoes',
  version: '1.0.0',
  name: 'Citações da Web',
  description: 'Citações famosas buscadas em uma API pública (processamento externo)',
  author: 'Equipe AC',
  license: 'MIT',
  ui: { title: '💬 Citações', body: 'Citações consultadas por HTTP.' },
  resources: [
    { name: 'catalog', types: ['quote'], idPrefixes: [] },
    { name: 'search', types: ['quote'], idPrefixes: [] },
    { name: 'text', types: ['quote'], idPrefixes: [] },
  ],
  types: ['quote'],
  idPrefixes: [],
  catalogs: [
    { type: 'quote', id: 'populares', name: 'Citações Populares' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming', method: 'GET', path: '/catalog/{type}/{catalogId}.json', purpose: 'Entrega citações populares.', resource: 'catalog', returns: { description: 'Metadados das citações.', schema: { type: 'object', description: 'Objeto com metas.', classification: 'public' } } },
      { id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Filtra localmente o lote de citações externo.', resource: 'search', receives: { description: 'Termo da busca.', schema: { type: 'string', description: 'Termo pesquisado.', classification: 'personal' } }, returns: { description: 'Metadados encontrados.', schema: { type: 'object', description: 'Objeto com metas.', classification: 'public' } } },
      { id: 'text', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}.json', purpose: 'Lista a versão disponível de uma citação.', resource: 'text', receives: { description: 'ID da citação.', schema: { type: 'string', description: 'Identificador da citação.', classification: 'public' } }, returns: { description: 'Opções de texto.', schema: { type: 'object', description: 'Objeto com texts.', classification: 'public' } } },
      { id: 'content', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}/content.txt', purpose: 'Entrega a citação em texto puro.', receives: { description: 'ID da citação.', schema: { type: 'string', description: 'Identificador da citação.', classification: 'public' } }, returns: { description: 'Texto da citação.', schema: { type: 'string', description: 'Conteúdo textual.', classification: 'public' } } },
      { id: 'quotes-list', direction: 'outgoing', method: 'GET', origin: 'https://dummyjson.com', path: '/quotes?limit={limit}', purpose: 'Obtém um lote público de citações antes de filtrar localmente.', returns: { description: 'Lote de citações públicas.', schema: { type: 'object', description: 'Resposta da DummyJSON.', classification: 'public' } } },
      { id: 'quote-by-id', direction: 'outgoing', method: 'GET', origin: 'https://dummyjson.com', path: '/quotes/{id}', purpose: 'Obtém uma citação pública pelo identificador.', receives: { description: 'Identificador da citação.', schema: { type: 'string', description: 'ID da citação.', classification: 'public' } }, returns: { description: 'Citação pública.', schema: { type: 'object', description: 'Resposta da DummyJSON.', classification: 'public' } } },
    ],
    logs: [],
  },
});
