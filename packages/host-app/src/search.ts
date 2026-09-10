import type { AddonInstance, AddonResource, TextMeta, TextPageRequest, TextPagination, TextSearchPayload } from '@addons-poc/protocol';

export const DEFAULT_SEARCH_LIMIT = 10;
export const MIN_SEARCH_LIMIT = 1;
export const MAX_SEARCH_LIMIT = 500;
export const MAX_DESCRIPTION_LENGTH = 140;

export type SearchLimitValue = number | '';

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

export interface SearchPageState {
  loaded: number;
  total?: number;
  next?: string;
}

export type SearchPagination = Record<string, SearchPageState>;

export function hasNextSearchPage(pagination: SearchPagination): boolean {
  return Object.values(pagination).some((page) => Boolean(page.next));
}

export interface SearchCollection {
  results: SearchResultRow[];
  errors: SearchProviderError[];
  providerCount: number;
  pagination: SearchPagination;
}

export interface SearchLimits {
  [manifestUrl: string]: SearchLimitValue | undefined;
}

export interface SearchClient {
  search(baseUrl: string, type: string, query: string, page?: TextPageRequest): Promise<TextSearchPayload>;
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

type TextFetcher = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

/** Busca o conteúdo textual de uma linha quando o usuário abre o resultado. */
export async function fetchSearchResultContent(
  url: string,
  fetchFn: TextFetcher = (requestUrl) => fetch(requestUrl),
): Promise<string> {
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
  return response.text();
}

/** Adaptador de busca usado pelo host; os servidores continuam independentes. */
export function createFetchSearchClient(): SearchClient {
  return {
    async search(baseUrl, type, query, page) {
      const url = `${baseUrl.replace(/\/+$/, '')}/search/${encodeURIComponent(type)}/${encodeURIComponent(query)}.json`;
      const params = new URLSearchParams();
      if (page?.limit !== undefined) params.set('limit', String(page.limit));
      if (page?.cursor) params.set('cursor', page.cursor);
      const queryString = params.toString();
      return (await fetchJson(queryString ? `${url}?${queryString}` : url)) as TextSearchPayload;
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

export function parseSearchLimitInput(value: string): SearchLimitValue {
  if (value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : '';
}

export function clampSearchLimit(value: SearchLimitValue | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(MIN_SEARCH_LIMIT, Math.round(value)));
}

export function truncateDescription(value: string, maxLength = MAX_DESCRIPTION_LENGTH): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) return value;
  return `${characters.slice(0, Math.max(0, maxLength - 1)).join('').trimEnd()}…`;
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
      : '';
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

function assertSearchPayload(value: unknown): { metas: ExtendedTextMeta[]; pagination?: TextPagination } {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { metas?: unknown }).metas)) {
    throw new Error('Resposta de busca inválida: esperava uma lista metas');
  }
  const pagination = (value as { pagination?: unknown }).pagination;
  if (pagination !== undefined) {
    if (!pagination || typeof pagination !== 'object') throw new Error('Resposta de busca inválida: pagination deve ser um objeto');
    const page = pagination as { limit?: unknown; total?: unknown; next?: unknown };
    if (typeof page.limit !== 'number' || !Number.isSafeInteger(page.limit) || page.limit < 1) throw new Error('Resposta de busca inválida: pagination.limit');
    if (page.total !== undefined && (typeof page.total !== 'number' || !Number.isSafeInteger(page.total) || page.total < 0)) throw new Error('Resposta de busca inválida: pagination.total');
    if (page.next !== undefined && typeof page.next !== 'string') throw new Error('Resposta de busca inválida: pagination.next');
  }
  return value as { metas: ExtendedTextMeta[]; pagination?: TextPagination };
}

function paginationKey(manifestUrl: string, type: string): string {
  return `${manifestUrl}::${type}`;
}

