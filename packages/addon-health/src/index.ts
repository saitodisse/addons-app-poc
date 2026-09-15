import { defineAddonManifest } from '@addons-poc/protocol';
import type { AddonTab, HostAPI, TextAddonClientPort } from '@addons-poc/protocol';
import { createTabStatePersistence } from '@addons-poc/protocol';
import { HttpTextAddonClient } from './http-client';

/**
 * Known demo servers (URL = identity, as in Stremio).
 * The health check fetches each manifest to verify availability.
 */
export const HEALTH_BASE_URLS = [
  'http://localhost:5294', // wikipedia
  'http://localhost:5304', // markdown
  'http://localhost:5306', // favorites
  'http://localhost:5307', // health
  'http://localhost:5308', // local storage
];

const HEALTH_FALLBACK_NAMES: Record<string, string> = {
  'http://localhost:5294': 'Wikipedia (summaries)',
  'http://localhost:5304': 'Markdown Add-on',
  'http://localhost:5306': 'Favorites Add-on',
  'http://localhost:5307': 'Add-on Health',
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
 * Health service: verifies the availability of each demo server by fetching
 * its manifest and measuring latency.
 *
 * Uses the degradation pattern: individual failures become `ok: false`
 * without throwing. The HTTP client is injectable for tests.
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
  name: 'Add-on Health',
  description: 'Checks the availability and latency of demo servers',
  author: 'AC Team',
  license: 'MIT',
  ui: {
    title: '💚 Add-on Health',
    body: 'Check the availability and latency of all demo servers.',
  },
  entrypoint: '/packages/addon-health/dist/bundle.js',
  services: [
    { id: 'addons.health.health-check', version: '1.0.0', name: 'Add-on Health', description: 'Availability status of demo add-ons' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [{ id: 'addons.health.health-check', role: 'provides', version: '1.0.0', description: 'Measures the availability and latency of demo servers.', methods: [{ id: 'checkAll', description: 'Fetches all configured manifests.', returns: { description: 'State of each server.', schema: { type: 'array', description: 'Availability and latency.', classification: 'public' } } }] }, { id: 'state-store', role: 'consumes', version: '1.0.0', description: 'Stores the tab’s last response when storage is available.', required: false, methods: [{ id: 'get', description: 'Reads the saved tab.' }, { id: 'set', description: 'Writes the tab.' }] }],
    ui: { fields: [], actions: [{ id: 'check', label: 'Check now', description: 'Checks all demo servers.', returns: { description: 'Check result.', schema: { type: 'array', description: 'Server availability.', classification: 'public' } } }] },
    state: [{ id: 'tab', description: 'Last check response.', key: 'health:tab', operations: ['read', 'write'], value: { description: 'Tab visual state.', schema: { type: 'object', description: 'Check response.', classification: 'public' } }, retention: 'While the storage provider selected by the host retains the state.', deletionTrigger: 'Provider cleanup or browser data removal.', fallback: 'memory' }],
    http: HEALTH_BASE_URLS.map((origin, index) => ({ id: `manifest-${index + 1}`, direction: 'outgoing', method: 'GET', origin, path: '/manifest.json', purpose: 'Checks that the server responds and measures latency.', returns: { description: 'Server manifest.', schema: { type: 'object', description: 'Remote manifest.', classification: 'public' } } })),
    logs: [{ id: 'lifecycle', level: 'info', message: 'Health add-on configured successfully', description: 'Confirms add-on activation.' }],
  },
});

export function setup(host: HostAPI): void {
  const checker = new HealthChecker(new HttpTextAddonClient(), HEALTH_BASE_URLS);
  host.registerService('addons.health.health-check', checker);
  host.log('info', 'Health add-on configured successfully');
}

export function createTab(host: HostAPI): AddonTab {
  const healthCheck = host.services.use<HealthCheckService>({ id: 'addons.health.health-check' });
  return {
    ...manifest.contract.ui,
    actions: [{ id: 'check', label: 'Check now' }],
    persistence: createTabStatePersistence(host, 'health:tab'),
    async run(actionId) {
      if (actionId !== 'check') return { status: 'error', body: 'Unknown action.' };
      if (!healthCheck) return { status: 'error', body: 'Health service unavailable.' };
      const entries = await healthCheck.checkAll();
      const online = entries.filter((entry) => entry.ok).length;
      host.log('info', 'Health check completed', { online, total: entries.length });
      return {
        status: online === entries.length ? 'success' : 'info',
        title: `${online}/${entries.length} online`,
        body: 'Result of the last check.',
        items: entries.map((entry) => ({
          label: entry.name,
          value: `${entry.baseUrl} · ${entry.ok ? `Online · ${entry.latencyMs} ms` : `Unavailable · ${entry.error ?? 'unknown error'}`}`,
        })),
      };
    },
  };
}
