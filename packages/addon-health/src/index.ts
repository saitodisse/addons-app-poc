import type { HostAPI, TextAddonClientPort } from '@addons/core';
import { HttpTextAddonClient } from '@addons/core';

/**
 * Add-ons de texto conhecidos (URL = identidade, como no Stremio).
 * O health-check consulta o manifesto de cada um para verificar disponibilidade.
 */
export const HEALTH_BASE_URLS = [
  'http://localhost:5291', // biblioteca
  'http://localhost:5292', // citações
  'http://localhost:5293', // poemas
  'http://localhost:5294', // wikipedia
];

export interface HealthEntry {
  baseUrl: string;
  ok: boolean;
  latencyMs: number | null;
  error?: string;
}

export interface HealthCheckService {
  checkAll(): Promise<HealthEntry[]>;
}

/**
 * Serviço de saúde (health-check): verifica a disponibilidade de cada add-on
 * de texto remoto buscando o manifesto e medindo a latência.
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
        try {
          await this.client.getManifest(baseUrl);
          return { baseUrl, ok: true, latencyMs: Date.now() - t0 };
        } catch (error) {
          return { baseUrl, ok: false, latencyMs: Date.now() - t0, error: (error as Error).message };
        }
      }),
    );
    void started;
    return entries;
  }
}

export const manifest = {
  id: 'health',
  version: '1.0.0',
  name: 'Health Check Add-on',
  description: 'Verifica disponibilidade e latência dos add-ons de texto remotos',
  author: 'Equipe AC',
  license: 'MIT',
  entrypoint: '/packages/addon-health/dist/bundle.js',
  services: [
    { id: 'healthCheck', version: '1.0.0', name: 'Health Check', description: 'Status de disponibilidade dos add-ons remotos' },
  ],
};

export function setup(host: HostAPI): void {
  const checker = new HealthChecker(new HttpTextAddonClient(), HEALTH_BASE_URLS);
  host.registerService('healthCheck', checker);
  host.log('info', 'Add-on health configurado com sucesso');
}
