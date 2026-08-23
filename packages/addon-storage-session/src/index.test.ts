import { describe, expect, it } from 'vitest';
import { createSessionStateStore } from './index';

function fakeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
  };
}

describe('Session Storage Add-on', () => {
  it('oferece um estado serializável', async () => {
    const store = createSessionStateStore(fakeStorage());
    await store.set('aggregator:history', ['poesia']);
    expect(await store.get('aggregator:history')).toEqual(['poesia']);
  });
});
