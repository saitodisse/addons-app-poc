import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createLibraryStore, LIBRARY_DATABASE } from './library-store.js';

describe('persistent source library', () => {
  it('round trips a source spanning multiple blocks, replaces it and deletes all its charts', async () => {
    const store = createLibraryStore(new IDBFactory());
    const snapshot = { root: 'https://example.test/downloads.tar.zst', charts: [
      { id: 'one', text: 'C'.repeat(3 * 1024 * 1024) },
      { id: 'two', text: 'G'.repeat(3 * 1024 * 1024) },
    ] };
    await store.put(snapshot);
    expect(await store.list()).toEqual([snapshot]);
    const replacement = { ...snapshot, charts: [{ id: 'new', text: 'Am' }] };
    await store.put(replacement);
    expect(await store.list()).toEqual([replacement]);
    await store.remove(snapshot.root);
    expect(await store.list()).toEqual([]);
  });

  it('retains snapshots saved before block storage was introduced', async () => {
    const indexedDB = new IDBFactory();
    const original = { root: 'https://example.test/old/', charts: [{ id: 'old', text: 'Dm' }] };
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(LIBRARY_DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('sources', { keyPath: 'root' });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const transaction = request.result.transaction('sources', 'readwrite');
        transaction.objectStore('sources').put(original);
        transaction.oncomplete = () => { request.result.close(); resolve(); };
      };
    });
    const store = createLibraryStore(indexedDB);
    expect(await store.list()).toEqual([original]);
    await store.put({ root: original.root, charts: [] });
    expect(await store.list()).toEqual([{ root: original.root, charts: [] }]);
    await store.clear();
    expect(await store.list()).toEqual([]);
  });

  it('preserves the previous snapshot when a replacement cannot be serialized', async () => {
    const store = createLibraryStore(new IDBFactory());
    const original = { root: 'https://example.test/', charts: [{ text: 'Em' }] };
    await store.put(original);
    await expect(store.put({ ...original, invalid: () => {} })).rejects.toThrow();
    expect(await store.list()).toEqual([original]);
  });
});
