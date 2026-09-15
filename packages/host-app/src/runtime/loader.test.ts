import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddonManifest, AddonModule, ServiceInteraction } from '@addons-poc/protocol';
import { FetchAddonLoader } from './loader';
import { ServiceRegistry } from './registry';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function manifest(id: string, services: ServiceInteraction[]): AddonManifest {
  return {
    id,
    version: '1.0.0',
    name: id,
    description: id,
    author: 'Test team',
    license: 'MIT',
    entrypoint: `https://example.test/${id}/bundle.js`,
    contract: {
      version: '1.0.0',
      protocol: { version: '1.0.0', range: '^1.0.0' },
      capabilities: { required: [], optional: [] },
      services,
      ui: { title: id, body: id, fields: [], actions: [] },
      state: [],
      http: [],
      logs: [],
    },
  };
}

function service(id: string, role: ServiceInteraction['role'], version: string): ServiceInteraction {
  return { id, role, version, name: id, description: id, methods: [{ id: 'run', description: 'Runs the service.' }] };
}

function setupFetch(addonManifest: AddonManifest): void {
  globalThis.fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(addonManifest), { status: 200 }));
}

function moduleFor(addonManifest: AddonManifest, setup: AddonModule['setup'] = () => {}, createTab: AddonModule['createTab'] = () => ({ title: addonManifest.contract.ui.title ?? addonManifest.name, body: addonManifest.contract.ui.body ?? addonManifest.description })) {
  return { manifest: addonManifest, setup, createTab } satisfies AddonModule;
}

describe('FetchAddonLoader', () => {
  it('blocks before import when a required service is missing', async () => {
    const addonManifest = manifest('consumer', [service('addons.missing.runner', 'consumes', '^1.0.0')]);
    setupFetch(addonManifest);
    const importFn = vi.fn();
    const loader = new FetchAddonLoader(new ServiceRegistry(), { log() {} }, importFn);

    const instance = await loader.load('https://example.test/consumer/manifest.json');

    expect(instance.status).toBe('blocked');
    expect(instance.blockReason).toContain('Missing required service');
    expect(importFn).not.toHaveBeenCalled();
  });

  it('reactivates the same consumer when a compatible provider appears', async () => {
    const consumerManifest = manifest('consumer', [service('addons.shared.runner', 'consumes', '^1.0.0')]);
    const registry = new ServiceRegistry();
    setupFetch(consumerManifest);
    const addonModule = moduleFor(consumerManifest, (host) => {
      host.services.use({ id: 'addons.shared.runner' });
    });
    const loader = new FetchAddonLoader(registry, { log() {} }, async () => addonModule);

    const blocked = await loader.load('https://example.test/consumer/manifest.json');
    expect(blocked.status).toBe('blocked');

    registry.register('addons.shared.runner', { run: () => 'ok' }, 'provider', 10, {
      id: 'addons.shared.runner', role: 'provides', version: '1.0.0', name: 'runner', description: 'runner', methods: [{ id: 'run', description: 'Runs the service.' }],
    });
    setupFetch(consumerManifest);
    const ready = await loader.load('https://example.test/consumer/manifest.json');

    expect(ready.status).toBe('ready');
  });

  it('clears partial registrations when setup fails', async () => {
    const addonManifest = manifest('provider', [service('addons.provider.runner', 'provides', '1.0.0')]);
    setupFetch(addonManifest);
    const registry = new ServiceRegistry();
    const module = moduleFor(addonManifest, (host) => {
      host.registerService('addons.provider.runner', { run: () => 'ok' });
      throw new Error('setup failed');
    });
    const loader = new FetchAddonLoader(registry, { log() {} }, async () => module);

    const instance = await loader.load('https://example.test/provider/manifest.json');

    expect(instance.status).toBe('error');
    expect(registry.has('addons.provider.runner')).toBe(false);
  });

  it('accepts a bundle manifest with a project-relative entrypoint', async () => {
    const remoteManifest = manifest('markdown', [service('addons.markdown.text-formatter', 'provides', '1.0.0')]);
    const bundleManifest = { ...remoteManifest, entrypoint: '/packages/addon-markdown/dist/bundle.js' };
    setupFetch(remoteManifest);
    const registry = new ServiceRegistry();
    const loader = new FetchAddonLoader(registry, { log() {} }, async () => moduleFor(bundleManifest));

    const instance = await loader.load('http://localhost:5304/manifest.json');

    expect(instance.status).toBe('ready');
    expect(instance.error).toBeUndefined();
  });

  it('fetches each manifest only once when restoring multiple add-ons', async () => {
    const addonManifest = manifest('http-addon', [service('addons.http-addon.runner', 'provides', '1.0.0')]);
    const manifestUrl = 'https://example.test/http-addon/manifest.json';
    setupFetch(addonManifest);
    const loader = new FetchAddonLoader(new ServiceRegistry(), { log() {} }, async () => moduleFor(addonManifest));

    const instances = await loader.loadAll([manifestUrl]);

    expect(instances[0]?.status).toBe('ready');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
