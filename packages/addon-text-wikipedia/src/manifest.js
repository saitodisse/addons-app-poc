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
};
