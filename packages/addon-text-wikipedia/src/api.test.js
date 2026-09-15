import { describe, expect, it, vi } from 'vitest';
import { createWikipediaApi } from './api.js';

describe('createWikipediaApi', () => {
  it('queries the Wikipedia domain in the selected language', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {},
      json: async () => ({ title: 'Language', extract: 'Summary' }),
    });
    const api = createWikipediaApi({ lang: 'en', fetchFn });

    await api.summary('Language');

    expect(fetchFn).toHaveBeenCalledWith('https://en.wikipedia.org/api/rest_v1/page/summary/Language');
    expect(api.language).toBe('en');
  });

  it('records the sent request and the complete response received', async () => {
    const onTraffic = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { 'content-type': 'application/json' },
      json: async () => ({ title: 'Ball', extract: 'Complete summary' }),
    });
    const api = createWikipediaApi({ fetchFn, onTraffic });

    await expect(api.summary('New York')).resolves.toEqual({ title: 'Ball', extract: 'Complete summary' });

    expect(onTraffic).toHaveBeenCalledTimes(1);
    expect(onTraffic).toHaveBeenCalledWith(expect.objectContaining({
      source: 'wikipedia-api',
      direction: 'outgoing',
      operation: 'summary',
      request: expect.objectContaining({
        method: 'GET',
        url: 'https://pt.wikipedia.org/api/rest_v1/page/summary/New%20York',
        path: '/api/rest_v1/page/summary/New%20York',
        queryString: '',
        query: {},
        pathParameters: { title: 'New York' },
        headers: { 'User-Agent': expect.any(String), Accept: 'application/json' },
        body: null,
      }),
      response: expect.objectContaining({
        status: 200,
        ok: true,
        headers: { 'content-type': 'application/json' },
        body: { title: 'Ball', extract: 'Complete summary' },
        bodyText: '{"title":"Ball","extract":"Complete summary"}',
      }),
    }));
  });

  it('redacts sensitive headers without hiding the other response data', async () => {
    const onTraffic = vi.fn();
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'session=do-not-expose',
        'x-client-ip': '192.0.2.10',
      },
      json: async () => ({ title: 'Ball' }),
    });
    const api = createWikipediaApi({ fetchFn, onTraffic });

    await api.summary('Ball');

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

  it('returns response details for building structured content', async () => {
    const rawBody = JSON.stringify({ title: 'Brazil', extract: 'Summary' });
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

    await expect(api.summaryDetails('Brazil')).resolves.toMatchObject({
      body: { title: 'Brazil', extract: 'Summary' },
      requestId: 'wikipedia-api-1',
      request: { url: 'https://pt.wikipedia.org/api/rest_v1/page/summary/Brazil' },
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

  it('preserves the external API 404 status', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: {},
      json: async () => ({ title: 'Missing' }),
    });
    const api = createWikipediaApi({ fetchFn });

    await expect(api.summary('Missing')).rejects.toMatchObject({
      name: 'WikipediaApiError',
      status: 404,
    });
  });

  it('retries the search when Wikipedia transiently responds with 429', async () => {
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
            search: [{ title: 'Ball' }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { ball: { title: 'Ball', extract: 'Extract of Ball' } } },
        }),
      });
    const api = createWikipediaApi({ fetchFn, sleepFn: vi.fn().mockResolvedValue(undefined) });

    await expect(api.search('Ball', { limit: 3 })).resolves.toMatchObject({
      results: [{ title: 'Ball', description: 'Ball\n\nExtract of Ball' }],
      pagination: { limit: 3 },
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('deduplicates identical searches in progress', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            searchinfo: { totalhits: 1 },
            search: [{ title: 'Ball' }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: { ball: { title: 'Ball', extract: 'Extract of Ball' } } },
        }),
      });
    const api = createWikipediaApi({ fetchFn });

    const [first, second] = await Promise.all([
      api.search('Ball', { limit: 3 }),
      api.search('Ball', { limit: 3 }),
    ]);

    expect(first).toEqual(second);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('searches a page and completes its description with batch extracts', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          continue: { sroffset: 20 },
          query: {
            searchinfo: { totalhits: 42 },
            search: [{ title: 'First' }, { title: 'Second' }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            pages: {
              second: { title: 'Second', extract: 'Extract 2' },
              first: { title: 'First', extract: 'Extract 1' },
            },
          },
        }),
      });
    const api = createWikipediaApi({ fetchFn });

    await expect(api.search('Ball')).resolves.toEqual({
      results: [
        { title: 'First', description: 'First\n\nExtract 1', url: '' },
        { title: 'Second', description: 'Second\n\nExtract 2', url: '' },
      ],
      pagination: { limit: 20, total: 42, next: '20' },
    });
    expect(fetchFn).toHaveBeenNthCalledWith(1, expect.stringContaining('list=search'));
    expect(fetchFn).toHaveBeenNthCalledWith(1, expect.stringContaining('srlimit=20'));
    expect(fetchFn).toHaveBeenNthCalledWith(2, expect.stringContaining('titles=First%7CSecond'));
    expect(fetchFn).toHaveBeenNthCalledWith(2, expect.stringContaining('exlimit=20'));
  });

  it('uses the previous page cursor and limits the total to 500 items', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { searchinfo: { totalhits: 900 }, search: [{ title: 'Last' }] },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ query: { pages: {} } }) });
    const api = createWikipediaApi({ fetchFn });

    const result = await api.search('Ball', { limit: 500, cursor: '480' });

    expect(result.pagination).toEqual({ limit: 20, total: 500 });
    expect(fetchFn).toHaveBeenNthCalledWith(1, expect.stringContaining('sroffset=480'));
  });
});
