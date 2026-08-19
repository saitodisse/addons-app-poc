import type { HostAPI, TextAddonClientPort, SearchProvider } from '@addons/core';
import { HttpTextAddonClient } from '@addons/core';

/**
 * Add-ons de texto conhecidos (URL = identidade, como no Stremio).
 * O agregador consulta todos e mescla os resultados com tolerância a falhas.
 */
export const DEFAULT_BASE_URLS = [
  'http://localhost:5291', // biblioteca
  'http://localhost:5292', // citações
  'http://localhost:5293', // poemas
  'http://localhost:5294', // wikipedia
];

/**
 * Serviço de busca agregada (meta-search): consulta vários add-ons de texto
 * remotos em paralelo e mescla os resultados, tolerando falhas individuais.
 *
 * Implementa `SearchProvider` do núcleo. O cliente HTTP é injetável para testes.
 */
export class SearchAggregator implements SearchProvider {
  constructor(
    private client: TextAddonClientPort,
    private baseUrls: string[] = DEFAULT_BASE_URLS,
    private type = 'text',
  ) {}

  /** Busca em todos os add-ons conhecidos e mescla os resultados. */
  async search(query: string, limit = 20): Promise<{ title: string; snippet?: string }[]> {
    const settled = await Promise.allSettled(
      this.baseUrls.map((baseUrl) =>
        this.client.search(baseUrl, this.type, query).then((p) => p.metas),
      ),
    );

    const seen = new Set<string>();
    const results: { title: string; snippet?: string }[] = [];
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue; // degradação: ignora falhas
      for (const meta of outcome.value) {
        if (seen.has(meta.id)) continue;
        seen.add(meta.id);
        results.push({
          title: meta.name,
          snippet: meta.description ?? meta.author,
        });
        if (results.length >= limit) return results;
      }
    }
    return results;
  }
}

export const manifest = {
  id: 'aggregator',
  version: '1.0.0',
  name: 'Aggregator Add-on',
  description: 'Meta-search: busca em vários add-ons de texto remotos com tolerância a falhas',
  author: 'Equipe AC',
  license: 'MIT',
  entrypoint: '/packages/addon-aggregator/dist/bundle.js',
  services: [
    { id: 'searchProvider', version: '1.0.0', name: 'Search Provider', description: 'Busca agregada entre add-ons de texto' },
  ],
};

export function setup(host: HostAPI): void {
  const aggregator = new SearchAggregator(new HttpTextAddonClient(), DEFAULT_BASE_URLS);
  host.registerService('searchProvider', aggregator);
  host.log('info', 'Add-on aggregator configurado com sucesso');
}
