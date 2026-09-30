export const LIBRARY_DATABASE = 'addons:state:chord-catalog:v1';

/** One IndexedDB transaction replaces one source's last successful snapshot. */
export function createLibraryStore(indexedDB = globalThis.indexedDB) {
  let database;
  const open = () => database ??= new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('Persistent storage is unavailable in this browser.')); return; }
    const request = indexedDB.open(LIBRARY_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sources', { keyPath: 'root' });
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
      const transaction = db.transaction('sources', mode);
      const request = operation(transaction.objectStore('sources'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? request.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Library write aborted.'));
    });
  }
  return {
    list: () => execute('readonly', (store) => store.getAll()),
    put: (snapshot) => execute('readwrite', (store) => store.put(snapshot)),
    remove: (root) => execute('readwrite', (store) => store.delete(root)),
    clear: () => execute('readwrite', (store) => store.clear()),
  };
}
