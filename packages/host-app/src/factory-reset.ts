export const INSTALLATIONS_STORAGE_KEY = 'addons:host-installations:v1';
export const STATE_STORAGE_PREFIX = 'addons:state:';

interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

function clearHostKeys(storage: StorageLike | null | undefined): void {
  if (!storage) return;

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key === INSTALLATIONS_STORAGE_KEY || key?.startsWith(STATE_STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) storage.removeItem(key);
  } catch {
    // Blocked storage must not prevent the in-memory reset from finishing.
  }
}

/** Removes only host settings and protocol-owned state. */
export function resetPersistedHostState(
  localStorage: StorageLike | null | undefined,
  sessionStorage: StorageLike | null | undefined,
): void {
  clearHostKeys(localStorage);
  clearHostKeys(sessionStorage);
}

/** Runs the reset in the browser without deleting data from other applications. */
export function resetFactoryStorage(): void {
  if (typeof window === 'undefined') return;

  let localStorage: Storage | null = null;
  let sessionStorage: Storage | null = null;
  try {
    localStorage = window.localStorage;
  } catch {
    /* local storage unavailable */
  }
  try {
    sessionStorage = window.sessionStorage;
  } catch {
    /* session storage unavailable */
  }
  resetPersistedHostState(localStorage, sessionStorage);
}
