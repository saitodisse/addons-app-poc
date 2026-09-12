import { describe, expect, it, vi } from 'vitest';
import { createWikipediaApi } from './api.js';

describe('createWikipediaApi', () => {
  it('registra a requisição enviada e a resposta completa recebida', async () => {
    const onTraffic = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { 'content-type': 'application/json' },
      json: async () => ({ title: 'Bola', extract: 'Resumo completo' }),
    });
    const api = createWikipediaApi({ fetchFn, onTraffic });

    await expect(api.summary('São Paulo')).resolves.toEqual({ title: 'Bola', extract: 'Resumo completo' });

    expect(onTraffic).toHaveBeenCalledTimes(1);
    expect(onTraffic).toHaveBeenCalledWith(expect.objectContaining({
      source: 'wikipedia-api',
      direction: 'outgoing',
      operation: 'summary',
      request: expect.objectContaining({
        method: 'GET',
        url: 'https://pt.wikipedia.org/api/rest_v1/page/summary/S%C3%A3o%20Paulo',
        path: '/api/rest_v1/page/summary/S%C3%A3o%20Paulo',
        queryString: '',
        query: {},
        pathParameters: { title: 'São Paulo' },
        headers: { 'User-Agent': expect.any(String), Accept: 'application/json' },
        body: null,
      }),
      response: expect.objectContaining({
        status: 200,
        ok: true,
        headers: { 'content-type': 'application/json' },
        body: { title: 'Bola', extract: 'Resumo completo' },
        bodyText: '{"title":"Bola","extract":"Resumo completo"}',
      }),
    }));
  });

  it('redige cabeçalhos sensíveis sem esconder os demais dados da resposta', async () => {
    const onTraffic = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'session=nao-expor',
        'x-client-ip': '192.0.2.10',
      },
      json: async () => ({ title: 'Bola' }),
    });
    const api = createWikipediaApi({ fetchFn, onTraffic });

    await api.summary('Bola');

    expect(onTraffic).toHaveBeenCalledWith(expect.objectContaining({
      response: expect.objectContaining({
        headers: {
          'content-type': 'application/json',
          'set-cookie': '[redacted]',
          'x-client-ip': '[redacted]',
        },
      }),
    }));
  });

  it('retorna detalhes da resposta para montar o conteúdo estruturado', async () => {
    const rawBody = JSON.stringify({ title: 'Brasil', extract: 'Resumo' });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        etag: '"rev-1"',
        'content-language': 'pt',
        'content-length': String(rawBody.length),
      }),
      text: async () => rawBody,
    });
    const api = createWikipediaApi({ fetchFn, nowFn: () => 1000 });

    await expect(api.summaryDetails('Brasil')).resolves.toMatchObject({
      body: { title: 'Brasil', extract: 'Resumo' },
      requestId: 'wikipedia-api-1',
      request: { url: 'https://pt.wikipedia.org/api/rest_v1/page/summary/Brasil' },
      response: {
        status: 200,
        headers: {
          etag: '"rev-1"',
          'content-language': 'pt',
          'content-length': String(rawBody.length),
        },
        bodyText: rawBody,
      },
      durationMs: 0,
      collectedAt: expect.any(String),
    });
  });

  it('preserva status 404 da API externa', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: {},
      json: async () => ({ title: 'Inexistente' }),
    });
    const api = createWikipediaApi({ fetchFn });

    await expect(api.summary('Inexistente')).rejects.toMatchObject({
      name: 'WikipediaApiError',
      status: 404,
    });
  });

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
