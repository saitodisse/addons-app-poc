import { describe, expect, it } from 'vitest';
import { createFavoritesService, createOptionalStateFavoritesService, manifest } from './index';
import { MemoryBookmarkStore } from './memory-bookmark-store';

describe('createFavoritesService', () => {
  it('lists, adds, and removes using a store', async () => {
    const s = new MemoryBookmarkStore();
    const fav = createFavoritesService(s);
    await fav.add('A story', 'http://x');
    const list = await fav.list();
    expect(list.map((b) => b.title)).toContain('A story');
    expect(list[0].id).toBeTruthy();
    expect(list[0].createdAt).toBeGreaterThan(0);
  });

  it('falls back to memory when the store is absent', async () => {
    const fav = createFavoritesService(); // no store -> internal memory
    await fav.add('Survivor');
    expect((await fav.list()).map((b) => b.title)).toContain('Survivor');
  });

  it('remove returns true/false', async () => {
    const fav = createFavoritesService();
    const saved = await fav.add('x');
    expect(await fav.remove(saved.id)).toBe(true);
    expect(await fav.remove(saved.id)).toBe(false);
    expect(await fav.list()).toHaveLength(0);
  });

  it('writes the list only when the optional state service exists', async () => {
    const saved = new Map<string, unknown>();
    const services = {
      use: <T,>(contract: { id: string }) => contract.id === 'state-store' ? {
        get: async <V,>(key: string) => saved.get(key) as V | undefined,
        set: async <V,>(key: string, value: V) => { saved.set(key, value); },
        remove: async () => {}, listKeys: async () => [], clear: async () => {},
      } as T : undefined,
    };
    const fav = createOptionalStateFavoritesService({ services } as never);
    await fav.add('Persisted');
    expect(saved.get('favorites:list')).toHaveLength(1);
  });
});

describe('manifest', () => {
  it('declares the favorites service', () => {
    expect(manifest.id).toBe('favorites');
    expect(manifest.contract.services.map((s) => s.id)).toContain('addons.favorites');
  });
});
