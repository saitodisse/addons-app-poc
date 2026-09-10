import { describe, expect, it, vi } from 'vitest';
import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonInstance, TextAddonClientPort } from '@addons-poc/protocol';
import { clampSearchLimit, fetchSearchResultContent, parseSearchLimitInput, searchActiveAddons, searchPage, truncateDescription } from './search';

function createAddon(manifestUrl: string, id: string, type = 'quote'): AddonInstance {
  const manifest = defineAddonManifest({
    id,
    version: '1.0.0',
    name: id,
    description: 'Add-on de teste',
    author: 'Equipe',
    license: 'MIT',
    ui: { title: id, body: 'Busca' },
    resources: [{ name: 'search', types: [type], idPrefixes: [] }],
    types: [type],
    idPrefixes: [],
    contract: {
      version: '1.0.0',
      protocol: { version: '1.0.0', range: '^1.0.0' },
      capabilities: { required: [], optional: [] },
      services: [],
      ui: { fields: [], actions: [] },
      state: [],
      http: [{ id: 'search', direction: 'incoming', method: 'GET', path: '/search/{type}/{query}.json', purpose: 'Busca', resource: 'search', returns: { description: 'Resultados', schema: { type: 'object', description: 'Metas', classification: 'public' } } }],
      logs: [],
    },
  });
  return { manifest, manifestUrl, status: 'ready', services: [], ui: { title: id, body: 'Busca' } };
}

describe('searchActiveAddons', () => {
  it('normaliza metas, gera URL de conteúdo e aplica o tamanho da página por add-on', async () => {
    const addon = createAddon('https://example.test/quotes/manifest.json', 'quotes');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockResolvedValue({ metas: [
        { id: '1', type: 'quote', name: 'Uma citação', author: 'Autora' },
        { id: '2', type: 'quote', name: 'Outra citação' },
      ] }),
    };

    const collection = await searchActiveAddons([addon], [], 'citação', { [addon.manifestUrl]: 1 }, client);

    expect(client.search).toHaveBeenCalledWith('https://example.test/quotes/', 'quote', 'citação', { limit: 1 });
    expect(collection.errors).toEqual([]);
    expect(collection.results).toHaveLength(1);
    expect(collection.results[0]).toMatchObject({
      type: 'quote',
      id: '1',
      url: 'https://example.test/quotes/text/quote/1/content.txt',
      name: 'Uma citação',
      description: 'Autora',
      emoji: '💬',
    });
  });

  it('ignora add-ons desativados e preserva falhas isoladas', async () => {
    const disabled = createAddon('https://example.test/disabled/manifest.json', 'disabled', 'poem');
    const broken = createAddon('https://example.test/broken/manifest.json', 'broken', 'page');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockRejectedValue(new Error('servidor indisponível')),
    };

    const collection = await searchActiveAddons([disabled, broken], [disabled.manifestUrl], 'termo', {}, client);

    expect(client.search).toHaveBeenCalledTimes(1);
    expect(collection.results).toEqual([]);
    expect(collection.errors).toEqual([{ addonName: 'broken', message: 'servidor indisponível' }]);
    expect(collection.providerCount).toBe(1);
  });

  it('mantém resultados válidos quando outro provedor falha', async () => {
    const working = createAddon('https://example.test/working/manifest.json', 'working');
    const broken = createAddon('https://example.test/broken/manifest.json', 'broken', 'poem');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn((baseUrl) => baseUrl.includes('/working/')
        ? Promise.resolve({ metas: [{ id: '1', type: 'quote', name: 'Resultado válido' }] })
        : Promise.reject(new Error('Provedor indisponível'))),
    };

    const collection = await searchActiveAddons([working, broken], [], 'termo', {}, client);

    expect(collection.results).toHaveLength(1);
    expect(collection.results[0].name).toBe('Resultado válido');
    expect(collection.errors).toEqual([{ addonName: 'broken', message: 'Provedor indisponível' }]);
  });

  it('deixa a descrição vazia quando a meta não traz descrição nem autor', async () => {
    const addon = createAddon('https://example.test/empty/manifest.json', 'empty');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockResolvedValue({ metas: [{ id: '1', type: 'quote', name: 'Sem texto auxiliar' }] }),
    };

    const collection = await searchActiveAddons([addon], [], 'termo', {}, client);

    expect(collection.results[0].description).toBe('');
  });

  it('continua a busca usando o cursor devolvido pelo provedor', async () => {
    const addon = createAddon('https://example.test/paged/manifest.json', 'paged');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn()
        .mockResolvedValueOnce({
          metas: [{ id: '1', type: 'quote', name: 'Página 1', description: 'Conteúdo 1' }],
          pagination: { limit: 20, total: 3, next: 'cursor-2' },
        })
        .mockResolvedValueOnce({
          metas: [{ id: '2', type: 'quote', name: 'Página 2', description: 'Conteúdo 2' }],
          pagination: { limit: 20, total: 3 },
        }),
    };

    const first = await searchActiveAddons([addon], [], 'termo', {}, client);
    const second = await searchActiveAddons([addon], [], 'termo', {}, client, first.pagination);

    expect(first.results.map((result) => result.id)).toEqual(['1']);
    expect(first.pagination[`${addon.manifestUrl}::quote`]).toEqual({ loaded: 1, total: 3, next: 'cursor-2' });
    expect(second.results.map((result) => result.id)).toEqual(['2']);
    expect(client.search).toHaveBeenNthCalledWith(2, 'https://example.test/paged/', 'quote', 'termo', { limit: 10, cursor: 'cursor-2' });
    expect(second.pagination[`${addon.manifestUrl}::quote`]).toEqual({ loaded: 2, total: 3 });
  });

  it('mantém a próxima página quando a página preenche o limite configurado', async () => {
    const addon = createAddon('https://example.test/limited/manifest.json', 'limited');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockResolvedValue({
        metas: [
          { id: '1', type: 'quote', name: 'Página 1' },
          { id: '2', type: 'quote', name: 'Página 2' },
          { id: '3', type: 'quote', name: 'Página 3' },
        ],
        pagination: { limit: 3, total: 500, next: 'cursor-4' },
      }),
    };

    const collection = await searchActiveAddons([addon], [], 'termo', { [addon.manifestUrl]: 3 }, client);

    expect(collection.results).toHaveLength(3);
    expect(collection.pagination[`${addon.manifestUrl}::quote`]).toEqual({ loaded: 3, total: 500, next: 'cursor-4' });
  });

  it('preserva o cursor anterior quando uma página falha', async () => {
    const addon = createAddon('https://example.test/retry/manifest.json', 'retry');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn().mockRejectedValue(new Error('tempo esgotado')),
    };

    const collection = await searchActiveAddons(
      [addon],
      [],
      'termo',
      { [addon.manifestUrl]: 40 },
      client,
      { [`${addon.manifestUrl}::quote`]: { loaded: 20, total: 40, next: 'cursor-21' } },
    );

    expect(collection.errors).toEqual([{ addonName: 'retry', message: 'tempo esgotado' }]);
    expect(collection.pagination[`${addon.manifestUrl}::quote`]).toEqual({ loaded: 20, total: 40, next: 'cursor-21' });
  });

  it('carrega somente a página solicitada e reutiliza a anterior ao voltar', async () => {
    const addon = createAddon('https://example.test/navigable/manifest.json', 'navigable');
    const client: TextAddonClientPort = {
      getManifest: vi.fn(),
      catalog: vi.fn(),
      text: vi.fn(),
      search: vi.fn()
        .mockResolvedValueOnce({
          metas: [{ id: '1', type: 'quote', name: 'Página 1' }],
          pagination: { limit: 10, total: 2, next: 'cursor-2' },
        })
        .mockResolvedValueOnce({
          metas: [{ id: '2', type: 'quote', name: 'Página 2' }],
          pagination: { limit: 10, total: 2 },
        }),
    };
    const cachedPages = new Map<number, Awaited<ReturnType<typeof searchActiveAddons>>>();

    const secondPage = await searchPage([addon], [], 'termo', 2, {}, client, cachedPages);
    const firstPage = await searchPage([addon], [], 'termo', 1, {}, client, cachedPages);

    expect(secondPage.page).toBe(2);
    expect(secondPage.collection.results.map((result) => result.id)).toEqual(['2']);
    expect(firstPage.collection.results.map((result) => result.id)).toEqual(['1']);
    expect(client.search).toHaveBeenCalledTimes(2);
    expect(client.search).toHaveBeenNthCalledWith(2, 'https://example.test/navigable/', 'quote', 'termo', { limit: 10, cursor: 'cursor-2' });
  });
});

