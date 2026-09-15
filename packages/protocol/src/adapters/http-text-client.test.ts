import { describe, expect, it, vi } from 'vitest';
import { HttpTextAddonClient } from './http-text-client';
import { defineAddonManifest } from '../domain/manifest';

const baseUrl = 'http://localhost:5291';

const stremioManifest = defineAddonManifest({
  id: 'text-library',
  version: '1.0.0',
  name: 'Text Library',
  description: 'Text catalog and search',
  author: 'AC Team',
  license: 'MIT',
  ui: { title: 'Library', body: 'Texts to read.' },
  resources: [
    { name: 'catalog', types: ['text'], idPrefixes: [] },
    { name: 'search', types: ['text'], idPrefixes: [] },
    { name: 'text', types: ['text'], idPrefixes: [] },
  ],
  types: ['text'],
  idPrefixes: [],
  catalogs: [{ type: 'text', id: 'classics', name: 'Classic Texts' }],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { title: 'Library', body: 'Texts.', fields: [], actions: [] },
    state: [],
    http: [
      { id: 'catalog', direction: 'incoming', method: 'GET', path: '/catalog/{type}/{catalogId}.json', purpose: 'Lists texts.', resource: 'catalog', returns: { description: 'Texts.', schema: { type: 'object', description: 'Metadata.', classification: 'public' } } },
      { id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Searches texts.', resource: 'search', returns: { description: 'Texts.', schema: { type: 'object', description: 'Metadata.', classification: 'public' } } },
      { id: 'text', direction: 'incoming', method: 'GET', path: '/text/{type}/{id}.json', purpose: 'Lists versions.', resource: 'text', returns: { description: 'Text.', schema: { type: 'object', description: 'Versions.', classification: 'public' } } },
    ],
    logs: [],
  },
});

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

describe('HttpTextAddonClient', () => {
  it('fetches and validates the manifest', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(stremioManifest));
    const client = new HttpTextAddonClient(mockFetch as never);

    const manifest = await client.getManifest(baseUrl);

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/manifest.json');
    expect(manifest.id).toBe('text-library');
    expect(manifest.contract.resources?.map(r => r.name)).toEqual(['catalog', 'search', 'text']);
  });

  it('rejects an invalid manifest', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'x' }));
    const client = new HttpTextAddonClient(mockFetch as never);

    await expect(client.getManifest(baseUrl)).rejects.toThrow('Invalid manifest');
  });

  it('calls the catalog endpoint in Stremio format', async () => {
    const payload = { metas: [{ id: '1', type: 'text', name: 'The Raven' }] };
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = new HttpTextAddonClient(mockFetch as never);

    const result = await client.catalog(baseUrl, 'text', 'classics');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/catalog/text/classics.json');
    expect(result.metas[0]?.name).toBe('The Raven');
  });

  it('calls the search endpoint', async () => {
    const payload = { metas: [{ id: '2', type: 'text', name: 'Love' }] };
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = new HttpTextAddonClient(mockFetch as never);

    const result = await client.search(baseUrl, 'text', 'love');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/search/text/love.json');
    expect(result.metas[0]?.name).toBe('Love');
  });

  it('sends the pagination limit and cursor in the search', async () => {
    const payload = {
      metas: [{ id: '3', type: 'text', name: 'Page 2' }],
      pagination: { limit: 20, next: 'page-3' },
    };
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = new HttpTextAddonClient(mockFetch as never);

    const result = await client.search(baseUrl, 'text', 'love', { limit: 20, cursor: 'page-2' });

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/search/text/love.json?limit=20&cursor=page-2');
    expect(result.pagination).toEqual({ limit: 20, next: 'page-3' });
  });

  it('sends the selected language to search and text endpoints', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ metas: [] }));
    const client = new HttpTextAddonClient(mockFetch as never);

    await client.search(baseUrl, 'text', 'love', { lang: 'en' });
    expect(mockFetch).toHaveBeenNthCalledWith(1, 'http://localhost:5291/search/text/love.json?lang=en');

    mockFetch.mockResolvedValueOnce(jsonResponse({ texts: [] }));
    await client.text(baseUrl, 'text', '1', { lang: 'en' });
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'http://localhost:5291/text/text/1.json?lang=en');
  });

  it('calls the text endpoint (subtitle format: list with URL)', async () => {
    const payload = {
      texts: [{ id: '1', url: 'http://localhost:5291/text/text/1/content.txt', lang: 'pt', name: 'The Raven' }],
    };
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = new HttpTextAddonClient(mockFetch as never);

    const result = await client.text(baseUrl, 'text', '1');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/text/text/1.json');
    expect(result.texts[0]?.url).toContain('/content.txt');
  });

  it('throws when the server responds with 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) });
    const client = new HttpTextAddonClient(mockFetch as never);

    await expect(client.search(baseUrl, 'text', 'does-not-exist')).rejects.toThrow('HTTP 404');
  });
});
