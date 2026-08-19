/**
 * Manifesto do add-on Biblioteca de Textos, formato estilo Stremio.
 */
export const manifest = {
  id: 'text-biblioteca',
  version: '1.0.0',
  name: 'Biblioteca de Textos',
  description: 'Catálogo de textos curtos para leitura e compartilhamento',
  author: 'Equipe AC',
  license: 'MIT',
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
};