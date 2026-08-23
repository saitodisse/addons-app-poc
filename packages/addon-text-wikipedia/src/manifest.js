/**
 * Manifesto do add-on Wikipédia, formato estilo Stremio.
 * Processamento externo real: busca e resumos de artigos na Wikipédia.
 */
export const manifest = {
  id: 'text-wikipedia',
  version: '1.0.0',
  name: 'Wikipédia (resumos)',
  description: 'Artigos e resumos da Wikipédia (processamento externo real)',
  author: 'Equipe AC',
  license: 'MIT',
  tab: { title: '🌐 Wikipédia', body: 'Textos consultados pela Wikipédia via HTTP.' },
  resources: [
    { name: 'catalog', types: ['page'], idPrefixes: [] },
    { name: 'search', types: ['page'], idPrefixes: [] },
    { name: 'text', types: ['page'], idPrefixes: [] },
  ],
  types: ['page'],
  idPrefixes: [],
  catalogs: [
    { type: 'page', id: 'aleatorios', name: 'Artigos Aleatórios' },
  ],
  interactions: {
    version: '1.0.0',
    services: [],
    tab: { fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming', method: 'GET', path: '/catalog/{type}/{catalogId}.json', purpose: 'Entrega artigos aleatórios.', resource: 'catalog', returns: { description: 'Metadados dos artigos.', schema: { type: 'object', description: 'Objeto com metas.', classification: 'public' } } },
      { id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Busca artigos pelo termo informado.', resource: 'search', receives: { description: 'Termo da busca.', schema: { type: 'string', description: 'Termo pesquisado.', classification: 'personal' } }, returns: { description: 'Metadados encontrados.', schema: { type: 'object', description: 'Objeto com metas.', classification: 'public' } } },
      { id: 'text', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}.json', purpose: 'Lista a versão disponível de um resumo.', resource: 'text', receives: { description: 'Título ou ID do artigo.', schema: { type: 'string', description: 'Identificador do artigo.', classification: 'public' } }, returns: { description: 'Opções de texto.', schema: { type: 'object', description: 'Objeto com texts.', classification: 'public' } } },
      { id: 'content', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}/content.txt', purpose: 'Entrega o resumo em texto puro.', receives: { description: 'Título ou ID do artigo.', schema: { type: 'string', description: 'Identificador do artigo.', classification: 'public' } }, returns: { description: 'Resumo textual.', schema: { type: 'string', description: 'Conteúdo textual.', classification: 'public' } } },
      { id: 'search-api', direction: 'outgoing', method: 'GET', origin: 'https://pt.wikipedia.org', path: '/w/api.php?action=opensearch&search={query}&limit={limit}&namespace=0&format=json&origin=*', purpose: 'Busca títulos e descrições na Wikipédia.', receives: { description: 'Termo da busca.', schema: { type: 'string', description: 'Termo pesquisado.', classification: 'personal' } }, returns: { description: 'Títulos, descrições e URLs públicas.', schema: { type: 'array', description: 'Resposta OpenSearch.', classification: 'public' } } },
      { id: 'random-api', direction: 'outgoing', method: 'GET', origin: 'https://pt.wikipedia.org', path: '/w/api.php?action=query&list=random&rnnamespace=0&rnlimit={count}&format=json&origin=*', purpose: 'Obtém títulos aleatórios da Wikipédia.', returns: { description: 'Títulos públicos aleatórios.', schema: { type: 'object', description: 'Resposta de artigos aleatórios.', classification: 'public' } } },
      { id: 'summary-api', direction: 'outgoing', method: 'GET', origin: 'https://pt.wikipedia.org', path: '/api/rest_v1/page/summary/{title}', purpose: 'Obtém o resumo público de um artigo.', receives: { description: 'Título do artigo.', schema: { type: 'string', description: 'Título solicitado.', classification: 'personal' } }, returns: { description: 'Resumo público do artigo.', schema: { type: 'object', description: 'Resposta de resumo.', classification: 'public' } } },
    ],
    logs: [],
  },
};
