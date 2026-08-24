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
  it('oferece um estado serializável isolado por prefixo', async () => {
    const store = createLocalStateStore(fakeStorage());
    await store.set('hello:tab', { name: 'Ana' });
    expect(await store.get('hello:tab')).toEqual({ name: 'Ana' });
  });

  it('entrega o JSON completo de cada estado para o host revelar sob demanda', async () => {
    const store = createLocalStateStore(fakeStorage());
    await store.set('hello:tab', { values: { name: 'Ana' }, response: { status: 'info', body: 'Olá, Ana!' } });
    const host = {
      services: { use: () => store },
      registerService: () => {},
      onUnload: () => {},
      log: () => {},
    } as unknown as HostAPI;

    const result = await createTab(host).run?.('list', {});

    expect(result?.items).toEqual([
      {
        label: 'hello:tab',
        value: 'localStorage · ver JSON',
        details: { values: { name: 'Ana' }, response: { status: 'info', body: 'Olá, Ana!' } },
      },
    ]);
  });
});
