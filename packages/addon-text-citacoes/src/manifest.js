/**
 * Manifesto do add-on Citações, formato estilo Stremio.
 * Este add-on faz processamento externo: busca citações de uma API pública.
 */
export const manifest = {
  id: 'text-citacoes',
  version: '1.0.0',
  name: 'Citações da Web',
  description: 'Citações famosas buscadas em uma API pública (processamento externo)',
  author: 'Equipe AC',
  license: 'MIT',
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
};