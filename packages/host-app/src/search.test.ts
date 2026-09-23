import { describe, expect, it, vi } from 'vitest';
import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonInstance, TextAddonClientPort } from '@addons-poc/protocol';
import { browseActiveAddons, browseCatalogFor, browsePage, clampSearchLimit, contentJsonUrlFromContentUrl, fetchSearchResultContent, fetchSearchResultDetails, isBrowsableAddon, parseSearchLimitInput, searchActiveAddons, searchPage, truncateDescription } from './search';

function createAddon(manifestUrl: string, id: string, type = 'quote', languages: string[] = []): AddonInstance {
  const manifest = defineAddonManifest({
    id,
    version: '1.0.0',
    name: id,
    description: 'Test add-on',
    author: 'Team',
    license: 'MIT',
    ui: { title: id, body: 'Search' },
    resources: [{ name: 'search', types: [type], idPrefixes: [], ...(languages.length ? { languages } : {}) }],
    types: [type],
    idPrefixes: [],
    contract: {
      version: '1.0.0',
      protocol: { version: '1.0.0', range: '^1.0.0' },
      capabilities: { required: [], optional: [] },
      services: [],
      ui: { fields: [], actions: [] },
      state: [],
      http: [{ id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Search', resource: 'search', returns: { description: 'Results', schema: { type: 'object', description: 'Metadata entries', classification: 'public' } } }],
      logs: [],
    },
  });
  return { manifest, manifestUrl, status: 'ready', services: [], ui: { title: id, body: 'Search' } };
}

function createCatalogAddon(manifestUrl: string, id: string, catalogs = [{ type: 'chart', id: 'recent', name: 'Recently updated' }]): AddonInstance {
  const manifest = defineAddonManifest({
    id,
    version: '1.0.0',
    name: id,
    description: 'Test catalogue',
    author: 'Team',
    license: 'MIT',
    ui: { title: id, body: 'Catalogue' },
    resources: [
      { name: 'catalog', types: ['chart'], idPrefixes: [] },
      { name: 'text', types: ['chart'], idPrefixes: [] },
    ],
    types: ['chart'],
    idPrefixes: [],
    catalogs,
    contract: {
      version: '1.0.0',
      protocol: { version: '1.0.0', range: '^1.0.0' },
      capabilities: { required: [], optional: [] },
      services: [],
      ui: { fields: [], actions: [] },
      state: [],
      http: [{ id: 'catalog', direction: 'incoming', method: 'GET', path: '/catalog/{type}/{id}.json', purpose: 'Catalogue', resource: 'catalog', returns: { description: 'Items', schema: { type: 'object', description: 'Metadata entries', classification: 'public' } } }],
      logs: [],
    },
  });
  return { manifest, manifestUrl, status: 'ready', services: [], ui: { title: id, body: 'Catalogue' } };
}

describe('browseActiveAddons', () => {
  it('lists the catalogue of an add-on that declares one', async () => {
    const addon = createCatalogAddon('https://example.test/charts/manifest.json', 'charts');
    const client = {
      search: vi.fn(),
      catalog: vi.fn().mockResolvedValue({
        metas: [{ id: 'static-and-rain', type: 'chart', name: 'Static and Rain', description: 'Vela Nova' }],
        pagination: { limit: 10, total: 8, next: 'cursor-2' },
      }),
    };

    const collection = await browseActiveAddons([addon], [], {}, client);

    expect(client.catalog).toHaveBeenCalledWith('https://example.test/charts/', 'chart', 'recent', { limit: 10 });
    expect(collection.results).toHaveLength(1);
    expect(collection.results[0]).toMatchObject({
      id: 'static-and-rain',
      name: 'Static and Rain',
      url: 'https://example.test/charts/text/chart/static-and-rain/content.txt',
      description: 'Vela Nova',
    });
    expect(collection.pagination['https://example.test/charts/manifest.json::recent']).toEqual({ loaded: 1, total: 8, next: 'cursor-2' });
  });

  it('asks for the next cursor and stops when the source ends', async () => {
    const addon = createCatalogAddon('https://example.test/charts/manifest.json', 'charts');
    const client = {
      search: vi.fn(),
      catalog: vi.fn().mockResolvedValue({ metas: [{ id: '2', type: 'chart', name: 'Second' }] }),
    };
    const key = 'https://example.test/charts/manifest.json::recent';

    await browseActiveAddons([addon], [], {}, client, { [key]: { loaded: 10, next: 'cursor-2' } });
    expect(client.catalog).toHaveBeenCalledWith('https://example.test/charts/', 'chart', 'recent', { limit: 10, cursor: 'cursor-2' });

    // A finished source is not requested again, so paging back and forth is cheap.
    (client.catalog as ReturnType<typeof vi.fn>).mockClear();
    const ended = await browseActiveAddons([addon], [], {}, client, { [key]: { loaded: 10 } });
    expect(client.catalog).not.toHaveBeenCalled();
    expect(ended.results).toEqual([]);
  });

  it('reports a source that fails without hiding the others', async () => {
    const broken = createCatalogAddon('https://example.test/broken/manifest.json', 'broken');
    const working = createCatalogAddon('https://example.test/charts/manifest.json', 'charts');
    const client = {
      search: vi.fn(),
      catalog: vi.fn(async (baseUrl: string) => {
        if (baseUrl.includes('broken')) throw new Error('HTTP 500');
        return { metas: [{ id: '1', type: 'chart', name: 'First' }] };
      }),
    };

    const collection = await browseActiveAddons([broken, working], [], {}, client);

    expect(collection.errors).toEqual([{ addonName: 'broken', message: 'HTTP 500' }]);
    expect(collection.results.map((row) => row.name)).toEqual(['First']);
    expect(collection.providerCount).toBe(2);
  });

  it('declares what makes an add-on browsable and which catalogue is used', () => {
    const addon = createCatalogAddon('https://example.test/charts/manifest.json', 'charts', [
      { type: 'chart', id: 'recent', name: 'Recently updated' },
      { type: 'chart', id: 'popular', name: 'Most visited' },
    ]);

    expect(isBrowsableAddon(addon)).toBe(true);
    expect(isBrowsableAddon(addon, [addon.manifestUrl])).toBe(false);
    // One catalogue per add-on: several views of the same items would repeat rows.
    expect(browseCatalogFor(addon)?.id).toBe('recent');

    const searchOnly = createAddon('https://example.test/quotes/manifest.json', 'quotes');
    expect(isBrowsableAddon(searchOnly)).toBe(false);
    expect(browseCatalogFor(searchOnly)).toBeUndefined();
  });

  it('reads the numbered page the person asked for', async () => {
    const addon = createCatalogAddon('https://example.test/charts/manifest.json', 'charts');
    const pages = [
      { metas: [{ id: '1', type: 'chart', name: 'First' }], pagination: { limit: 1, total: 2, next: 'cursor-2' } },
      { metas: [{ id: '2', type: 'chart', name: 'Second' }] },
    ];
    let call = 0;
    const client = { search: vi.fn(), catalog: vi.fn(async () => pages[Math.min(call++, pages.length - 1)]) };

    const second = await browsePage([addon], [], 2, { [addon.manifestUrl]: 1 }, client);
    expect(second.page).toBe(2);
    expect(second.collection.results.map((row) => row.name)).toEqual(['Second']);
    expect(client.catalog).toHaveBeenCalledTimes(2);
  });
});

describe('searchActiveAddons', () => {
  it('normalizes metas, builds a content URL, and applies the per-add-on page size', async () => {
    const addon = createAddon('https://example.test/quotes/manifest.json', 'quotes');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockResolvedValue({ metas: [
        { id: '1', type: 'quote', name: 'A quotation', author: 'Author' },
        { id: '2', type: 'quote', name: 'Another quotation' },
      ] }),
    };

    const collection = await searchActiveAddons([addon], [], 'quotation', { [addon.manifestUrl]: 1 }, client);

    expect(client.search).toHaveBeenCalledWith('https://example.test/quotes/', 'quote', 'quotation', { limit: 1 });
    expect(collection.errors).toEqual([]);
    expect(collection.results).toHaveLength(1);
    expect(collection.results[0]).toMatchObject({
      type: 'quote',
      id: '1',
      url: 'https://example.test/quotes/text/quote/1/content.txt',
      name: 'A quotation',
      description: 'Author',
      emoji: '💬',
    });
  });

  it('sends the configured language and preserves it in the article fallback URL', async () => {
    const addon = createAddon('https://example.test/wikipedia/manifest.json', 'wikipedia', 'page', ['pt', 'en']);
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockResolvedValue({ metas: [{ id: '1', type: 'page', name: 'English result' }] }),
    };

    const collection = await searchActiveAddons(
      [addon],
      [],
      'term',
      {},
      client,
      {},
      { [addon.manifestUrl]: 'en' },
    );

    expect(client.search).toHaveBeenCalledWith('https://example.test/wikipedia/', 'page', 'term', { limit: 10, lang: 'en' });
    expect(collection.results[0]?.url).toBe('https://example.test/wikipedia/text/page/1/content.txt?lang=en');
  });

  it('ignores disabled add-ons and preserves isolated failures', async () => {
    const disabled = createAddon('https://example.test/disabled/manifest.json', 'disabled', 'poem');
    const broken = createAddon('https://example.test/broken/manifest.json', 'broken', 'page');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockRejectedValue(new Error('server unavailable')),
    };

    const collection = await searchActiveAddons([disabled, broken], [disabled.manifestUrl], 'term', {}, client);

    expect(client.search).toHaveBeenCalledTimes(1);
    expect(collection.results).toEqual([]);
    expect(collection.errors).toEqual([{ addonName: 'broken', message: 'server unavailable' }]);
    expect(collection.providerCount).toBe(1);
  });

  it('keeps valid results when another provider fails', async () => {
    const working = createAddon('https://example.test/working/manifest.json', 'working');
    const broken = createAddon('https://example.test/broken/manifest.json', 'broken', 'poem');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn((baseUrl) => baseUrl.includes('/working/')
        ? Promise.resolve({ metas: [{ id: '1', type: 'quote', name: 'Valid result' }] })
        : Promise.reject(new Error('Provider unavailable'))),
    };

    const collection = await searchActiveAddons([working, broken], [], 'term', {}, client);

    expect(collection.results).toHaveLength(1);
    expect(collection.results[0].name).toBe('Valid result');
    expect(collection.errors).toEqual([{ addonName: 'broken', message: 'Provider unavailable' }]);
  });

  it('leaves the description empty when a meta has neither description nor author', async () => {
    const addon = createAddon('https://example.test/empty/manifest.json', 'empty');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockResolvedValue({ metas: [{ id: '1', type: 'quote', name: 'No supporting text' }] }),
    };

    const collection = await searchActiveAddons([addon], [], 'term', {}, client);

    expect(collection.results[0].description).toBe('');
  });

  it('continues searching with the cursor returned by the provider', async () => {
    const addon = createAddon('https://example.test/paged/manifest.json', 'paged');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn()
        .mockResolvedValueOnce({
          metas: [{ id: '1', type: 'quote', name: 'Page 1', description: 'Content 1' }],
          pagination: { limit: 20, total: 3, next: 'cursor-2' },
        })
        .mockResolvedValueOnce({
          metas: [{ id: '2', type: 'quote', name: 'Page 2', description: 'Content 2' }],
          pagination: { limit: 20, total: 3 },
        }),
    };

    const first = await searchActiveAddons([addon], [], 'term', {}, client);
    const second = await searchActiveAddons([addon], [], 'term', {}, client, first.pagination);

    expect(first.results.map((result) => result.id)).toEqual(['1']);
    expect(first.pagination[`${addon.manifestUrl}::quote`]).toEqual({ loaded: 1, total: 3, next: 'cursor-2' });
    expect(second.results.map((result) => result.id)).toEqual(['2']);
    expect(client.search).toHaveBeenNthCalledWith(2, 'https://example.test/paged/', 'quote', 'term', { limit: 10, cursor: 'cursor-2' });
    expect(second.pagination[`${addon.manifestUrl}::quote`]).toEqual({ loaded: 2, total: 3 });
  });

  it('keeps the next page when a page fills the configured limit', async () => {
    const addon = createAddon('https://example.test/limited/manifest.json', 'limited');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockResolvedValue({
        metas: [
          { id: '1', type: 'quote', name: 'Page 1' },
          { id: '2', type: 'quote', name: 'Page 2' },
          { id: '3', type: 'quote', name: 'Page 3' },
        ],
        pagination: { limit: 3, total: 500, next: 'cursor-4' },
      }),
    };

    const collection = await searchActiveAddons([addon], [], 'term', { [addon.manifestUrl]: 3 }, client);

    expect(collection.results).toHaveLength(3);
    expect(collection.pagination[`${addon.manifestUrl}::quote`]).toEqual({ loaded: 3, total: 500, next: 'cursor-4' });
  });

  it('preserves the previous cursor when a page fails', async () => {
    const addon = createAddon('https://example.test/retry/manifest.json', 'retry');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockRejectedValue(new Error('timed out')),
    };

    const collection = await searchActiveAddons(
      [addon],
      [],
      'term',
      { [addon.manifestUrl]: 40 },
      client,
      { [`${addon.manifestUrl}::quote`]: { loaded: 20, total: 40, next: 'cursor-21' } },
    );

    expect(collection.errors).toEqual([{ addonName: 'retry', message: 'timed out' }]);
    expect(collection.pagination[`${addon.manifestUrl}::quote`]).toEqual({ loaded: 20, total: 40, next: 'cursor-21' });
  });

  it('loads only the requested page and reuses the previous one when going back', async () => {
    const addon = createAddon('https://example.test/navigable/manifest.json', 'navigable');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn()
        .mockResolvedValueOnce({
          metas: [{ id: '1', type: 'quote', name: 'Page 1' }],
          pagination: { limit: 10, total: 2, next: 'cursor-2' },
        })
        .mockResolvedValueOnce({
          metas: [{ id: '2', type: 'quote', name: 'Page 2' }],
          pagination: { limit: 10, total: 2 },
        }),
    };
    const cachedPages = new Map<number, Awaited<ReturnType<typeof searchActiveAddons>>>();

    const secondPage = await searchPage([addon], [], 'term', 2, {}, client, cachedPages);
    const firstPage = await searchPage([addon], [], 'term', 1, {}, client, cachedPages);

    expect(secondPage.page).toBe(2);
    expect(secondPage.collection.results.map((result) => result.id)).toEqual(['2']);
    expect(firstPage.collection.results.map((result) => result.id)).toEqual(['1']);
    expect(client.search).toHaveBeenCalledTimes(2);
    expect(client.search).toHaveBeenNthCalledWith(2, 'https://example.test/navigable/', 'quote', 'term', { limit: 10, cursor: 'cursor-2' });
  });
});

