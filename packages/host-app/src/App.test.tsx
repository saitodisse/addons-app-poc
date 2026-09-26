// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getInteractionContractFingerprint } from '@addons-poc/protocol';
import type { AddonManifest, AddonModule, AddonStateStore, HostAPI, ServiceInteraction } from '@addons-poc/protocol';
import { App } from './App';
import { INSTALLATIONS_STORAGE_KEY } from './factory-reset';
import { resultRoute } from './router';

const chartUrl = 'http://localhost:5295/text/chart/static-and-rain/content.txt';
const editorUrl = 'https://fixtures.test/chord-editor/manifest.json';
const viewerUrl = 'https://fixtures.test/chord-viewer/manifest.json';
const storageUrl = 'https://fixtures.test/storage-local/manifest.json';

function service(
  id: string,
  role: ServiceInteraction['role'],
  methods: string[],
  required = true,
): ServiceInteraction {
  return {
    id,
    role,
    version: role === 'consumes' ? '^1.0.0' : '1.0.0',
    name: id,
    description: `Fixture service ${id}.`,
    ...(role === 'consumes' ? { required } : {}),
    methods: methods.map((method) => ({ id: method, description: `Fixture method ${method}.` })),
  };
}

function manifest(id: string, url: string, services: ServiceInteraction[]): AddonManifest {
  return {
    id,
    version: '1.0.0',
    name: id,
    description: `Fixture for ${id}.`,
    author: 'Host integration tests',
    license: 'MIT',
    entrypoint: new URL('./bundle.js', url).href,
    contract: {
      version: '1.0.0',
      protocol: { version: '1.0.0', range: '^1.0.0' },
      capabilities: { required: [], optional: [] },
      services,
      ui: { title: id, body: `Fixture for ${id}.`, fields: [], actions: [] },
      state: [],
      http: [],
      logs: [],
    },
  };
}

function moduleFor(addonManifest: AddonManifest, setup: (host: HostAPI) => void): AddonModule {
  return {
    manifest: addonManifest,
    setup,
    createTab: () => ({
      title: addonManifest.contract.ui.title ?? addonManifest.name,
      body: addonManifest.contract.ui.body ?? addonManifest.description,
      fields: [],
      actions: [],
      run: async () => ({ status: 'info', body: 'Fixture is ready.' }),
    }),
  };
}

function createFixtures(setupOrder: string[]) {
  const editor = manifest('chord-editor', editorUrl, [
    service('addons.chords.viewer', 'consumes', ['render']),
    service('state-store', 'consumes', ['get', 'set', 'remove']),
    service('addons.chords.drafts', 'provides', ['get']),
    service('host.content-editor', 'provides', ['supports', 'render']),
  ]);
  const viewer = manifest('chord-viewer', viewerUrl, [
    service('addons.chords.viewer', 'provides', ['render']),
    service('host.content-view', 'provides', ['render']),
    service('addons.chords.drafts', 'consumes', ['get'], false),
  ]);
  const storage = manifest('storage-local', storageUrl, [
    service('state-store', 'provides', ['get', 'set', 'remove', 'listKeys', 'clear']),
  ]);

  const stored = new Map<string, unknown>();
  const stateStore: AddonStateStore = {
    get: async <T,>(key: string) => stored.get(key) as T | undefined,
    set: async <T,>(key: string, value: T) => { stored.set(key, value); },
    remove: async (key: string) => { stored.delete(key); },
    listKeys: async () => [...stored.keys()],
    clear: async () => { stored.clear(); },
  };

  const modules = new Map<string, AddonModule>([
    [editor.entrypoint!, moduleFor(editor, (host) => {
      setupOrder.push('editor');
      if (!host.services.use({ id: 'addons.chords.viewer', methods: [{ id: 'render' }] })) {
        throw new Error('The chart renderer was unavailable during editor setup.');
      }
      if (!host.services.use({ id: 'state-store', methods: [{ id: 'get' }] })) {
        throw new Error('The storage provider was unavailable during editor setup.');
      }
      host.registerService('addons.chords.drafts', { get: async () => ({ found: false }) });
      host.registerService('host.content-editor', {
        supports: ({ url, type }: { url: string; type?: string }) => url === chartUrl && (!type || type === 'chart'),
        render: async () => ({ html: '<textarea>Am F C G</textarea>', title: 'Edit Static and Rain' }),
      });
    })],
    [viewer.entrypoint!, moduleFor(viewer, (host) => {
      setupOrder.push('viewer');
      host.services.use({ id: 'addons.chords.drafts', methods: [{ id: 'get' }] });
      host.registerService('addons.chords.viewer', { render: () => '<pre>Am F C G</pre>' });
      host.registerService('host.content-view', {
        render: ({ url }: { url: string }) => url === chartUrl
          ? { html: '<pre>Am F C G</pre>', title: 'Static and Rain' }
          : undefined,
      });
    })],
    [storage.entrypoint!, moduleFor(storage, (host) => {
      setupOrder.push('storage');
      host.registerService('state-store', stateStore);
    })],
  ]);
  const manifests = new Map([
    [editorUrl, editor],
    [viewerUrl, viewer],
    [storageUrl, storage],
  ]);

  return { editor, viewer, storage, modules, manifests };
}

