import { describe, expect, it } from 'vitest';
import { createSessionStateStore, createTab } from './index';
import type { HostAPI } from '@addons-poc/protocol';

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

  it('lista automaticamente os estados com detalhes do JSON', async () => {
    const store = createSessionStateStore(fakeStorage());
    await store.set('aggregator:history', ['poesia']);
    const host = {
      services: { use: () => store },
      registerService: () => {},
      onUnload: () => {},
      log: () => {},
    } as unknown as HostAPI;

    const snapshot = await createTab(host).getSnapshot?.();

    expect(snapshot?.items).toEqual([
      { label: 'aggregator:history', value: 'sessionStorage · ver JSON', details: ['poesia'] },
    ]);
  });
});
