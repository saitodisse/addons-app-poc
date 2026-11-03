export const INSTALLATIONS_STORAGE_KEY = 'addons:host-installations:v1';
export const STATE_STORAGE_PREFIX = 'addons:state:';

interface StorageLike {
  clear(): void;
}

const DATABASE_DELETE_TIMEOUT_MS = 8_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function deleteDatabase(factory: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      finish(new Error(`IndexedDB database "${name}" is still open. Close other PeekMosaic tabs and retry.`));
    }, DATABASE_DELETE_TIMEOUT_MS);

    let request: IDBOpenDBRequest;
    try {
      request = factory.deleteDatabase(name);
    } catch (error) {
      finish(new Error(errorMessage(error)));
      return;
    }
    request.onsuccess = () => finish();
    request.onerror = () => finish(request.error ?? new Error(`Could not delete IndexedDB database "${name}".`));
    // Another tab can keep this database open. Wait for its versionchange handler
    // to close it, then fail with a useful message if the tab stays open.
    request.onblocked = () => {};
  });
}

async function deleteIndexedDatabases(factory: IDBFactory): Promise<void> {
  if (typeof factory.databases !== 'function') {
    throw new Error('This browser cannot list every IndexedDB database. Update the browser and retry.');
  }
  const databases = await factory.databases();
  const names = databases.map((database) => database.name);
  if (names.some((name) => !name)) {
    throw new Error('The browser returned an IndexedDB database without a name, so it could not be deleted safely.');
  }
  await Promise.all(names.map((name) => deleteDatabase(factory, name!)));
}

async function clearCaches(cacheStorage: CacheStorage): Promise<void> {
  const names = await cacheStorage.keys();
  await Promise.all(names.map((name) => cacheStorage.delete(name)));
}

async function unregisterServiceWorkers(container: ServiceWorkerContainer): Promise<void> {
  const registrations = await container.getRegistrations();
  const results = await Promise.allSettled(registrations.map((registration) => registration.unregister()));
  const failures = results.flatMap((result) => result.status === 'rejected' ? [errorMessage(result.reason)] : []);
  if (failures.length) throw new Error(failures.join('; '));
}

/** Removes every key from the same-origin local and session storage areas. */
export function resetPersistedHostState(
  localStorage: StorageLike | null | undefined,
  sessionStorage: StorageLike | null | undefined,
): void {
  localStorage?.clear();
  sessionStorage?.clear();
}

/** Clears persistent data owned by this site, including add-on databases and offline storage. */
export async function resetFactoryStorage(): Promise<void> {
  if (typeof window === 'undefined') return;

  const failures: string[] = [];
  const attempt = async (area: string, operation: () => void | Promise<void>) => {
    try {
      await operation();
    } catch (error) {
      failures.push(`${area}: ${errorMessage(error)}`);
    }
  };

  await attempt('service workers', async () => {
    if ('serviceWorker' in navigator) await unregisterServiceWorkers(navigator.serviceWorker);
  });
  await attempt('IndexedDB', async () => {
    if (window.indexedDB) await deleteIndexedDatabases(window.indexedDB);
  });
  await attempt('localStorage', () => window.localStorage.clear());
  await attempt('sessionStorage', () => window.sessionStorage.clear());
  await attempt('offline caches', async () => {
    if ('caches' in window) await clearCaches(window.caches);
  });

  if (failures.length) {
    throw new Error(`Factory reset could not clear all local data. ${failures.join(' ')}`);
  }
}
