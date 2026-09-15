import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonStateStore, AddonTab, HostAPI } from '@addons-poc/protocol';
import { MemoryBookmarkStore } from './memory-bookmark-store';
import type { Bookmark, BookmarkStore } from './bookmarks';
import { createTabStatePersistence } from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'favorites',
  version: '1.0.0',
  name: 'Favorites Add-on',
  description: 'Favorites that persist only when a storage add-on is active',
  author: 'AC Team',
  license: 'MIT',
  ui: {
    title: '⭐ Favorites',
    body: 'Save, browse, and remove favorites using host storage.',
  },
  entrypoint: '/packages/addon-favorites/dist/bundle.js',
  services: [
    { id: 'addons.favorites', version: '1.0.0', name: 'Favorites', description: 'Lists/adds/removes favorites' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'addons.favorites', role: 'provides', version: '1.0.0', description: 'Lists, adds, and removes favorites.', methods: [{ id: 'list', description: 'Lists favorites.', returns: { description: 'Favorite list.', schema: { type: 'array', description: 'Saved favorites.', classification: 'personal' } } }, { id: 'add', description: 'Adds a favorite.', receives: { description: 'Title and optional URL.', schema: { type: 'object', description: 'Favorite data.', classification: 'personal', properties: { title: { type: 'string', description: 'Favorite title.', classification: 'personal' }, url: { type: 'string', description: 'Optional URL.', classification: 'personal', format: 'uri' } }, required: ['title'] } }, returns: { description: 'Created favorite.', schema: { type: 'object', description: 'Saved favorite.', classification: 'personal' } } }, { id: 'remove', description: 'Removes a favorite by ID.', receives: { description: 'Favorite ID.', schema: { type: 'string', description: 'Favorite identifier.', classification: 'personal' } }, returns: { description: 'Indicates whether removal occurred.', schema: { type: 'boolean', description: 'Removal result.', classification: 'public' } } }] }, { id: 'state-store', role: 'consumes', version: '1.0.0', description: 'Persists favorites when available.', required: false, methods: [{ id: 'get', description: 'Reads favorites.' }, { id: 'set', description: 'Writes favorites.' }] }],
    ui: { fields: [{ id: 'title', label: 'Title', description: 'Favorite name.', required: true, schema: { type: 'string', description: 'Provided title.', classification: 'personal' } }, { id: 'url', label: 'URL', description: 'Optional address associated with the favorite.', schema: { type: 'string', description: 'Provided URL.', classification: 'personal', format: 'uri' } }, { id: 'id', label: 'ID to remove', description: 'Identifier of the favorite to remove.', required: true, schema: { type: 'string', description: 'Provided ID.', classification: 'personal' } }], actions: [{ id: 'add', label: 'Add', description: 'Saves a favorite.', receives: ['title', 'url'], returns: { description: 'Saved favorite.', schema: { type: 'object', description: 'Add response.', classification: 'personal' } } }, { id: 'list', label: 'List', description: 'Shows saved favorites.', returns: { description: 'Favorite list.', schema: { type: 'array', description: 'Favorites.', classification: 'personal' } } }, { id: 'remove', label: 'Remove', description: 'Removes the favorite by ID.', receives: ['id'], returns: { description: 'Removal result.', schema: { type: 'object', description: 'Removal response.', classification: 'public' } } }] },
    state: [{ id: 'list', description: 'List of favorites created by the person.', key: 'favorites:list', operations: ['read', 'write', 'remove'], value: { description: 'Saved favorites.', schema: { type: 'array', description: 'Favorites.', classification: 'personal' } }, retention: 'While the storage provider selected by the host retains the state.', deletionTrigger: 'Individual removal, provider cleanup, or browser data removal.', fallback: 'memory' }, { id: 'tab', description: 'Fields and the tab’s last response.', key: 'favorites:tab', operations: ['read', 'write'], value: { description: 'Tab visual state.', schema: { type: 'object', description: 'Fields and response.', classification: 'personal' } }, retention: 'While the provider retains the state.', deletionTrigger: 'Provider cleanup or browser data removal.', fallback: 'memory' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Favorites add-on configured successfully', description: 'Confirms add-on activation.' }],
  },
});

/** Favorite service: consumes BookmarkStore with in-memory degradation. */
export function createFavoritesService(store: BookmarkStore = new MemoryBookmarkStore()) {
  return {
    list: () => store.list(),
    add: (title: string, url?: string) => store.save({ title, url }),
    remove: (id: string) => store.remove(id),
  };
}

