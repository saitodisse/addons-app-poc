import { describe, expect, it } from 'vitest';
import { MemoryBookmarkStore } from './memory-bookmark-store';
import { LocalStorageBookmarkStore } from './local-storage-bookmark-store';

describe('MemoryBookmarkStore', () => {
  it('guarda y lista en orden de más reciente a más antiguo', async () => {
    const store = new MemoryBookmarkStore();
    await store.save({ title: 'a', createdAt: 1 });
    await store.save({ title: 'b', createdAt: 2 });
    const list = await store.list();
    expect(list.map((x) => x.title)).toEqual(['b', 'a']);
    expect(list[0]!.id).toBeTruthy();
    expect(list[0]!.createdAt).toBeGreaterThan(0);
  });

  it('elimina por id y devuelve true/false', async () => {
    const store = new MemoryBookmarkStore();
    const saved = await store.save({ title: 'x' });
    expect(await store.remove(saved.id)).toBe(true);
    expect(await store.remove(saved.id)).toBe(false);
    expect(await store.list()).toHaveLength(0);
  });

  it('respeta un id y createdAt explícito', async () => {
    const store = new MemoryBookmarkStore();
    const saved = await store.save({ id: 'custom', title: 't', createdAt: 42 });
    expect((await store.list())[0]!.id).toBe('custom');
    expect((await store.list())[0]!.createdAt).toBe(42);
  });
});

describe('LocalStorageBookmarkStore (sin navegador)', () => {
  // En el entorno de pruebas (Node) no hay window.localStorage:
  // el adaptador degrada a memoria sin fallar.
  it('sigue guardando y listando en degradación a memoria', async () => {
    const store = new LocalStorageBookmarkStore('test:key');
    await store.save({ title: 'en memoria' });
    const list = await store.list();
    expect(list.map((x) => x.title)).toContain('en memoria');
  });
});