describe('clampSearchLimit', () => {
  it('keeps limits between 1 and 500 and uses ten by default', () => {
    expect(clampSearchLimit(undefined)).toBe(10);
    expect(clampSearchLimit('')).toBe(10);
    expect(clampSearchLimit(0)).toBe(1);
    expect(clampSearchLimit(12.7)).toBe(13);
    expect(clampSearchLimit(500)).toBe(500);
    expect(clampSearchLimit(600)).toBe(500);
  });
});

describe('search limit and description', () => {
  it('preserves the empty field and converts filled inputs', () => {
    expect(parseSearchLimitInput('')).toBe('');
    expect(parseSearchLimitInput('25')).toBe(25);
  });

  it('truncates the description at 140 characters', () => {
    const result = truncateDescription('a'.repeat(200));
    expect(Array.from(result)).toHaveLength(140);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('fetchSearchResultContent (fallback)', () => {
  it('loads text from the result URL', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('Ball\n\nArticle content'),
    });

    await expect(fetchSearchResultContent('http://localhost:5294/text/page/Ball/content.txt', fetchFn)).resolves.toBe('Ball\n\nArticle content');
    expect(fetchFn).toHaveBeenCalledWith('http://localhost:5294/text/page/Ball/content.txt');
  });

  it('exposes HTTP failures for the dedicated page to display', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500, text: vi.fn() });

    await expect(fetchSearchResultContent('http://localhost:5294/text/page/Missing/content.txt', fetchFn)).rejects.toThrow('HTTP 500');
  });
});

