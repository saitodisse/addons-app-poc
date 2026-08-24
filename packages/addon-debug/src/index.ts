import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonTab, DebugEntry, DebugLog, HostAPI } from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'debug',
  version: '1.0.0',
  name: 'Debug Add-on',
  description: 'Exibe eventos detalhados emitidos pelas extensões ativas',
  author: 'Equipe AC',
  license: 'MIT',
  ui: {
    title: '🐞 Debug',
    body: 'Acompanhe em tempo real a execução reportada pelas extensões ativas.',
  },
  entrypoint: '/packages/addon-debug/dist/bundle.js',
  services: [
    { id: 'addons.debug.log', version: '1.0.0', name: 'Debug Log', description: 'Registra eventos estruturados das extensões', priority: 100 },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'addons.debug.log', role: 'provides', version: '1.0.0', description: 'Registra, lista, limpa e observa eventos estruturados.', methods: [{ id: 'record', description: 'Registra um evento.' }, { id: 'list', description: 'Lista os eventos recentes.' }, { id: 'clear', description: 'Remove eventos.' }, { id: 'subscribe', description: 'Observa alterações no log.' }] }],
    ui: { fields: [], actions: [{ id: 'clear', label: 'Limpar eventos', description: 'Remove os eventos mantidos em memória.', returns: { description: 'Confirmação da limpeza.', schema: { type: 'object', description: 'Resposta da limpeza.', classification: 'public' } } }] },
    state: [],
    http: [],
    logs: [{ id: 'lifecycle', level: 'info', message: 'Depuração verbosa ativada', description: 'Confirma a ativação do coletor de eventos.' }],
  },
});

export function createDebugLog(limit = 200): DebugLog {
  const entries: DebugEntry[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    record(entry) {
      entries.unshift(entry);
      if (entries.length > limit) entries.length = limit;
      notify();
    },
    list: () => [...entries],
    clear() {
      entries.length = 0;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function formatDetails(details: unknown): string {
  if (details == null) return '';
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

function snapshot(log: DebugLog) {
  const entries = log.list();
  return {
    status: 'info' as const,
    title: `${entries.length} evento(s)`,
    body: entries.length ? 'Eventos mais recentes primeiro.' : 'Ainda não há eventos. Execute uma ação em outra extensão.',
    items: entries.map((entry) => ({
      label: `${new Date(entry.timestamp).toLocaleTimeString('pt-BR')} · ${entry.level.toUpperCase()} · ${entry.addonId}`,
      value: `${entry.message}${formatDetails(entry.details) ? `\n${formatDetails(entry.details)}` : ''}`,
    })),
  };
}

export function setup(host: HostAPI): void {
  host.registerService('addons.debug.log', createDebugLog(), 100);
  host.log('info', 'Depuração verbosa ativada');
}

export function createTab(host: HostAPI): AddonTab {
  const log = host.services.use<DebugLog>({ id: 'addons.debug.log' });
  return {
    ...manifest.contract.ui,
    actions: [{ id: 'clear', label: 'Limpar eventos', variant: 'danger' }],
    getSnapshot: () => log ? snapshot(log) : { status: 'error', body: 'Serviço de debug indisponível.' },
    subscribe: (listener) => log?.subscribe(listener) ?? (() => {}),
    run(actionId) {
      if (!log) return { status: 'error', body: 'Serviço de debug indisponível.' };
      if (actionId === 'clear') {
        log.clear();
        return { status: 'success', body: 'Eventos removidos.' };
      }
      return { status: 'error', body: 'Ação desconhecida.' };
    },
  };
}
