import { defineAddonManifest } from '@addons-poc/protocol';
import { BrowserStateStore } from './browser-state-store';
import type { AddonStateStore, AddonTab, HostAPI, JsonValue } from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'storage-session',
  version: '1.0.0',
  name: 'Session Storage Add-on',
  description: 'Disponibiliza persistência temporária no sessionStorage para add-ons que a solicitarem',
  author: 'Equipe AC',
  license: 'MIT',
  ui: {
    title: '⏱️ Armazenamento da sessão',
    body: 'Mantém estados somente até a aba do navegador ser encerrada.',
  },
  entrypoint: '/packages/addon-storage-session/dist/bundle.js',
  services: [
    { id: 'state-store', version: '1.0.0', name: 'Add-on State Store', description: 'Armazena estados serializáveis no sessionStorage', priority: 0 },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'state-store', role: 'provides', version: '1.0.0', description: 'Guarda estado serializável somente durante a sessão da aba.', methods: [{ id: 'get', description: 'Lê um estado por chave.' }, { id: 'set', description: 'Grava um estado por chave.' }, { id: 'remove', description: 'Remove um estado por chave.' }, { id: 'listKeys', description: 'Lista as chaves do protocolo.' }, { id: 'clear', description: 'Remove todos os estados do protocolo.' }] }],
    ui: { fields: [], actions: [{ id: 'list', label: 'Ver estados', description: 'Lista as chaves armazenadas na sessão.', returns: { description: 'Chaves salvas na sessão.', schema: { type: 'array', description: 'Estados da sessão.', classification: 'personal' } } }, { id: 'clear', label: 'Limpar estados', description: 'Apaga todos os estados do protocolo nesta sessão.', returns: { description: 'Confirmação da limpeza.', schema: { type: 'object', description: 'Resposta da limpeza.', classification: 'public' } } }] },
    state: [{ id: 'provider', description: 'Aceita qualquer chave declarada por um add-on instalado sob o prefixo físico addons:state:.', keyPattern: '*', operations: ['read', 'write', 'remove', 'list', 'clear'], value: { description: 'Valor JSON serializável de outro add-on.', schema: { type: 'object', description: 'Valor JSON armazenado.', classification: 'personal' } }, retention: 'Até a aba ser encerrada, a limpeza explícita ou a indisponibilidade do sessionStorage.', deletionTrigger: 'Fechamento da aba, ação Limpar estados, remoção pela chave ou limpeza dos dados do navegador.', fallback: 'none' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Armazenamento de sessão ativado', description: 'Informa que sessionStorage foi escolhido com prioridade 0.' }],
  },
});

export function createSessionStateStore(storage: Storage | null = typeof window === 'undefined' ? null : window.sessionStorage): AddonStateStore {
  return new BrowserStateStore(storage);
}

export function setup(host: HostAPI): void {
  host.registerService('state-store', createSessionStateStore());
  host.log('info', 'Armazenamento de sessão ativado', { storage: 'sessionStorage', priority: 0 });
}

export function createTab(host: HostAPI): AddonTab {
  const store = host.services.use<AddonStateStore>({ id: 'state-store' });
  const listStates = async () => {
    if (!store) return { status: 'error' as const, body: 'Serviço de armazenamento indisponível.' };
    const keys = await store.listKeys();
    host.log('info', 'Estados da sessão consultados', { count: keys.length });
    const states = await Promise.all(keys.map(async (key) => ({
      key,
      value: await store.get<JsonValue>(key),
    })));
    return {
      status: 'info' as const,
      title: `${keys.length} estado(s) salvo(s)`,
      body: keys.length ? 'Os estados salvos aparecem abaixo; clique em um nome para ver o JSON completo.' : 'Nenhum add-on gravou estado ainda.',
      items: states.map(({ key, value }) => ({ label: key, value: 'sessionStorage · ver JSON', details: value ?? null })),
    };
  };

  return {
    ...manifest.contract.ui,
    actions: [
      { id: 'list', label: 'Ver estados', variant: 'secondary' },
      { id: 'clear', label: 'Limpar estados', variant: 'danger' },
    ],
    getSnapshot: listStates,
    async run(actionId) {
      if (actionId === 'list') {
        return listStates();
      }
      if (actionId === 'clear') {
        if (!store) return { status: 'error', body: 'Serviço de armazenamento indisponível.' };
        await store.clear();
        host.log('warn', 'Estados da sessão removidos');
        return { status: 'success', body: 'Os estados deste protocolo foram removidos da sessão.' };
      }
      return { status: 'error', body: 'Ação desconhecida.' };
    },
  };
}
