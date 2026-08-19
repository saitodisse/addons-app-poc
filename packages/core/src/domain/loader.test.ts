import { describe, expect, it, vi } from 'vitest';
import { ServiceRegistry } from './registry';
import { SilentLogger } from '../adapters/silent-logger';
import type { AddonModule } from './host-api';

const mockManifest = {
  id: 'hello',
  version: '1.0.0',
  name: 'Hello',
  description: 'Test add-on',
  author: 'Test',
  license: 'MIT',
  entrypoint: 'https://example.com/bundle.js',
  services: [{ id: 'greeter', version: '1.0.0', name: 'Greeter', description: 'Saudação' }],
};

const mockAddonModule = {
  manifest: mockManifest,
  setup: vi.fn((host: { registerService: (id: string, instance: unknown) => void }) => {
    host.registerService('greeter', { greet: (name: string) => `Olá, ${name}!` });
  }),
};

describe('FetchAddonLoader', () => {
  async function createLoader(importFn?: (url: string) => Promise<AddonModule>) {
    const registry = new ServiceRegistry();
    const logger = new SilentLogger();
    const { FetchAddonLoader } = await import('../adapters/http-loader');
    return { registry, loader: new FetchAddonLoader(registry, logger, importFn) };
  }

  it('load returns ready status on success', async () => {
    const manifestUrl = 'https://example.com/manifest.json';

    const mockImport = vi.fn().mockResolvedValue(mockAddonModule);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockManifest),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { registry, loader } = await createLoader(mockImport);
    const instance = await loader.load(manifestUrl);

    expect(instance.status).toBe('ready');
    expect(instance.manifestUrl).toBe(manifestUrl);
    expect(instance.manifest.id).toBe('hello');
    expect(instance.services).toContain('greeter');
    expect(mockImport).toHaveBeenCalledWith('https://example.com/bundle.js');

    // Verify the service was registered in the registry
    expect(registry.has('greeter')).toBe(true);
    const greeter = registry.get<{ greet: (name: string) => string }>('greeter');
    expect(greeter?.greet('Mundo')).toBe('Olá, Mundo!');

    vi.unstubAllGlobals();
  });

  it('load returns error when fetch fails', async () => {
    const manifestUrl = 'https://example.com/manifest.json';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    const { loader } = await createLoader();
    const instance = await loader.load(manifestUrl);

    expect(instance.status).toBe('error');
    expect(instance.error).toBeDefined();

    vi.unstubAllGlobals();
  });

  it('load returns error when import fails', async () => {
    const manifestUrl = 'https://example.com/manifest.json';

    const mockImport = vi.fn().mockRejectedValue(new Error('Import failed'));
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockManifest),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { loader } = await createLoader(mockImport);
    const instance = await loader.load(manifestUrl);

    expect(instance.status).toBe('error');
    expect(instance.error).toBeDefined();

    vi.unstubAllGlobals();
  });

  it('load returns error when manifest is invalid', async () => {
    const manifestUrl = 'https://example.com/manifest.json';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ invalid: true }),
    }));

    const { loader } = await createLoader();
    const instance = await loader.load(manifestUrl);

    expect(instance.status).toBe('error');

    vi.unstubAllGlobals();
  });
});