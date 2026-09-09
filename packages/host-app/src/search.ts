import type { AddonInstance, AddonResource, TextMeta, TextSearchPayload } from '@addons-poc/protocol';

export const DEFAULT_SEARCH_LIMIT = 10;
export const MIN_SEARCH_LIMIT = 1;
export const MAX_SEARCH_LIMIT = 100;

export interface SearchResultRow {
  key: string;
  sourceAddonId: string;
  sourceAddonName: string;
  sourceManifestUrl: string;
  type: string;
  id: string;
  url: string;
  name: string;
  description: string;
  emoji?: string;
  image?: string;
}

export interface SearchProviderError {
  addonName: string;
  message: string;
}

export interface SearchCollection {
  results: SearchResultRow[];
  errors: SearchProviderError[];
  providerCount: number;
}

export interface SearchLimits {
  [manifestUrl: string]: number | undefined;
}

export interface SearchClient {
  search(baseUrl: string, type: string, query: string): Promise<TextSearchPayload>;
}

const TYPE_EMOJIS: Record<string, string> = {
  quote: '💬',
  poem: '📜',
  page: '🌐',
  text: '📚',
};

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.json();
}

/** Adaptador de busca usado pelo host; os servidores continuam independentes. */
export function createFetchSearchClient(): SearchClient {
  return {
    async search(baseUrl, type, query) {
      const url = `${baseUrl.replace(/\/+$/, '')}/search/${encodeURIComponent(type)}/${encodeURIComponent(query)}.json`;
      return (await fetchJson(url)) as TextSearchPayload;
    },
  };
}

interface ExtendedTextMeta extends TextMeta {
  /** Extensões podem oferecer uma URL pública própria para o resultado. */
  url?: string;
  /** Extensões podem escolher um emoji ou uma imagem para a linha. */
  emoji?: string;
  image?: string;
}

function isSearchResource(resource: AddonResource): boolean {
  return resource.name === 'search' && resource.types.length > 0;
}

export function getSearchResources(addon: AddonInstance): AddonResource[] {
  return (addon.manifest.contract.resources ?? []).filter(isSearchResource);
}

export function isSearchableAddon(addon: AddonInstance, disabledManifestUrls: readonly string[] = []): boolean {
  return addon.status === 'ready'
    && !disabledManifestUrls.includes(addon.manifestUrl)
    && getSearchResources(addon).length > 0;
}

export function clampSearchLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(MIN_SEARCH_LIMIT, Math.round(value as number)));
}

function addonBaseUrl(manifestUrl: string): string {
  const url = new URL(manifestUrl);
  url.pathname = url.pathname.replace(/manifest\.json$/, '');
  url.search = '';
  url.hash = '';
  return url.href.endsWith('/') ? url.href : `${url.href}/`;
}

function absoluteUrl(value: string | undefined, fallback: string, baseUrl: string): string {
  if (!value?.trim()) return fallback;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return fallback;
  }
}

function fallbackResultUrl(baseUrl: string, type: string, id: string): string {
  return new URL(
    `text/${encodeURIComponent(type)}/${encodeURIComponent(id)}/content.txt`,
    baseUrl,
  ).href;
}

function normalizeMeta(
  meta: ExtendedTextMeta,
  addon: AddonInstance,
  type: string,
  baseUrl: string,
): SearchResultRow | undefined {
  if (meta == null || (typeof meta.id !== 'string' && typeof meta.id !== 'number') || typeof meta.name !== 'string') {
    return undefined;
  }
  const id = String(meta.id);
  const resultType = typeof meta.type === 'string' && meta.type.trim() ? meta.type : type;
  const fallbackUrl = fallbackResultUrl(baseUrl, resultType, id);
  const description = typeof meta.description === 'string' && meta.description.trim()
    ? meta.description.trim()
    : typeof meta.author === 'string' && meta.author.trim()
      ? meta.author.trim()
      : 'Sem descrição';
  const image = typeof meta.image === 'string' && meta.image.trim()
    ? meta.image.trim()
    : typeof meta.poster === 'string' && meta.poster.trim()
      ? meta.poster.trim()
      : undefined;
  const emoji = typeof meta.emoji === 'string' && meta.emoji.trim()
    ? meta.emoji.trim()
    : TYPE_EMOJIS[resultType];

  return {
    key: `${addon.manifestUrl}:${resultType}:${id}`,
    sourceAddonId: addon.manifest.id,
    sourceAddonName: addon.manifest.name,
    sourceManifestUrl: addon.manifestUrl,
    type: resultType,
    id,
    url: absoluteUrl(meta.url, fallbackUrl, baseUrl),
    name: meta.name.trim() || id,
    description,
    ...(emoji ? { emoji } : {}),
    ...(image ? { image: absoluteUrl(image, image, baseUrl) } : {}),
  };
}

function assertSearchPayload(value: unknown): { metas: ExtendedTextMeta[] } {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { metas?: unknown }).metas)) {
    throw new Error('Resposta de busca inválida: esperava uma lista metas');
  }
  return value as { metas: ExtendedTextMeta[] };
}

/** Consulta os add-ons HTTP ativos que declaram `search` e normaliza suas linhas. */
export async function searchActiveAddons(
  addons: AddonInstance[],
  disabledManifestUrls: readonly string[],
  query: string,
  limits: SearchLimits = {},
  client: SearchClient = createFetchSearchClient(),
): Promise<SearchCollection> {
  const providers = addons.filter((addon) => isSearchableAddon(addon, disabledManifestUrls));
  const outcomes = await Promise.all(providers.map(async (addon) => {
    const baseUrl = addonBaseUrl(addon.manifestUrl);
    const limit = clampSearchLimit(limits[addon.manifestUrl]);
    const types = [...new Set(getSearchResources(addon).flatMap((resource) => resource.types))];
    const typeOutcomes = await Promise.allSettled(
      types.map(async (type) => ({ type, metas: assertSearchPayload(await client.search(baseUrl, type, query)).metas })),
    );
    const rows: SearchResultRow[] = [];
    const failures: SearchProviderError[] = [];
    typeOutcomes.forEach((outcome) => {
      if (outcome.status === 'rejected') {
        failures.push({
          addonName: addon.manifest.name,
          message: (outcome.reason as Error)?.message ?? 'A busca falhou.',
        });
        return;
      }
      for (const meta of outcome.value.metas) {
        const row = normalizeMeta(meta, addon, outcome.value.type, baseUrl);
        if (row) rows.push(row);
        if (rows.length >= limit) break;
      }
    });
    return { rows: rows.slice(0, limit), failures };
  }));

  return {
    results: outcomes.flatMap((outcome) => outcome.rows),
    errors: outcomes.flatMap((outcome) => outcome.failures),
    providerCount: providers.length,
  };
}
