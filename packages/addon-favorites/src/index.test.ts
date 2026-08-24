import { describe, expect, it } from 'vitest';
import { createFavoritesService, createOptionalStateFavoritesService, manifest } from './index';
import { MemoryBookmarkStore } from './memory-bookmark-store';

describe('createFavoritesService', () => {
  it('lista, adiciona e remove usando uma store', async () => {
    const s = new MemoryBookmarkStore();
    const fav = createFavoritesService(s);
    await fav.add('Um conto', 'http://x');
    const list = await fav.list();
    expect(list.map((b) => b.title)).toContain('Um conto');
    expect(list[0].id).toBeTruthy();
    expect(list[0].createdAt).toBeGreaterThan(0);
  });

  it('degrada a memoria quando o store está ausente', async () => {
    const fav = createFavoritesService(); // sem store → memória interna
    await fav.add('Sobrevivente');
    expect((await fav.list()).map((b) => b.title)).toContain('Sobrevivente');
  });

  it('remove devuelve true/false', async () => {
    const fav = createFavoritesService();
    const saved = await fav.add('x');
    expect(await fav.remove(saved.id)).toBe(true);
    expect(await fav.remove(saved.id)).toBe(false);
    expect(await fav.list()).toHaveLength(0);
  });

  it('só grava a lista quando o serviço de estado opcional existe', async () => {
    const saved = new Map<string, unknown>();
    const services = {
      use: <T,>(contract: { id: string }) => contract.id === 'state-store' ? {
        get: async <V,>(key: string) => saved.get(key) as V | undefined,
        set: async <V,>(key: string, value: V) => { saved.set(key, value); },
        remove: async () => {}, listKeys: async () => [], clear: async () => {},
      } as T : undefined,
    };
    const fav = createOptionalStateFavoritesService({ services } as never);
    await fav.add('Persistido');
    expect(saved.get('favorites:list')).toHaveLength(1);
  });
});

describe('manifest', () => {
  it('declara o serviço favorites', () => {
    expect(manifest.id).toBe('favorites');
    expect(manifest.contract.services.map((s) => s.id)).toContain('addons.favorites');
  });
});
