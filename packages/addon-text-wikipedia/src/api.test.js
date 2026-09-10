import { describe, expect, it, vi } from 'vitest';
import { createWikipediaApi } from './api.js';

describe('createWikipediaApi', () => {
  it('repete a busca quando a Wikipédia responde 429 de forma transitória', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => '0' },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            searchinfo: { totalhits: 1 },
            search: [{ title: 'Bola' }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { bola: { title: 'Bola', extract: 'Extrato de Bola' } } },
        }),
      });
    const api = createWikipediaApi({ fetchFn, sleepFn: vi.fn().mockResolvedValue(undefined) });

    await expect(api.search('Bola', { limit: 3 })).resolves.toMatchObject({
      results: [{ title: 'Bola', description: 'Bola\n\nExtrato de Bola' }],
      pagination: { limit: 3 },
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('deduplica buscas iguais em andamento', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            searchinfo: { totalhits: 1 },
            search: [{ title: 'Bola' }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { bola: { title: 'Bola', extract: 'Extrato de Bola' } } },
        }),
      });
    const api = createWikipediaApi({ fetchFn });

    const [first, second] = await Promise.all([
      api.search('Bola', { limit: 3 }),
      api.search('Bola', { limit: 3 }),
    ]);

    expect(first).toEqual(second);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('busca uma página e completa a descrição com extratos em lote', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          continue: { sroffset: 20 },
          query: {
            searchinfo: { totalhits: 42 },
            search: [{ title: 'Primeiro' }, { title: 'Segundo' }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            pages: {
              second: { title: 'Segundo', extract: 'Extrato 2' },
              first: { title: 'Primeiro', extract: 'Extrato 1' },
            },
          },
        }),
      });
    const api = createWikipediaApi({ fetchFn });

    await expect(api.search('Bola')).resolves.toEqual({
      results: [
        { title: 'Primeiro', description: 'Primeiro\n\nExtrato 1', url: '' },
        { title: 'Segundo', description: 'Segundo\n\nExtrato 2', url: '' },
      ],
      pagination: { limit: 20, total: 42, next: '20' },
    });
    expect(fetchFn).toHaveBeenNthCalledWith(1, expect.stringContaining('list=search'));
    expect(fetchFn).toHaveBeenNthCalledWith(1, expect.stringContaining('srlimit=20'));
    expect(fetchFn).toHaveBeenNthCalledWith(2, expect.stringContaining('titles=Primeiro%7CSegundo'));
    expect(fetchFn).toHaveBeenNthCalledWith(2, expect.stringContaining('exlimit=20'));
  });

  it('usa o cursor da página anterior e limita o total a 500 itens', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { searchinfo: { totalhits: 900 }, search: [{ title: 'Último' }] },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { pages: {} } }) });
    const api = createWikipediaApi({ fetchFn });

    const result = await api.search('Bola', { limit: 500, cursor: '480' });

    expect(result.pagination).toEqual({ limit: 20, total: 500 });
    expect(fetchFn).toHaveBeenNthCalledWith(1, expect.stringContaining('sroffset=480'));
  });
});
