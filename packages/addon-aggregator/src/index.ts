import type { AddonStateStore, AddonTab, HostAPI, TextAddonClientPort, SearchProvider } from '@addons/core';
import { createTabStatePersistence, HttpTextAddonClient } from '@addons/core';

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
  tab: {
    title: '🔎 Busca agregada',
    body: 'Consulta os add-ons de texto disponíveis e reúne seus resultados.',
  },
  entrypoint: '/packages/addon-aggregator/dist/bundle.js',
  services: [
    { id: 'searchProvider', version: '1.0.0', name: 'Search Provider', description: 'Busca agregada entre add-ons de texto' },
  ],
  interactions: {
    version: '1.0.0',
    services: [{ id: 'searchProvider', role: 'provides', description: 'Busca em provedores de texto e reúne resultados.', methods: [{ id: 'search', description: 'Busca por termo.', receives: { description: 'Termo e limite da busca.', schema: { type: 'object', description: 'Parâmetros da busca.', classification: 'personal', properties: { query: { type: 'string', description: 'Termo buscado.', classification: 'personal' } }, required: ['query'] } }, returns: { description: 'Resultados de texto.', schema: { type: 'array', description: 'Resultados mesclados.', classification: 'personal' } } }] }, { id: 'addonStateStore', role: 'consumes', description: 'Mantém o histórico quando um provedor de estado está ativo.', required: false, methods: [{ id: 'get', description: 'Lê o histórico.' }, { id: 'set', description: 'Grava ou limpa o histórico.' }] }],
    tab: { fields: [{ id: 'query', label: 'Termo de busca', description: 'Termo enviado aos provedores de texto.', required: true, schema: { type: 'string', description: 'Termo buscado.', classification: 'personal' } }], actions: [{ id: 'search', label: 'Buscar', description: 'Consulta os quatro provedores de texto.', receives: ['query'], returns: { description: 'Lista de resultados encontrados.', schema: { type: 'array', description: 'Resultados de busca.', classification: 'personal' } } }, { id: 'history', label: 'Histórico', description: 'Lê os termos buscados anteriormente.', returns: { description: 'Histórico de termos.', schema: { type: 'array', description: 'Termos de busca.', classification: 'personal' } } }, { id: 'clear-history', label: 'Limpar histórico', description: 'Remove os termos salvos.', returns: { description: 'Confirmação da limpeza.', schema: { type: 'object', description: 'Resposta da limpeza.', classification: 'public' } } }] },
    state: [{ id: 'history', description: 'Até vinte termos pesquisados, do mais recente para o mais antigo.', key: 'aggregator:history', operations: ['read', 'write', 'remove'], value: { description: 'Histórico de termos.', schema: { type: 'array', description: 'Termos buscados.', classification: 'personal', items: { type: 'string', description: 'Termo buscado.', classification: 'personal' } } }, retention: 'Enquanto o provedor de armazenamento escolhido pelo host conservar o estado.', deletionTrigger: 'Ação Limpar histórico ou limpeza do provedor.', fallback: 'memory' }, { id: 'tab', description: 'Campos e última resposta da aba.', key: 'aggregator:tab', operations: ['read', 'write'], value: { description: 'Estado visual da aba.', schema: { type: 'object', description: 'Busca e resposta.', classification: 'personal' } }, retention: 'Enquanto o provedor conservar o estado.', deletionTrigger: 'Limpeza do provedor ou dados do navegador.', fallback: 'memory' }],
    http: ['http://localhost:5291', 'http://localhost:5292', 'http://localhost:5293', 'http://localhost:5294'].map((origin, index) => ({ id: `search-${index + 1}`, direction: 'outgoing', method: 'GET', origin, path: '/search/text/{query}.json', purpose: 'Busca resultados no provedor de texto instalado na demonstração.', receives: { description: 'Termo da busca incluído na rota.', schema: { type: 'string', description: 'Termo buscado.', classification: 'personal' } }, returns: { description: 'Metadados de textos encontrados.', schema: { type: 'object', description: 'Resposta de busca.', classification: 'public' } } })),
    logs: [{ id: 'lifecycle', level: 'info', message: 'Add-on aggregator configurado com sucesso', description: 'Confirma a ativação do add-on.' }],
  },
};

export function setup(host: HostAPI): void {
  const aggregator = new SearchAggregator(new HttpTextAddonClient(), DEFAULT_BASE_URLS);
  host.registerService('searchProvider', aggregator);
  host.log('info', 'Add-on aggregator configurado com sucesso');
}

export function createTab(host: HostAPI): AddonTab {
  const searchProvider = host.services.get<SearchProvider>('searchProvider');
  let memoryHistory: string[] = [];

  const readHistory = async (): Promise<string[]> => {
    const store = host.services.get<AddonStateStore>('addonStateStore');
    if (!store) return memoryHistory;
    const saved = await store.get<string[]>('aggregator:history');
    if (saved) return saved;
    if (memoryHistory.length) await store.set('aggregator:history', memoryHistory);
    return memoryHistory;
  };

  const saveHistory = async (history: string[]) => {
    memoryHistory = history;
    await host.services.get<AddonStateStore>('addonStateStore')?.set('aggregator:history', history);
  };

  return {
    ...manifest.tab,
    fields: [{ id: 'query', label: 'Termo de busca', placeholder: 'Ex.: poesia', required: true }],
    actions: [
      { id: 'search', label: 'Buscar' },
      { id: 'history', label: 'Histórico', variant: 'secondary' },
      { id: 'clear-history', label: 'Limpar histórico', variant: 'danger' },
    ],
    persistence: createTabStatePersistence(host, 'aggregator:tab'),
    async run(actionId, values) {
      if (actionId === 'history') {
        const history = await readHistory();
        host.log('info', 'Histórico de buscas consultado', { count: history.length });
        return {
          status: 'info',
          title: `${history.length} termo(s) no histórico`,
          body: history.length ? 'Termos mais recentes primeiro.' : 'Nenhum termo buscado nesta disponibilidade de armazenamento.',
          items: history.map((term, index) => ({ label: String(index + 1), value: term })),
        };
      }
      if (actionId === 'clear-history') {
        await saveHistory([]);
        host.log('warn', 'Histórico de buscas removido');
        return { status: 'success', body: 'Histórico de termos removido.' };
      }
      if (actionId !== 'search') return { status: 'error', body: 'Ação desconhecida.' };
      if (!searchProvider) return { status: 'error', body: 'Serviço de busca indisponível.' };
      const query = values.query?.trim();
      if (!query) {
        host.log('warn', 'Busca recusada: termo ausente');
        return { status: 'error', body: 'Digite um termo para buscar.' };
      }
      const results = await searchProvider.search(query);
      const history = await readHistory();
      await saveHistory([query, ...history.filter((term) => term !== query)].slice(0, 20));
      host.log('info', 'Busca agregada concluída', { query, results: results.length });
      return {
        status: 'success',
        title: `${results.length} resultado(s)`,
        body: results.length ? 'Resultados encontrados nos provedores ativos.' : 'Nenhum resultado encontrado.',
        items: results.map((result) => ({ label: result.title, value: result.snippet ?? 'Sem descrição' })),
      };
    },
  };
}
