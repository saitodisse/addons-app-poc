/**
 * Manifesto do add-on Poemas (PoetryDB), formato estilo Stremio.
 * Processamento externo real: busca de poemas na API pública PoetryDB.
 */
export const manifest = {
  id: 'text-poemas',
  version: '1.0.0',
  name: 'Poemas (PoetryDB)',
  description: 'Poemas de domínio público buscados na API PoetryDB (processamento externo)',
  author: 'Equipe AC',
  license: 'MIT',
  tab: { title: '📜 Poemas', body: 'Poemas consultados por HTTP.' },
  resources: [
    { name: 'catalog', types: ['poem'], idPrefixes: [] },
    { name: 'search', types: ['poem'], idPrefixes: [] },
    { name: 'text', types: ['poem'], idPrefixes: [] },
  ],
  types: ['poem'],
  idPrefixes: [],
  catalogs: [
    { type: 'poem', id: 'aleatorios', name: 'Poemas Aleatórios' },
    { type: 'poem', id: 'shakespeare', name: 'Shakespeare' },
  ],
  interactions: {
    version: '1.0.0',
    services: [],
    tab: { fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming', method: 'GET', path: '/catalog/{type}/{catalogId}.json', purpose: 'Entrega poemas por catálogo.', resource: 'catalog', returns: { description: 'Metadados dos poemas.', schema: { type: 'object', description: 'Objeto com metas.', classification: 'public' } } },
      { id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Busca poemas por título ou autor.', resource: 'search', receives: { description: 'Termo da busca.', schema: { type: 'string', description: 'Termo pesquisado.', classification: 'personal' } }, returns: { description: 'Metadados encontrados.', schema: { type: 'object', description: 'Objeto com metas.', classification: 'public' } } },
      { id: 'text', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}.json', purpose: 'Lista a versão disponível de um poema.', resource: 'text', receives: { description: 'ID do poema.', schema: { type: 'string', description: 'Identificador do poema.', classification: 'public' } }, returns: { description: 'Opções de texto.', schema: { type: 'object', description: 'Objeto com texts.', classification: 'public' } } },
      { id: 'content', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}/content.txt', purpose: 'Entrega o poema em texto puro.', receives: { description: 'ID do poema.', schema: { type: 'string', description: 'Identificador do poema.', classification: 'public' } }, returns: { description: 'Texto do poema.', schema: { type: 'string', description: 'Conteúdo textual.', classification: 'public' } } },
      { id: 'by-author', direction: 'outgoing', method: 'GET', origin: 'https://poetrydb.org', path: '/author/{author}', purpose: 'Busca poemas públicos por autor.', receives: { description: 'Autor pesquisado.', schema: { type: 'string', description: 'Nome do autor.', classification: 'personal' } }, returns: { description: 'Lista de poemas públicos.', schema: { type: 'array', description: 'Resposta da PoetryDB.', classification: 'public' } } },
      { id: 'by-title', direction: 'outgoing', method: 'GET', origin: 'https://poetrydb.org', path: '/title/{title}', purpose: 'Busca poemas públicos por título.', receives: { description: 'Título pesquisado.', schema: { type: 'string', description: 'Título procurado.', classification: 'personal' } }, returns: { description: 'Lista de poemas públicos.', schema: { type: 'array', description: 'Resposta da PoetryDB.', classification: 'public' } } },
      { id: 'random', direction: 'outgoing', method: 'GET', origin: 'https://poetrydb.org', path: '/random/{count}', purpose: 'Obtém poemas públicos aleatórios.', returns: { description: 'Lista de poemas públicos.', schema: { type: 'array', description: 'Resposta da PoetryDB.', classification: 'public' } } },
    ],
    logs: [],
  },
};
