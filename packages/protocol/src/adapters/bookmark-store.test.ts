import { describe, expect, it } from 'vitest';
import { MemoryBookmarkStore } from './memory-bookmark-store';
import { LocalStorageBookmarkStore } from './local-storage-bookmark-store';

describe('MemoryBookmarkStore', () => {
  it('saves and lists in newest-to-oldest order', async () => {
    const store = new MemoryBookmarkStore();
    await store.save({ title: 'a', createdAt: 1 });
    await store.save({ title: 'b', createdAt: 2 });
    const list = await store.list();
    expect(list.map((x) => x.title)).toEqual(['b', 'a']);
    expect(list[0]!.id).toBeTruthy();
    expect(list[0]!.createdAt).toBeGreaterThan(0);
  });

  it('removes by ID and returns true/false', async () => {
    const store = new MemoryBookmarkStore();
    const saved = await store.save({ title: 'x' });
    expect(await store.remove(saved.id)).toBe(true);
    expect(await store.remove(saved.id)).toBe(false);
    expect(await store.list()).toHaveLength(0);
  });

  it('preserves an explicit ID and createdAt', async () => {
    const store = new MemoryBookmarkStore();
    const saved = await store.save({ id: 'custom', title: 't', createdAt: 42 });
    expect((await store.list())[0]!.id).toBe('custom');
    expect((await store.list())[0]!.createdAt).toBe(42);
  });
});

describe('LocalStorageBookmarkStore (without a browser)', () => {
  // The test environment (Node) has no window.localStorage:
  // the adapter falls back to memory without failing.
  it('continues saving and listing with the memory fallback', async () => {
    const store = new LocalStorageBookmarkStore('test:key');
    await store.save({ title: 'in memory' });
    const list = await store.list();
    expect(list.map((x) => x.title)).toContain('in memory');
  });
});
