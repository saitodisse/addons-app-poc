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
    author: 'Teste',
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
  return { id, role, version, name: id, description: id, methods: [{ id: 'run', description: 'Executa.' }] };
}

function setupFetch(addonManifest: AddonManifest): void {
  globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(addonManifest), { status: 200 }));
}

function moduleFor(addonManifest: AddonManifest, setup: AddonModule['setup'] = () => {}, createTab: AddonModule['createTab'] = () => ({ title: addonManifest.contract.ui.title ?? addonManifest.name, body: addonManifest.contract.ui.body ?? addonManifest.description })) {
  return { manifest: addonManifest, setup, createTab } satisfies AddonModule;
}

describe('FetchAddonLoader', () => {
  it('bloqueia antes do import quando falta serviço obrigatório', async () => {
    const addonManifest = manifest('consumer', [service('addons.missing.runner', 'consumes', '^1.0.0')]);
    setupFetch(addonManifest);
    const importFn = vi.fn();
    const loader = new FetchAddonLoader(new ServiceRegistry(), { log() {} }, importFn);

    const instance = await loader.load('https://example.test/consumer/manifest.json');

    expect(instance.status).toBe('blocked');
    expect(instance.blockReason).toContain('Serviço obrigatório ausente');
    expect(importFn).not.toHaveBeenCalled();
  });

  it('reativa o mesmo consumidor quando um provedor compatível surge', async () => {
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
      id: 'addons.shared.runner', role: 'provides', version: '1.0.0', name: 'runner', description: 'runner', methods: [{ id: 'run', description: 'Executa.' }],
    });
    setupFetch(consumerManifest);
    const ready = await loader.load('https://example.test/consumer/manifest.json');

    expect(ready.status).toBe('ready');
  });

  it('limpa registros parciais quando setup falha', async () => {
    const addonManifest = manifest('provider', [service('addons.provider.runner', 'provides', '1.0.0')]);
    setupFetch(addonManifest);
    const registry = new ServiceRegistry();
    const module = moduleFor(addonManifest, (host) => {
      host.registerService('addons.provider.runner', { run: () => 'ok' });
      throw new Error('setup falhou');
    });
    const loader = new FetchAddonLoader(registry, { log() {} }, async () => module);

    const instance = await loader.load('https://example.test/provider/manifest.json');

    expect(instance.status).toBe('error');
    expect(registry.has('addons.provider.runner')).toBe(false);
  });

  it('aceita manifesto do bundle com entrypoint relativo ao projeto', async () => {
    const remoteManifest = manifest('hello', [service('addons.hello.greeter', 'provides', '1.0.0')]);
    const bundleManifest = { ...remoteManifest, entrypoint: '/packages/addon-hello/dist/bundle.js' };
    setupFetch(remoteManifest);
    const registry = new ServiceRegistry();
    const loader = new FetchAddonLoader(registry, { log() {} }, async () => moduleFor(bundleManifest));

    const instance = await loader.load('http://localhost:5301/manifest.json');

    expect(instance.status).toBe('ready');
    expect(instance.error).toBeUndefined();
  });
});
