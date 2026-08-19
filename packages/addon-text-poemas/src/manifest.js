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
};