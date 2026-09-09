import { describe, expect, it } from 'vitest';
import type { AddonStateStore, HostAPI } from '@addons-poc/protocol';
import { createTab, setup } from './index';

function createHost(initialValue: number) {
  let storedValue = initialValue;
  let counter: {
    increment: () => Promise<number>;
  } | undefined;

  const stateStore: AddonStateStore = {
    get: async (key) => key === 'counter:value' ? storedValue : undefined,
    set: async (key, value) => {
      if (key === 'counter:value') storedValue = value as number;
    },
    remove: async () => {},
    listKeys: async () => [],
    clear: async () => {},
  };

  const host = {
    services: {
      use: <T,>({ id }: { id: string }) => {
        if (id === 'state-store') {
          // O host cria uma mediação nova a cada consulta. O add-on não deve
          // interpretar a identidade dessa ponte como um novo armazenamento.
          return {
            get: stateStore.get,
            set: stateStore.set,
            remove: stateStore.remove,
            listKeys: stateStore.listKeys,
            clear: stateStore.clear,
          } as T;
        }
        return counter as T;
      },
    },
    registerService: (_id: string, service: unknown) => {
      counter = service as typeof counter;
    },
    onUnload: () => {},
    log: () => {},
  } as unknown as HostAPI;

  return { host, readValue: () => storedValue };
}

describe('Counter Add-on', () => {
  it('não relê o valor antigo quando a mediação cria uma ponte nova', async () => {
    const { host, readValue } = createHost(1);
    setup(host);
    const tab = createTab(host);

    expect((await tab.run?.('increment', {}))?.body).toBe('2');
    expect(readValue()).toBe(2);
    expect((await tab.run?.('increment', {}))?.body).toBe('3');
    expect(readValue()).toBe(3);
  });
});
