import { defineAddonManifest } from '@addons-poc/protocol';
import { createTabStatePersistence } from '@addons-poc/protocol';
import type { AddonTab, HostAPI } from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Um add-on simples que saúda o usuário',
  author: 'Equipe AC',
  license: 'MIT',
  ui: {
    title: '👋 Hello',
    body: 'Digite um nome para receber uma saudação deste add-on.',
  },
  entrypoint: '/packages/addon-hello/dist/bundle.js',
  services: [
    { id: 'addons.hello.greeter', version: '1.0.0', name: 'Greeter', description: 'Serviço de saudação' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'addons.hello.greeter', role: 'provides', version: '1.0.0', description: 'Cria saudações.', methods: [{ id: 'greet', description: 'Saúda um nome.', receives: { description: 'Nome a saudar.', schema: { type: 'string', description: 'Nome a saudar.', classification: 'personal' } }, returns: { description: 'Saudação pronta.', schema: { type: 'string', description: 'Texto da saudação.', classification: 'personal' } } }] }, { id: 'state-store', role: 'consumes', version: '1.0.0', description: 'Guarda a aba quando um provedor de estado está ativo.', required: false, methods: [{ id: 'get', description: 'Lê a aba salva.' }, { id: 'set', description: 'Grava a aba.' }] }],
    ui: { fields: [{ id: 'name', label: 'Seu nome', description: 'Nome usado somente para montar a saudação.', required: true, schema: { type: 'string', description: 'Nome informado.', classification: 'personal' } }], actions: [{ id: 'greet', label: 'Saudar', description: 'Cria uma saudação para o nome informado.', receives: ['name'], returns: { description: 'Resposta exibida na aba.', schema: { type: 'object', description: 'Resposta com texto da saudação.', classification: 'personal' } } }] },
    state: [{ id: 'tab', description: 'Campos e última resposta da aba.', key: 'hello:tab', operations: ['read', 'write'], value: { description: 'Estado visual da aba.', schema: { type: 'object', description: 'Nome e resposta da aba.', classification: 'personal' } }, retention: 'Enquanto o provedor de armazenamento escolhido pelo host conservar o estado.', deletionTrigger: 'Limpeza do provedor ou dados do navegador.', fallback: 'memory' }],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Add-on hello configurado com sucesso', description: 'Confirma a ativação do add-on.' }],
  },
});

export function createGreeter() {
  return {
    greet: (name: string) => `Olá, ${name}! Seja bem-vindo ao sistema de add-ons.`,
  };
}

export function setup(host: HostAPI): void {
  host.registerService('addons.hello.greeter', createGreeter());
  host.log('info', 'Add-on hello configurado com sucesso');
}

export function createTab(host: HostAPI): AddonTab {
  const greeter = createGreeter();
  return {
    ...manifest.contract.ui,
    fields: [{ id: 'name', label: 'Seu nome', placeholder: 'Digite seu nome', required: true }],
    actions: [{ id: 'greet', label: 'Saudar' }],
    persistence: createTabStatePersistence(host, 'hello:tab'),
    run(actionId, values) {
      if (actionId !== 'greet') return { status: 'error', body: 'Ação desconhecida.' };
      const name = values.name?.trim();
      if (!name) {
        host.log('warn', 'Saudação recusada: nome ausente');
        return { status: 'error', body: 'Digite um nome primeiro.' };
      }
      const response = { status: 'success' as const, title: 'Resposta', body: greeter.greet(name) };
      host.log('info', 'Saudação criada', { name });
      return response;
    },
  };
}
