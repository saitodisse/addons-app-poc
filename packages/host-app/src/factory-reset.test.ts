import { describe, expect, it } from 'vitest';
import { INSTALLATIONS_STORAGE_KEY, resetPersistedHostState, STATE_STORAGE_PREFIX } from './factory-reset';

class MemoryStorage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
}

describe('resetPersistedHostState', () => {
  it('remove as configurações e estados do host nos dois armazenamentos', () => {
    const localStorage = new MemoryStorage();
    const sessionStorage = new MemoryStorage();
    for (const storage of [localStorage, sessionStorage]) {
      storage.setItem(INSTALLATIONS_STORAGE_KEY, '{}');
      storage.setItem(`${STATE_STORAGE_PREFIX}host:search:results:v1`, '{}');
      storage.setItem(`${STATE_STORAGE_PREFIX}favorites:list`, '[]');
      storage.setItem('outro-aplicativo', 'preservar');
    }

    resetPersistedHostState(localStorage, sessionStorage);

    expect(localStorage.getItem(INSTALLATIONS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(`${STATE_STORAGE_PREFIX}favorites:list`)).toBeNull();
    expect(sessionStorage.getItem(`${STATE_STORAGE_PREFIX}host:search:results:v1`)).toBeNull();
    expect(localStorage.getItem('outro-aplicativo')).toBe('preservar');
    expect(sessionStorage.getItem('outro-aplicativo')).toBe('preservar');
  });

  it('aceita armazenamento ausente', () => {
    expect(() => resetPersistedHostState(null, undefined)).not.toThrow();
  });
});
