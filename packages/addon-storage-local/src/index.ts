import { defineAddonManifest } from '@addons-poc/protocol';
import { BrowserStateStore } from './browser-state-store';
import type { AddonStateStore, AddonTab, HostAPI, JsonValue } from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'storage-local',
  version: '1.0.0',
  name: 'Local Storage Add-on',
  description: 'Disponibiliza persistência durável no localStorage para add-ons que a solicitarem',
  author: 'Equipe AC',
  license: 'MIT',
  ui: {
    title: '💾 Armazenamento local',
    body: 'Mantém os estados dos add-ons neste navegador mesmo após fechar a janela.',
  },
  entrypoint: '/packages/addon-storage-local/dist/bundle.js',
  services: [
    { id: 'state-store', version: '1.0.0', name: 'Add-on State Store', description: 'Armazena estados serializáveis no localStorage', priority: 10 },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'state-store', role: 'provides', version: '1.0.0', description: 'Guarda estado serializável no localStorage deste navegador.', methods: [{ id: 'get', description: 'Lê um estado por chave.' }, { id: 'set', description: 'Grava um estado por chave.' }, { id: 'remove', description: 'Remove um estado por chave.' }, { id: 'listKeys', description: 'Lista as chaves do protocolo.' }, { id: 'clear', description: 'Remove todos os estados do protocolo.' }] }],
    ui: { fields: [], actions: [{ id: 'list', label: 'Ver estados', description: 'Lista chaves e permite consultar o JSON salvo.', returns: { description: 'Chaves e valores JSON salvos.', schema: { type: 'array', description: 'Estados armazenados.', classification: 'personal' } } }, { id: 'clear', label: 'Limpar estados', description: 'Apaga todos os estados do protocolo neste navegador.', returns: { description: 'Confirmação da limpeza.', schema: { type: 'object', description: 'Resposta da limpeza.', classification: 'public' } } }] },
    state: [{ id: 'provider', description: 'Aceita qualquer chave declarada por um add-on instalado sob o prefixo físico addons:state:.', keyPattern: '*', operations: ['read', 'write', 'remove', 'list', 'clear'], value: { description: 'Valor JSON serializável de outro add-on.', schema: { type: 'object', description: 'Valor JSON armazenado.', classification: 'personal' } }, retention: 'Até a limpeza explícita, remoção dos dados do navegador ou indisponibilidade do localStorage.', deletionTrigger: 'Ação Limpar estados, remoção pela chave ou limpeza dos dados do navegador.', fallback: 'none' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Armazenamento local ativado', description: 'Informa que localStorage foi escolhido com prioridade 10.' }],
  },
});

export function createLocalStateStore(storage: Storage | null = typeof window === 'undefined' ? null : window.localStorage): AddonStateStore {
  return new BrowserStateStore(storage);
}

export function setup(host: HostAPI): void {
  host.registerService('state-store', createLocalStateStore(), 10);
  host.log('info', 'Armazenamento local ativado', { storage: 'localStorage', priority: 10 });
}

export function createTab(host: HostAPI): AddonTab {
  const store = host.services.use<AddonStateStore>({ id: 'state-store' });
  return {
    ...manifest.contract.ui,
    actions: [
      { id: 'list', label: 'Ver estados', variant: 'secondary' },
      { id: 'clear', label: 'Limpar estados', variant: 'danger' },
    ],
    async run(actionId) {
      if (!store) return { status: 'error', body: 'Serviço de armazenamento indisponível.' };
      if (actionId === 'list') {
        const keys = await store.listKeys();
        host.log('info', 'Estados locais consultados', { count: keys.length });
        const states = await Promise.all(keys.map(async (key) => ({
          key,
          value: await store.get<JsonValue>(key),
        })));
        return {
          status: 'info',
          title: `${keys.length} estado(s) salvo(s)`,
          body: keys.length ? 'Clique no nome de um estado para ver o JSON completo salvo no localStorage.' : 'Nenhum add-on gravou estado ainda.',
          items: states.map(({ key, value }) => ({ label: key, value: 'localStorage · ver JSON', details: value ?? null })),
        };
      }
      if (actionId === 'clear') {
        await store.clear();
        host.log('warn', 'Estados locais removidos');
        return { status: 'success', body: 'Os estados deste protocolo foram removidos do localStorage.' };
      }
      return { status: 'error', body: 'Ação desconhecida.' };
    },
  };
}
