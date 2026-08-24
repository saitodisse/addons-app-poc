import { defineAddonManifest } from '@addons-poc/protocol';
/**
 * Manifesto do add-on Biblioteca de Textos, formato estilo Stremio.
 */
export const manifest = defineAddonManifest({
  id: 'text-biblioteca',
  version: '1.0.0',
  name: 'Biblioteca de Textos',
  description: 'Catálogo de textos curtos para leitura e compartilhamento',
  author: 'Equipe AC',
  license: 'MIT',
  ui: { title: '📚 Biblioteca', body: 'Catálogo remoto de textos curtos.' },
  resources: [
    { name: 'catalog', types: ['text'], idPrefixes: [] },
    { name: 'search', types: ['text'], idPrefixes: [] },
    { name: 'text', types: ['text'], idPrefixes: [] },
  ],
  types: ['text'],
  idPrefixes: [],
  catalogs: [
    { type: 'text', id: 'destaques', name: 'Textos em Destaque' },
    { type: 'text', id: 'natureza', name: 'Sobre a Natureza' },
    { type: 'text', id: 'memoria', name: 'Sobre a Memória' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming', method: 'GET', path: '/catalog/{type}/{catalogId}.json', purpose: 'Entrega os textos de um catálogo local.', resource: 'catalog', receives: { description: 'Tipo e catálogo solicitados.', schema: { type: 'object', description: 'Parâmetros da rota.', classification: 'public' } }, returns: { description: 'Metadados dos textos.', schema: { type: 'object', description: 'Objeto com metas.', classification: 'public' } } },
      { id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Busca textos locais.', resource: 'search', receives: { description: 'Termo de busca inserido na rota.', schema: { type: 'string', description: 'Termo pesquisado.', classification: 'personal' } }, returns: { description: 'Metadados encontrados.', schema: { type: 'object', description: 'Objeto com metas.', classification: 'public' } } },
      { id: 'text', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}.json', purpose: 'Lista a versão disponível de um texto.', resource: 'text', receives: { description: 'Identificador do texto.', schema: { type: 'string', description: 'ID do texto.', classification: 'public' } }, returns: { description: 'Opções de texto com URL de conteúdo.', schema: { type: 'object', description: 'Objeto com texts.', classification: 'public' } } },
      { id: 'content', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}/content.txt', purpose: 'Entrega o conteúdo textual escolhido.', receives: { description: 'Identificador do texto.', schema: { type: 'string', description: 'ID do texto.', classification: 'public' } }, returns: { description: 'Conteúdo em texto puro.', schema: { type: 'string', description: 'Conteúdo do texto.', classification: 'public' } } },
    ],
    logs: [],
  },
});
