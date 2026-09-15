import { defineAddonManifest } from '@addons-poc/protocol';
import { BrowserStateStore } from './browser-state-store';
import type { AddonStateStore, AddonTab, HostAPI, JsonValue } from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'storage-local',
  version: '1.0.0',
  name: 'Local Storage Add-on',
  description: 'Provides durable localStorage persistence to add-ons that request it',
  author: 'AC Team',
  license: 'MIT',
  ui: {
    title: '💾 Local Storage',
    body: 'Keeps add-on state in this browser even after the window closes.',
  },
  entrypoint: '/packages/addon-storage-local/dist/bundle.js',
  services: [
    { id: 'state-store', version: '1.0.0', name: 'Add-on State Store', description: 'Stores serializable state in localStorage', priority: 10 },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'state-store', role: 'provides', version: '1.0.0', description: 'Stores serializable state in this browser’s localStorage.', methods: [{ id: 'get', description: 'Reads state by key.' }, { id: 'set', description: 'Writes state by key.' }, { id: 'remove', description: 'Removes state by key.' }, { id: 'listKeys', description: 'Lists protocol keys.' }, { id: 'clear', description: 'Removes all protocol state.' }] }],
    ui: { fields: [], actions: [{ id: 'list', label: 'View state', description: 'Lists keys and lets you inspect saved JSON.', returns: { description: 'Saved JSON keys and values.', schema: { type: 'array', description: 'Stored state.', classification: 'personal' } } }, { id: 'clear', label: 'Clear state', description: 'Deletes all protocol state in this browser.', returns: { description: 'Clear confirmation.', schema: { type: 'object', description: 'Clear response.', classification: 'public' } } }] },
    state: [{ id: 'provider', description: 'Accepts any key declared by an installed add-on under the physical addons:state: prefix.', keyPattern: '*', operations: ['read', 'write', 'remove', 'list', 'clear'], value: { description: 'Serializable JSON value from another add-on.', schema: { type: 'object', description: 'Stored JSON value.', classification: 'personal' } }, retention: 'Until explicit cleanup, browser data removal, or localStorage becomes unavailable.', deletionTrigger: 'Clear state action, key removal, or browser data cleanup.', fallback: 'none' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Local storage enabled', description: 'Reports that localStorage was selected with priority 10.' }],
  },
});

export function createLocalStateStore(storage: Storage | null = typeof window === 'undefined' ? null : window.localStorage): AddonStateStore {
  return new BrowserStateStore(storage);
}

export function setup(host: HostAPI): void {
  host.registerService('state-store', createLocalStateStore(), 10);
  host.log('info', 'Local storage enabled', { storage: 'localStorage', priority: 10 });
}

export function createTab(host: HostAPI): AddonTab {
  const store = host.services.use<AddonStateStore>({ id: 'state-store' });
  const listStates = async () => {
    if (!store) return { status: 'error' as const, body: 'Storage service unavailable.' };
    const keys = await store.listKeys();
    host.log('info', 'Local state retrieved', { count: keys.length });
    const states = await Promise.all(keys.map(async (key) => ({
      key,
      value: await store.get<JsonValue>(key),
    })));
    return {
      status: 'info' as const,
      title: `${keys.length} state item(s) saved`,
      body: keys.length ? 'Saved state appears below; click a name to view the complete JSON.' : 'No add-on has stored state yet.',
      items: states.map(({ key, value }) => ({ label: key, value: 'localStorage · view JSON', details: value ?? null })),
    };
  };

  return {
    ...manifest.contract.ui,
    actions: [
      { id: 'list', label: 'View state', variant: 'secondary' },
      { id: 'clear', label: 'Clear state', variant: 'danger' },
    ],
    getSnapshot: listStates,
    async run(actionId) {
      if (actionId === 'list') {
        return listStates();
      }
      if (actionId === 'clear') {
        if (!store) return { status: 'error', body: 'Storage service unavailable.' };
        await store.clear();
        host.log('warn', 'Local state removed');
        return { status: 'success', body: 'This protocol’s state was removed from localStorage.' };
      }
      return { status: 'error', body: 'Unknown action.' };
    },
  };
}
