import { describe, expect, it } from 'vitest';
import { BrowserStateStore } from './browser-state-store';

function fakeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe('BrowserStateStore', () => {
  it('isola, lista e remove apenas as chaves do protocolo', async () => {
    const storage = fakeStorage();
    storage.setItem('externo', 'preservado');
    const store = new BrowserStateStore(storage);

    await store.set('hello:tab', { name: 'Ana' });
    expect(await store.get<{ name: string }>('hello:tab')).toEqual({ name: 'Ana' });
    expect(await store.listKeys()).toEqual(['hello:tab']);

    await store.clear();
    expect(await store.get('hello:tab')).toBeUndefined();
    expect(storage.getItem('externo')).toBe('preservado');
  });
});