describe('clampSearchLimit', () => {
  it('mantém limites entre 1 e 500 e usa dez como padrão', () => {
    expect(clampSearchLimit(undefined)).toBe(10);
    expect(clampSearchLimit('')).toBe(10);
    expect(clampSearchLimit(0)).toBe(1);
    expect(clampSearchLimit(12.7)).toBe(13);
    expect(clampSearchLimit(500)).toBe(500);
    expect(clampSearchLimit(600)).toBe(500);
  });
});

describe('limite e descrição da busca', () => {
  it('preserva o campo vazio e converte entradas preenchidas', () => {
    expect(parseSearchLimitInput('')).toBe('');
    expect(parseSearchLimitInput('25')).toBe(25);
  });

  it('trunca a descrição em 140 caracteres', () => {
    const result = truncateDescription('a'.repeat(200));
    expect(Array.from(result)).toHaveLength(140);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('fetchSearchResultContent', () => {
  it('carrega o texto da URL do resultado', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('Bola\n\nConteúdo do artigo'),
    });

    await expect(fetchSearchResultContent('http://localhost:5294/text/page/Bola/content.txt', fetchFn)).resolves.toBe('Bola\n\nConteúdo do artigo');
    expect(fetchFn).toHaveBeenCalledWith('http://localhost:5294/text/page/Bola/content.txt');
  });

  it('expõe falhas HTTP para o modal apresentar ao usuário', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 500, text: vi.fn() });

    await expect(fetchSearchResultContent('http://localhost:5294/text/page/Inexistente/content.txt', fetchFn)).rejects.toThrow('HTTP 500');
  });
});
