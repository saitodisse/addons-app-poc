import { describe, expect, it, vi } from 'vitest';
import { createPoetryApi } from './api.js';
import { catalog, search, text, content } from './handlers.js';

const baseUrl = 'https://poetrydb.org';

const poem = {
  title: 'Ozymandias',
  author: 'Percy Bysshe Shelley',
  lines: ['I met a traveller from an antique land', 'Who said: Two vast and trunkless legs of stone'],
  linecount: '2',
};

describe('api PoetryDB (fetch injetável)', () => {
  it('busca poemas por autor', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([poem]) });
    const api = createPoetryApi({ fetchFn: mockFetch, baseUrl });
    const result = await api.byAuthor('Shelley');
    expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/author/Shelley`);
    expect(result).toHaveLength(1);
  });

  it('busca poemas por título', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([poem]) });
    const api = createPoetryApi({ fetchFn: mockFetch, baseUrl });
    const result = await api.byTitle('Ozymandias');
    expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/title/Ozymandias`);
    expect(result[0].title).toBe('Ozymandias');
  });

  it('retorna lista vazia quando a API responde 404 (sem resultados)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const api = createPoetryApi({ fetchFn: mockFetch, baseUrl });
    const result = await api.byAuthor('Ninguem');
    expect(result).toEqual([]);
  });

  it('lança erro quando a API responde 5xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const api = createPoetryApi({ fetchFn: mockFetch, baseUrl });
    await expect(api.byTitle('X')).rejects.toThrow('500');
  });

  it('busca poemas aleatórios', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([poem]) });
    const api = createPoetryApi({ fetchFn: mockFetch, baseUrl });
    const result = await api.random(3);
    expect(mockFetch).toHaveBeenCalledWith(`${baseUrl}/random/3`);
    expect(result).toHaveLength(1);
  });
});

describe('handlers do addon-text-poemas', () => {
  function withMockApi({ byAuthor, byTitle, random } = {}) {
    return {
      byAuthor: byAuthor ?? vi.fn().mockResolvedValue([poem]),
      byTitle: byTitle ?? vi.fn().mockResolvedValue([poem]),
      random: random ?? vi.fn().mockResolvedValue([poem]),
    };
  }

  it('catalog aleatorios usa a API externa random', async () => {
    const api = withMockApi();
    const payload = await catalog('poem', 'aleatorios', api);
    expect(api.random).toHaveBeenCalled();
    expect(payload.metas[0]).toMatchObject({ id: 'Ozymandias', type: 'poem', name: 'Ozymandias' });
  });

  it('catalog shakespeare usa a API externa por autor', async () => {
    const api = withMockApi();
    const payload = await catalog('poem', 'shakespeare', api);
    expect(api.byAuthor).toHaveBeenCalledWith('Shakespeare');
    expect(payload.metas[0].name).toBe('Ozymandias');
  });

  it('search busca na API externa por título', async () => {
    const api = withMockApi();
    const payload = await search('poem', 'ozymandias', api);
    expect(api.byTitle).toHaveBeenCalledWith('ozymandias');
    expect(payload.metas[0].name).toBe('Ozymandias');
  });

  it('search tenta autor quando título não encontra', async () => {
    const byTitle = vi.fn().mockResolvedValue([]);
    const byAuthor = vi.fn().mockResolvedValue([poem]);
    const api = withMockApi({ byTitle, byAuthor });
    const payload = await search('poem', 'shelley', api);
    expect(byTitle).toHaveBeenCalledWith('shelley');
    expect(byAuthor).toHaveBeenCalledWith('shelley');
    expect(payload.metas[0].author).toBe('Percy Bysshe Shelley');
  });

  it('text devolve item com url de conteúdo', async () => {
    const api = withMockApi();
    const payload = await text('poem', 'Ozymandias', api);
    expect(payload.texts[0].url).toBe('/text/poem/Ozymandias/content.txt');
    expect(payload.texts[0].name).toBe('Ozymandias');
  });

  it('content devolve o poema completo com título e autor', async () => {
    const api = withMockApi();
    const body = await content('poem', 'Ozymandias', api);
    expect(body).toContain('Ozymandias');
    expect(body).toContain('Percy Bysshe Shelley');
    expect(body).toContain('I met a traveller');
  });

  it('content com poema desconhecido lança erro', async () => {
    const api = withMockApi({ byTitle: vi.fn().mockResolvedValue([]) });
    await expect(content('poem', 'NaoExiste', api)).rejects.toThrow('Poema não encontrado');
  });
});
