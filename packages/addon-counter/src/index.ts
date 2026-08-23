import { createTabStatePersistence } from '@addons/core';
import type { AddonStateStore, AddonTab, HostAPI } from '@addons/core';

export const manifest = {
  id: 'counter',
  version: '1.0.0',
  name: 'Counter Add-on',
  description: 'Um add-on simples de contador',
  author: 'Equipe AC',
  license: 'MIT',
  tab: {
    title: '🔢 Contador',
    body: 'Altere o valor mantido por este add-on durante a sessão.',
  },
  entrypoint: '/packages/addon-counter/dist/bundle.js',
  services: [
    { id: 'counter', version: '1.0.0', name: 'Counter', description: 'Serviço de contagem' },
  ],
  interactions: {
    version: '1.0.0',
    services: [{ id: 'counter', role: 'provides', description: 'Lê e altera um contador.', methods: [{ id: 'increment', description: 'Soma um.', returns: { description: 'Valor atualizado.', schema: { type: 'number', description: 'Valor do contador.', classification: 'public' } } }, { id: 'decrement', description: 'Subtrai um.', returns: { description: 'Valor atualizado.', schema: { type: 'number', description: 'Valor do contador.', classification: 'public' } } }, { id: 'reset', description: 'Zera o contador.', returns: { description: 'Valor atualizado.', schema: { type: 'number', description: 'Valor do contador.', classification: 'public' } } }, { id: 'getValue', description: 'Lê o contador.', returns: { description: 'Valor atual.', schema: { type: 'number', description: 'Valor do contador.', classification: 'public' } } }] }, { id: 'addonStateStore', role: 'consumes', description: 'Restaura e grava o contador quando há armazenamento.', required: false, methods: [{ id: 'get', description: 'Lê o valor salvo.' }, { id: 'set', description: 'Grava o valor atualizado.' }] }],
    tab: { fields: [], actions: [{ id: 'decrement', label: '−1', description: 'Subtrai um do contador.', returns: { description: 'Resposta com o valor atual.', schema: { type: 'object', description: 'Valor do contador.', classification: 'public' } } }, { id: 'increment', label: '+1', description: 'Soma um ao contador.', returns: { description: 'Resposta com o valor atual.', schema: { type: 'object', description: 'Valor do contador.', classification: 'public' } } }, { id: 'reset', label: 'Zerar', description: 'Zera o contador.', returns: { description: 'Resposta com o valor atual.', schema: { type: 'object', description: 'Valor do contador.', classification: 'public' } } }] },
    state: [{ id: 'value', description: 'Valor numérico do contador.', key: 'counter:value', operations: ['read', 'write'], value: { description: 'Valor salvo.', schema: { type: 'number', description: 'Valor do contador.', classification: 'public' } }, retention: 'Enquanto o provedor de armazenamento escolhido pelo host conservar o estado.', deletionTrigger: 'Limpeza do provedor ou dados do navegador.', fallback: 'memory' }, { id: 'tab', description: 'Última resposta da aba.', key: 'counter:tab', operations: ['read', 'write'], value: { description: 'Estado visual da aba.', schema: { type: 'object', description: 'Resposta da aba.', classification: 'public' } }, retention: 'Enquanto o provedor conservar o estado.', deletionTrigger: 'Limpeza do provedor ou dados do navegador.', fallback: 'memory' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Add-on counter configurado com sucesso', description: 'Confirma a ativação do add-on.' }],
  },
};

export function setup(host: HostAPI): void {
  let value = 0;
  let restoredStore: AddonStateStore | undefined;

  const sync = async () => {
    const store = host.services.get<AddonStateStore>('addonStateStore');
    if (!store || store === restoredStore) return store;
    value = (await store.get<number>('counter:value')) ?? value;
    restoredStore = store;
    host.log('info', 'Estado do contador restaurado', { value });
    return store;
  };

  const update = async (next: number) => {
    value = next;
    const store = await sync();
    await store?.set('counter:value', value);
    return value;
  };

  host.registerService('counter', {
    increment: async () => {
      await sync();
      return update(value + 1);
    },
    decrement: async () => {
      await sync();
      return update(value - 1);
    },
    getValue: async () => {
      await sync();
      return value;
    },
    reset: async () => {
      await sync();
      return update(0);
    },
  });

  host.onUnload(() => {
    value = 0;
  });

  host.log('info', 'Add-on counter configurado com sucesso');
}

export function createTab(host: HostAPI): AddonTab {
  const counter = host.services.get<{
    increment: () => Promise<number>;
    decrement: () => Promise<number>;
    getValue: () => Promise<number>;
    reset: () => Promise<number>;
  }>('counter');

  return {
    ...manifest.tab,
    actions: [
      { id: 'decrement', label: '−1', variant: 'secondary' },
      { id: 'increment', label: '+1' },
      { id: 'reset', label: 'Zerar', variant: 'secondary' },
    ],
    persistence: createTabStatePersistence(host, 'counter:tab'),
    async run(actionId) {
      if (!counter) return { status: 'error', body: 'Serviço de contador indisponível.' };
      const value = actionId === 'increment'
        ? await counter.increment()
        : actionId === 'decrement'
          ? await counter.decrement()
          : actionId === 'reset'
            ? await counter.reset()
            : null;
      if (value === null) return { status: 'error', body: 'Ação desconhecida.' };
      host.log('info', 'Contador atualizado', { actionId, value });
      return {
        status: 'success',
        title: 'Valor atual',
        body: String(value),
        items: [{ label: 'Estado', value: value === 0 ? 'Neutro' : value > 0 ? 'Positivo' : 'Negativo' }],
      };
    },
  };
}
