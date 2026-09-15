import { describe, expect, it } from 'vitest';
import { createLocalStateStore, createTab } from './index';
import type { HostAPI } from '@addons-poc/protocol';

function fakeStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
  };
}

describe('Local Storage Add-on', () => {
  it('provides serializable state isolated by prefix', async () => {
    const store = createLocalStateStore(fakeStorage());
    await store.set('hello:tab', { name: 'Ana' });
    expect(await store.get('hello:tab')).toEqual({ name: 'Ana' });
  });

  it('provides complete JSON for each state so the host can reveal it on demand', async () => {
    const store = createLocalStateStore(fakeStorage());
    await store.set('hello:tab', { values: { name: 'Ana' }, response: { status: 'info', body: 'Hello, Ana!' } });
    const host = {
      services: { use: () => store },
      registerService: () => {},
      onUnload: () => {},
      log: () => {},
    } as unknown as HostAPI;

    const tab = createTab(host);
    const snapshot = await tab.getSnapshot?.();
    const result = await tab.run?.('list', {});

    expect(snapshot?.items).toEqual([
      {
        label: 'hello:tab',
        value: 'localStorage · view JSON',
        details: { values: { name: 'Ana' }, response: { status: 'info', body: 'Hello, Ana!' } },
      },
    ]);
    expect(result?.items).toEqual([
      {
        label: 'hello:tab',
        value: 'localStorage · view JSON',
        details: { values: { name: 'Ana' }, response: { status: 'info', body: 'Hello, Ana!' } },
      },
    ]);
  });
});