async function waitForArticle(container: HTMLElement): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (container.querySelector('.host-article-page')?.getAttribute('aria-busy') === 'false') return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  throw new Error('The direct chart article did not finish bootstrapping.');
}

describe('App add-on bootstrap', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalScrollIntoView: HTMLElement['scrollIntoView'] | undefined;
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    window.localStorage.removeItem(INSTALLATIONS_STORAGE_KEY);
    window.location.hash = '';
    if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    vi.unstubAllGlobals();
  });

  it.each([
    ['editor saved before its providers', [editorUrl, viewerUrl, storageUrl]],
    ['providers saved before the editor', [viewerUrl, storageUrl, editorUrl]],
  ])('restores the rendered chart and Edit after reload when %s', async (_description, manifestUrls) => {
    const setupOrder: string[] = [];
    const fixtures = createFixtures(setupOrder);
    const manifestFetches = new Map<string, number>();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const addonManifest = fixtures.manifests.get(url);
      if (!addonManifest) return new Response(null, { status: 404 });

      const count = (manifestFetches.get(url) ?? 0) + 1;
      manifestFetches.set(url, count);
      // During the second pass, keep the renderer in flight while the host tries
      // to reactivate its consumers. This makes the original race deterministic.
      if (url === viewerUrl && count === 2) await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(JSON.stringify(addonManifest), { status: 200 });
    }));

    window.localStorage.setItem(INSTALLATIONS_STORAGE_KEY, JSON.stringify({
      manifestUrls,
      disabledManifestUrls: [],
      acceptedContractFingerprints: Object.fromEntries([...fixtures.manifests].map(([url, addonManifest]) => [
        url,
        getInteractionContractFingerprint(addonManifest.contract),
      ])),
      searchLimits: {},
      searchLanguages: {},
    }));
    window.location.hash = resultRoute(chartUrl);
    const importAddonModule = async (url: string): Promise<AddonModule> => {
      const addonModule = fixtures.modules.get(url);
      if (!addonModule) throw new Error(`No fixture module for ${url}`);
      return addonModule;
    };

    await act(async () => {
      root.render(
        <NuqsAdapter>
          <App importAddonModule={importAddonModule} />
        </NuqsAdapter>,
      );
    });

    await waitForArticle(container);
    expect(container.querySelector('.host-article-page')?.getAttribute('aria-busy')).toBe('false');
    expect(container.querySelector('.host-article-card pre')?.textContent).toBe('Am F C G');
    expect(container.querySelector('.host-article-edit-button')?.textContent).toBe('Edit');
    expect(setupOrder.slice(-2)).toEqual(['viewer', 'editor']);
    expect([...manifestFetches]).toEqual(expect.arrayContaining([
      [editorUrl, 2],
      [viewerUrl, 2],
      [storageUrl, 1],
    ]));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
