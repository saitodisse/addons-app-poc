import type { HostAPI, BookmarkStore } from '@addons/core';
import { MemoryBookmarkStore } from '@addons/core';

export const manifest = {
  id: 'favorites',
  version: '1.0.0',
  name: 'Favorites Add-on',
  description: 'Favoritos com persistência (consome BookmarkStore do registro)',
  author: 'Equipe AC',
  license: 'MIT',
  entrypoint: '/packages/addon-favorites/dist/bundle.js',
  services: [
    { id: 'favorites', version: '1.0.0', name: 'Favorites', description: 'Lista/adiciona/remove favoritos' },
  ],
};

/** Serviço de favoritos: consome BookmarkStore (com degradação a memória). */
export function createFavoritesService(store: BookmarkStore = new MemoryBookmarkStore()) {
  return {
    list: () => store.list(),
    add: (title: string, url?: string) => store.save({ title, url }),
    remove: (id: string) => store.remove(id),
  };
}

export function setup(host: HostAPI): void {
  const store = host.services.get<BookmarkStore>('bookmarkStore') ?? new MemoryBookmarkStore();
  host.registerService('favorites', createFavoritesService(store));
  host.log('info', 'Add-on favorites configurado com sucesso');
}
