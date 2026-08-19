import { describe, expect, it, vi } from 'vitest';
import { HttpTextAddonClient } from './http-text-client';

const baseUrl = 'http://localhost:5291';

const stremioManifest = {
  id: 'text-biblioteca',
  version: '1.0.0',
  name: 'Biblioteca de Textos',
  description: 'Catálogo e busca de textos',
  author: 'Equipe AC',
  license: 'MIT',
  resources: [
    { name: 'catalog', types: ['text'], idPrefixes: [] },
    { name: 'search', types: ['text'], idPrefixes: [] },
    { name: 'text', types: ['text'], idPrefixes: [] },
  ],
  types: ['text'],
  idPrefixes: [],
  catalogs: [{ type: 'text', id: 'classicos', name: 'Textos Clássicos' }],
};

function jsonResponse(data: unknown) {
  return { ok: true, status: 200, json: () => Promise.resolve(data) };
}

describe('HttpTextAddonClient', () => {
  it('busca e valida o manifesto', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(stremioManifest));
    const client = new HttpTextAddonClient(mockFetch as never);

    const manifest = await client.getManifest(baseUrl);

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/manifest.json');
    expect(manifest.id).toBe('text-biblioteca');
    expect(manifest.resources?.map(r => r.name)).toEqual(['catalog', 'search', 'text']);
  });

  it('rejeita manifesto inválido', async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse({ id: 'x' }));
    const client = new HttpTextAddonClient(mockFetch as never);

    await expect(client.getManifest(baseUrl)).rejects.toThrow('Manifest inválido');
  });

  it('chama o endpoint de catálogo no formato Stremio', async () => {
    const payload = { metas: [{ id: '1', type: 'text', name: 'O Corvo' }] };
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = new HttpTextAddonClient(mockFetch as never);

    const result = await client.catalog(baseUrl, 'text', 'classicos');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/catalog/text/classicos.json');
    expect(result.metas[0]?.name).toBe('O Corvo');
  });

  it('chama o endpoint de busca', async () => {
    const payload = { metas: [{ id: '2', type: 'text', name: 'Amor' }] };
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = new HttpTextAddonClient(mockFetch as never);

    const result = await client.search(baseUrl, 'text', 'amor');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/search/text/amor.json');
    expect(result.metas[0]?.name).toBe('Amor');
  });

  it('chama o endpoint de texto (formato subtitles: lista com url)', async () => {
    const payload = {
      texts: [{ id: '1', url: 'http://localhost:5291/text/text/1/content.txt', lang: 'pt', name: 'O Corvo' }],
    };
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(payload));
    const client = new HttpTextAddonClient(mockFetch as never);

    const result = await client.text(baseUrl, 'text', '1');

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:5291/text/text/1.json');
    expect(result.texts[0]?.url).toContain('/content.txt');
  });

  it('lança erro quando o servidor responde 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) });
    const client = new HttpTextAddonClient(mockFetch as never);

    await expect(client.search(baseUrl, 'text', 'nao-existe')).rejects.toThrow('HTTP 404');
  });
});
