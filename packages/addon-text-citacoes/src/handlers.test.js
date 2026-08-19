import { describe, expect, it, vi } from 'vitest';
import { createQuotesApi } from './api.js';
import { catalog, search, text, content } from './handlers.js';

const apiUrl = 'https://dummyjson.com/quotes';

const sampleQuotes = {
  quotes: [
    { id: 1, quote: 'A vida é o que acontece enquanto você faz planos.', author: 'John Lennon' },
    { id: 2, quote: 'O único modo de fazer um ótimo trabalho é amar o que você faz.', author: 'Steve Jobs' },
  ],
  total: 2,
  skip: 0,
  limit: 30,
};

describe('api externa (fetch injetável)', () => {
  it('lista citações da API externa', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleQuotes),
    });
    const api = createQuotesApi({ fetchFn: mockFetch, baseUrl: apiUrl });

    const result = await api.popular();

    expect(mockFetch).toHaveBeenCalledWith(`${apiUrl}?limit=30`);
    expect(result).toHaveLength(2);
    expect(result[0].author).toBe('John Lennon');
  });

  it('busca citação por id na API externa', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleQuotes.quotes[0]),
    });
    const api = createQuotesApi({ fetchFn: mockFetch, baseUrl: apiUrl });

    const result = await api.byId('1');

    expect(mockFetch).toHaveBeenCalledWith(`${apiUrl}/1`);
    expect(result.id).toBe(1);
  });

  it('lança erro quando a API externa responde 5xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const api = createQuotesApi({ fetchFn: mockFetch, baseUrl: apiUrl });

    await expect(api.popular()).rejects.toThrow('503');
  });
});

describe('handlers do addon-text-citacoes', () => {
  function withMockApi(quotes) {
    return {
      popular: vi.fn().mockResolvedValue(quotes),
      byId: vi.fn().mockImplementation(async (id) =>
        quotes.find((q) => String(q.id) === String(id)) ?? null,
      ),
    };
  }

  it('catalog devolve metas no formato Stremio', async () => {
    const api = withMockApi(sampleQuotes.quotes);
    const payload = await catalog('quote', 'populares', api);
    expect(payload.metas).toHaveLength(2);
    expect(payload.metas[0]).toMatchObject({ id: '1', type: 'quote', name: expect.any(String) });
  });

  it('search baixa lote da API e filtra localmente', async () => {
    const api = withMockApi(sampleQuotes.quotes);
    const payload = await search('quote', 'trabalho', api);
    expect(api.popular).toHaveBeenCalledWith(100);
    expect(payload.metas).toHaveLength(1);
    expect(payload.metas[0].name).toContain('ótimo trabalho');
  });

  it('search sem resultados devolve lista vazia', async () => {
    const api = withMockApi(sampleQuotes.quotes);
    const payload = await search('quote', 'zzzz', api);
    expect(payload.metas).toEqual([]);
  });

  it('text devolve item com url de conteúdo', async () => {
    const api = withMockApi(sampleQuotes.quotes);
    const payload = await text('quote', '1', api);
    expect(payload.texts[0].url).toBe('/text/quote/1/content.txt');
    expect(payload.texts[0].lang).toBe('en');
  });

  it('content devolve a citação formatada', async () => {
    const api = withMockApi(sampleQuotes.quotes);
    const body = await content('quote', '2', api);
    expect(body).toContain('Steve Jobs');
    expect(body).toContain('ótimo trabalho');
  });

  it('content com id desconhecido lança erro', async () => {
    const api = withMockApi([]);
    await expect(content('quote', '999', api)).rejects.toThrow('Citação não encontrada');
  });
});