describe('fetchSearchResultDetails', () => {
  it('switches content.txt to content.json and preserves raw JSON, headers, and response metrics', async () => {
    const body = {
      title: 'Mammals',
      description: 'Animal class.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Mammals' } },
      originalimage: { source: 'https://upload.wikimedia.org/mammals.jpg' },
    };
    const bodyText = JSON.stringify(body);
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(bodyText),
      headers: new Headers({ ETag: 'W/"revision"', 'Content-Length': String(bodyText.length) }),
    });

    await expect(fetchSearchResultDetails('http://localhost:5294/text/page/Mammals/content.txt', fetchFn)).resolves.toMatchObject({
      body,
      bodyText,
      status: 200,
      ok: true,
    });
    expect(contentJsonUrlFromContentUrl('http://localhost:5294/text/page/Mammals/content.txt')).toBe('http://localhost:5294/text/page/Mammals/content.json');
    expect(fetchFn).toHaveBeenCalledWith('http://localhost:5294/text/page/Mammals/content.json');
  });

  it('keeps the structured HTTP failure for the dedicated page to display', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue('{"error":"ARTICLE_NOT_FOUND"}'),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });

    await expect(fetchSearchResultDetails('http://localhost:5294/text/page/Missing/content.txt', fetchFn)).rejects.toThrow('HTTP 404');
  });
});
