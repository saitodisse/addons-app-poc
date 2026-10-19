export const LIBRARY_DATABASE = 'addons:state:chord-catalog:v1';

/** One transaction replaces a source; small records avoid Chromium's per-value limit. */
export function createLibraryStore(indexedDB = globalThis.indexedDB) {
  let database;
  const open = () => database ??= new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('Persistent storage is unavailable in this browser.')); return; }
    const request = indexedDB.open(LIBRARY_DATABASE, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('sources')) request.result.createObjectStore('sources', { keyPath: 'root' });
      const chunks = request.result.createObjectStore('chunks', { keyPath: ['root', 'index'] });
      chunks.createIndex('root', 'root');
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other catalogue tabs to open persistent storage.'));
  });
  async function execute(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['sources', 'chunks'], mode);
      let result;
      transaction.oncomplete = () => { try { resolve(result?.()); } catch (error) { reject(error); } };
      transaction.onerror = () => reject(transaction.error ?? new Error('Library transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Library write aborted.'));
      try { result = operation(transaction.objectStore('sources'), transaction.objectStore('chunks')); }
      catch (error) { transaction.abort(); reject(error); }
    });
  }
  function replace(root, snapshot) {
    const parts = [];
    let charts = [];
    let size = 0;
    for (const chart of snapshot?.charts ?? []) {
      const bytes = JSON.stringify(chart).length * 2;
      if (charts.length && size + bytes > 8 * 1024 * 1024) { parts.push(charts); charts = []; size = 0; }
      charts.push(chart);
      size += bytes;
    }
    if (charts.length) parts.push(charts);
    return execute('readwrite', (sources, chunks) => {
      const cursor = chunks.index('root').openKeyCursor(root);
      cursor.onsuccess = () => {
        if (cursor.result) { chunks.delete(cursor.result.primaryKey); cursor.result.continue(); return; }
        if (snapshot) {
          const { charts: ignored, ...metadata } = snapshot;
          sources.put({ ...metadata, chunkCount: parts.length });
          parts.forEach((charts, index) => chunks.put({ root, index, charts }));
        } else sources.delete(root);
      };
    });
  }
  return {
    list: () => execute('readonly', (sources, chunks) => {
      const records = sources.getAll();
      const parts = chunks.getAll();
      return () => {
        const grouped = new Map();
        for (const part of parts.result) {
          if (!grouped.has(part.root)) grouped.set(part.root, []);
          grouped.get(part.root)[part.index] = part.charts;
        }
        return records.result.map((source) => {
          if (source.chunkCount === undefined) return source;
          const { chunkCount, ...metadata } = source;
          const blocks = grouped.get(source.root) ?? [];
          if (blocks.length !== chunkCount || Array.from({ length: chunkCount }, (_, index) => blocks[index]).some((block) => !block)) throw new Error('Incomplete stored chart library.');
          return { ...metadata, charts: blocks.flat() };
        });
      };
    }),
    put: (snapshot) => replace(snapshot.root, snapshot),
    remove: (root) => replace(root),
    clear: () => execute('readwrite', (sources, chunks) => { sources.clear(); chunks.clear(); }),
  };
}
