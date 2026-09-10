import { describe, expect, it } from 'vitest';
import { catalog, search, text, content } from './handlers.js';

/** API falsa: simula busca paginada + random + summary sem rede. */
function fakeApi() {
  const searchCalls = [];
  return {
    searchCalls,
    async search(query, page) {
      searchCalls.push({ query, page });
      return {
        results: [
        { title: 'Brasil', description: 'Brasil\n\nConteúdo de Brasil', url: 'https://x/Brasil' },
        { title: 'Brasília', description: 'Brasília\n\nConteúdo de Brasília', url: 'https://x/Brasília' },
        ],
        pagination: { limit: 20, total: 2 },
      };
    },
    async random() {
      return ['Chuva', 'Mar'];
    },
    async summary(title) {
      if (title === 'Inexistente') return { title, extract: '' };
      return { title, extract: 'Extrato de ' + title, lang: 'pt', description: 'd' };
    },
  };
}

describe('Wikipedia add-on handlers', () => {
  it('search usa o limite ampliado e coloca o conteúdo na descrição', async () => {
    const api = fakeApi();
    const res = await search('page', 'brasil', api);
    expect(api.searchCalls).toEqual([{ query: 'brasil', page: undefined }]);
    expect(res.metas.map((m) => m.name)).toEqual(['Brasil', 'Brasília']);
    expect(res.metas[0].type).toBe('page');
    expect(res.metas[0].description).toBe('Brasil\n\nConteúdo de Brasil');
    expect(res.metas[0].description).not.toContain('content.txt');
    expect(res.pagination).toEqual({ limit: 20, total: 2 });
  });

  it('repassa limite e cursor ao cliente externo', async () => {
    const api = fakeApi();
    const res = await search('page', 'brasil', { limit: 20, cursor: '20' }, api);

    expect(api.searchCalls).toEqual([{ query: 'brasil', page: { limit: 20, cursor: '20' } }]);
    expect(res.metas).toHaveLength(2);
  });

  it('catalog aleatorios devolve títulos aleatórios', async () => {
    const res = await catalog('page', 'aleatorios', fakeApi());
    expect(res.metas.map((m) => m.name)).toEqual(['Chuva', 'Mar']);
  });

  it('text monta item com url relativa de conteúdo', async () => {
    const res = await text('page', 'Brasil', fakeApi());
    expect(res.texts[0].url).toBe('/text/page/Brasil/content.txt');
    expect(res.texts[0].name).toBe('Brasil');
  });

  it('text lança erro quando não há extrato', async () => {
    await expect(text('page', 'Inexistente', fakeApi())).rejects.toThrow('Artigo não encontrado');
  });

  it('content devolve título + extrato', async () => {
    const body = await content('page', 'Brasil', fakeApi());
    expect(body).toBe('Brasil\n\nExtrato de Brasil');
  });
});