/** Consulta os add-ons HTTP ativos que declaram `search` e normaliza suas linhas. */
export async function searchActiveAddons(
  addons: AddonInstance[],
  disabledManifestUrls: readonly string[],
  query: string,
  limits: SearchLimits = {},
  client: SearchClient = createFetchSearchClient(),
  previousPagination: SearchPagination = {},
): Promise<SearchCollection> {
  const providers = addons.filter((addon) => isSearchableAddon(addon, disabledManifestUrls));
  const outcomes = await Promise.all(providers.map(async (addon) => {
    const baseUrl = addonBaseUrl(addon.manifestUrl);
    const pageLimit = clampSearchLimit(limits[addon.manifestUrl]);
    const types = [...new Set(getSearchResources(addon).flatMap((resource) => resource.types))];
    const typeOutcomes = await Promise.allSettled(
      types.map(async (type) => {
        const key = paginationKey(addon.manifestUrl, type);
        const previous = previousPagination[key];
        const loaded = previous?.loaded ?? 0;
        if (previous && !previous.next) {
          return { type, key, metas: [], previous, pagination: undefined, skipped: true };
        }
        const payload = assertSearchPayload(await client.search(baseUrl, type, query, {
          limit: pageLimit,
          ...(previous?.next ? { cursor: previous.next } : {}),
        }));
        return { type, key, metas: payload.metas, pagination: payload.pagination, skipped: false };
      }),
    );
    const rows: SearchResultRow[] = [];
    const failures: SearchProviderError[] = [];
    const pagination: SearchPagination = {};
    typeOutcomes.forEach((outcome, index) => {
      const failedType = types[index];
      const failedKey = paginationKey(addon.manifestUrl, failedType);
      if (outcome.status === 'rejected') {
        failures.push({
          addonName: addon.manifest.name,
          message: (outcome.reason as Error)?.message ?? 'A busca falhou.',
        });
        const previous = previousPagination[failedKey];
        if (previous) pagination[failedKey] = previous;
        return;
      }
      const previous = previousPagination[outcome.value.key];
      const loaded = previous?.loaded ?? 0;
      if (outcome.value.skipped) {
        if (outcome.value.previous) pagination[outcome.value.key] = outcome.value.previous;
        return;
      }
      const beforeRows = rows.length;
      for (const meta of outcome.value.metas) {
        const row = normalizeMeta(meta, addon, outcome.value.type, baseUrl);
        if (row) rows.push(row);
        if (rows.length >= pageLimit) break;
      }
      const addedRows = rows.length - beforeRows;
      const next = outcome.value.pagination?.next;
      pagination[outcome.value.key] = {
        loaded: loaded + addedRows,
        ...(outcome.value.pagination?.total === undefined ? {} : { total: outcome.value.pagination.total }),
        ...(next ? { next } : {}),
      };
    });
    return { rows: rows.slice(0, pageLimit), failures, pagination };
  }));

  const pagination = Object.assign({}, ...outcomes.map((outcome) => outcome.pagination));
  return {
    results: outcomes.flatMap((outcome) => outcome.rows),
    errors: outcomes.flatMap((outcome) => outcome.failures),
    providerCount: providers.length,
    pagination,
  };
}

export interface SearchPageLoadResult {
  page: number;
  collection: SearchCollection;
}

/** Carrega uma página numerada, avançando pelos cursores quando necessário. */
export async function searchPage(
  addons: AddonInstance[],
  disabledManifestUrls: readonly string[],
  query: string,
  page: number,
  limits: SearchLimits = {},
  client: SearchClient = createFetchSearchClient(),
  cachedPages: Map<number, SearchCollection> = new Map(),
): Promise<SearchPageLoadResult> {
  const targetPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  let previousPagination: SearchPagination = {};
  let collection: SearchCollection = { results: [], errors: [], providerCount: 0, pagination: {} };
  let reachedPage = 1;

  for (let currentPage = 1; currentPage <= targetPage; currentPage += 1) {
    const cached = cachedPages.get(currentPage);
    collection = cached ?? await searchActiveAddons(
      addons,
      disabledManifestUrls,
      query,
      limits,
      client,
      previousPagination,
    );
    if (!cached) cachedPages.set(currentPage, collection);
    previousPagination = collection.pagination;
    reachedPage = currentPage;
    if (currentPage < targetPage && !hasNextSearchPage(collection.pagination)) break;
  }

  return { page: reachedPage, collection };
}
