import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonTab, HostAPI, TextAddonClientPort } from '@addons-poc/protocol';
import { createTabStatePersistence } from '@addons-poc/protocol';
import { HttpTextAddonClient } from './http-client';

/**
 * Servidores da demonstração conhecidos (URL = identidade, como no Stremio).
 * O health-check consulta o manifesto de cada um para verificar disponibilidade.
 */
export const HEALTH_BASE_URLS = [
  'http://localhost:5294', // wikipedia
  'http://localhost:5304', // markdown
  'http://localhost:5306', // favoritos
  'http://localhost:5307', // saúde
  'http://localhost:5308', // armazenamento local
];

const HEALTH_FALLBACK_NAMES: Record<string, string> = {
  'http://localhost:5294': 'Wikipédia (resumos)',
  'http://localhost:5304': 'Markdown Add-on',
  'http://localhost:5306': 'Favorites Add-on',
  'http://localhost:5307': 'Saúde dos Add-ons',
  'http://localhost:5308': 'Local Storage Add-on',
};

export interface HealthEntry {
  name: string;
  baseUrl: string;
  ok: boolean;
  latencyMs: number | null;
  error?: string;
}

export interface HealthCheckService {
  checkAll(): Promise<HealthEntry[]>;
}

/**
 * Serviço de saúde (health-check): verifica a disponibilidade de cada servidor
 * da demonstração buscando o manifesto e medindo a latência.
 *
 * Implementa o padrão de degradação: falhas individuais viram `ok: false`
 * sem lançar erro. O cliente HTTP é injetável para testes.
 */
export class HealthChecker implements HealthCheckService {
  constructor(
    private client: TextAddonClientPort,
    private baseUrls: string[] = HEALTH_BASE_URLS,
  ) {}

  async checkAll(): Promise<HealthEntry[]> {
    const started = Date.now();
    const entries = await Promise.all(
      this.baseUrls.map(async (baseUrl) => {
        const t0 = Date.now();
        const fallbackName = HEALTH_FALLBACK_NAMES[baseUrl] ?? baseUrl;
        try {
          const remoteManifest = await this.client.getManifest(baseUrl);
          return { name: remoteManifest.name || fallbackName, baseUrl, ok: true, latencyMs: Date.now() - t0 };
        } catch (error) {
          return { name: fallbackName, baseUrl, ok: false, latencyMs: Date.now() - t0, error: (error as Error).message };
        }
      }),
    );
    void started;
    return entries;
  }
}

export const manifest = defineAddonManifest({
  id: 'health',
  version: '1.0.0',
  name: 'Saúde dos Add-ons',
  description: 'Verifica disponibilidade e latência dos servidores da demonstração',
  author: 'Equipe AC',
  license: 'MIT',
  ui: {
    title: '💚 Saúde dos Add-ons',
    body: 'Verifique disponibilidade e latência de todos os servidores da demonstração.',
  },
  entrypoint: '/packages/addon-health/dist/bundle.js',
  services: [
    { id: 'addons.health.health-check', version: '1.0.0', name: 'Saúde dos Add-ons', description: 'Status de disponibilidade dos add-ons da demonstração' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'addons.health.health-check', role: 'provides', version: '1.0.0', description: 'Mede disponibilidade e latência dos servidores da demonstração.', methods: [{ id: 'checkAll', description: 'Consulta todos os manifestos configurados.', returns: { description: 'Estado de cada servidor.', schema: { type: 'array', description: 'Disponibilidade e latência.', classification: 'public' } } }] }, { id: 'state-store', role: 'consumes', version: '1.0.0', description: 'Guarda a última resposta da aba quando há armazenamento.', required: false, methods: [{ id: 'get', description: 'Lê a aba salva.' }, { id: 'set', description: 'Grava a aba.' }] }],
    ui: { fields: [], actions: [{ id: 'check', label: 'Verificar agora', description: 'Verifica todos os servidores da demonstração.', returns: { description: 'Resultado da verificação.', schema: { type: 'array', description: 'Disponibilidade dos servidores.', classification: 'public' } } }] },
    state: [{ id: 'tab', description: 'Última resposta da verificação.', key: 'health:tab', operations: ['read', 'write'], value: { description: 'Estado visual da aba.', schema: { type: 'object', description: 'Resposta da verificação.', classification: 'public' } }, retention: 'Enquanto o provedor de armazenamento escolhido pelo host conservar o estado.', deletionTrigger: 'Limpeza do provedor ou dados do navegador.', fallback: 'memory' }],
    http: HEALTH_BASE_URLS.map((origin, index) => ({ id: `manifest-${index + 1}`, direction: 'outgoing', method: 'GET', origin, path: '/manifest.json', purpose: 'Confere se o servidor responde e mede a latência.', returns: { description: 'Manifesto do servidor.', schema: { type: 'object', description: 'Manifesto remoto.', classification: 'public' } } })),
    logs: [{ id: 'lifecycle', level: 'info', message: 'Add-on health configurado com sucesso', description: 'Confirma a ativação do add-on.' }],
  },
});

export function setup(host: HostAPI): void {
  const checker = new HealthChecker(new HttpTextAddonClient(), HEALTH_BASE_URLS);
  host.registerService('addons.health.health-check', checker);
  host.log('info', 'Add-on health configurado com sucesso');
}

export function createTab(host: HostAPI): AddonTab {
  const healthCheck = host.services.use<HealthCheckService>({ id: 'addons.health.health-check' });
  return {
    ...manifest.contract.ui,
    actions: [{ id: 'check', label: 'Verificar agora' }],
    persistence: createTabStatePersistence(host, 'health:tab'),
    async run(actionId) {
      if (actionId !== 'check') return { status: 'error', body: 'Ação desconhecida.' };
      if (!healthCheck) return { status: 'error', body: 'Serviço de saúde indisponível.' };
      const entries = await healthCheck.checkAll();
      const online = entries.filter((entry) => entry.ok).length;
      host.log('info', 'Verificação de saúde concluída', { online, total: entries.length });
      return {
        status: online === entries.length ? 'success' : 'info',
        title: `${online}/${entries.length} online`,
        body: 'Resultado da última verificação.',
        items: entries.map((entry) => ({
          label: entry.name,
          value: `${entry.baseUrl} · ${entry.ok ? `Online · ${entry.latencyMs} ms` : `Indisponível · ${entry.error ?? 'erro desconhecido'}`}`,
        })),
      };
    },
  };
}
