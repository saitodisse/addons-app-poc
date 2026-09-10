import { describe, expect, it, vi } from 'vitest';
import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonInstance, TextAddonClientPort } from '@addons-poc/protocol';
import { clampSearchLimit, searchActiveAddons } from './search';

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
  it('normaliza metas, gera URL de conteúdo e aplica o limite por add-on', async () => {
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

    expect(client.search).toHaveBeenCalledWith('https://example.test/quotes/', 'quote', 'citação');
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
});

describe('clampSearchLimit', () => {
  it('mantém limites entre 1 e 100 e usa dez como padrão', () => {
    expect(clampSearchLimit(undefined)).toBe(10);
    expect(clampSearchLimit(0)).toBe(1);
    expect(clampSearchLimit(12.7)).toBe(13);
    expect(clampSearchLimit(200)).toBe(100);
  });
});