/** Favorites that migrate from memory to the storage add-on when it is active. */
export function createOptionalStateFavoritesService(host: Pick<HostAPI, 'services'>) {
  let transientItems: Bookmark[] = [];
  let nextId = 1;

  const read = async (): Promise<Bookmark[]> => {
    const store = host.services.use<AddonStateStore>({ id: 'state-store' });
    if (!store) return [...transientItems].sort((a, b) => b.createdAt - a.createdAt);
    const saved = await store.get<Bookmark[]>('favorites:list');
    if (saved) return saved.sort((a, b) => b.createdAt - a.createdAt);
    if (transientItems.length) await store.set('favorites:list', transientItems);
    return transientItems;
  };

  const write = async (items: Bookmark[]) => {
    const store = host.services.use<AddonStateStore>({ id: 'state-store' });
    if (store) {
      await store.set('favorites:list', items);
      return;
    }
    transientItems = items;
  };

  return {
    list: read,
    async add(input: { title: string; url?: string } | string, legacyUrl?: string): Promise<Bookmark> {
      const title = typeof input === 'string' ? input : input.title;
      const url = typeof input === 'string' ? legacyUrl : input.url;
      const favorite: Bookmark = { id: `favorite-${Date.now()}-${nextId++}`, title, url, createdAt: Date.now() };
      await write([favorite, ...(await read())]);
      return favorite;
    },
    async remove(id: string): Promise<boolean> {
      const current = await read();
      const remaining = current.filter((item) => item.id !== id);
      if (remaining.length === current.length) return false;
      await write(remaining);
      return true;
    },
  };
}

export function setup(host: HostAPI): void {
  host.registerService('addons.favorites', createOptionalStateFavoritesService(host));
  host.log('info', 'Favorites add-on configured successfully');
}

export function createTab(host: HostAPI): AddonTab {
  const favorites = host.services.use<ReturnType<typeof createOptionalStateFavoritesService>>({ id: 'addons.favorites' });
  return {
    ...manifest.contract.ui,
    fields: [
      { id: 'title', label: 'Title', placeholder: 'Favorite name', required: true },
      { id: 'url', label: 'URL', type: 'url', placeholder: 'https://example.com' },
      { id: 'id', label: 'ID to remove', placeholder: 'Copy the ID shown in the list', required: true },
    ],
    actions: [
      { id: 'add', label: 'Add' },
      { id: 'list', label: 'List', variant: 'secondary' },
      { id: 'remove', label: 'Remove', variant: 'danger' },
    ],
    persistence: createTabStatePersistence(host, 'favorites:tab'),
    async run(actionId, values) {
      if (!favorites) return { status: 'error', body: 'Favorites service unavailable.' };
      if (actionId === 'add') {
        const title = values.title?.trim();
        if (!title) {
          host.log('warn', 'Favorite rejected: missing title');
          return { status: 'error', body: 'Enter a title for the favorite.' };
        }
        const favorite = await favorites.add({ title, url: values.url?.trim() || undefined });
        host.log('info', 'Favorite added', { id: favorite.id, title: favorite.title });
        return { status: 'success', title: 'Favorite saved', body: favorite.title, items: [{ label: 'ID', value: favorite.id }] };
      }
      if (actionId === 'remove') {
        const id = values.id?.trim();
        if (!id) {
          host.log('warn', 'Favorite removal rejected: missing ID');
          return { status: 'error', body: 'Enter the ID of the favorite to remove.' };
        }
        const removed = await favorites.remove(id);
        host.log(removed ? 'info' : 'warn', 'Favorite removal completed', { id, removed });
        return { status: removed ? 'success' : 'error', body: removed ? 'Favorite removed.' : 'Favorite not found.' };
      }
      if (actionId === 'list') {
        const list = await favorites.list();
        host.log('info', 'Favorite list retrieved', { count: list.length });
        return {
          status: 'info',
          title: `${list.length} favorite(s)`,
          body: list.length ? 'Use the ID to remove an item.' : 'No favorites saved.',
          items: list.map((item) => ({ label: item.title, value: `${item.id}${item.url ? ` · ${item.url}` : ''}` })),
        };
      }
      return { status: 'error', body: 'Unknown action.' };
    },
  };
}
