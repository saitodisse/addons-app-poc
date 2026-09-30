import type { AddonCatalog, AddonInstance, AddonResource, TextMeta, TextPageRequest, TextPagination, TextSearchPayload } from '@addons-poc/protocol';
import { headersToObject, logBrowserHttpExchange } from './http-observability';

export const DEFAULT_SEARCH_LIMIT = 10;
export const MIN_SEARCH_LIMIT = 1;
export const MAX_SEARCH_LIMIT = 500;
export const MAX_DESCRIPTION_LENGTH = 140;

export type SearchLimitValue = number | '';

export interface SearchResultDisplayField {
  id: string;
  label: string;
  value: string;
  detail?: string;
  image?: string;
  url?: string;
}

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
  /** Optional provider-defined columns for a domain-specific listing. */
  displayFields?: SearchResultDisplayField[];
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

export interface SearchLanguages {
  [manifestUrl: string]: string | undefined;
}

export interface SearchClient {
  search(baseUrl: string, type: string, query: string, page?: TextPageRequest): Promise<TextSearchPayload>;
  /** Reads one page of a catalogue the add-on declares. */
  catalog?(baseUrl: string, type: string, catalogId: string, page?: TextPageRequest): Promise<TextSearchPayload>;
}

const TYPE_EMOJIS: Record<string, string> = {
  quote: '💬',
  poem: '📜',
  page: '🌐',
  text: '📚',
};

async function fetchJson(url: string, fetchFn: typeof fetch = fetch): Promise<unknown> {
  const startedAt = Date.now();
  const request = { method: 'GET', url, headers: { Accept: 'application/json' }, body: null };
  let response: Response | undefined;
  let logged = false;
  try {
    response = await fetchFn(url, { headers: { Accept: 'application/json' } });
    const body = await response.json();
    logBrowserHttpExchange({
      source: 'host-search',
      method: 'GET',
      url,
      request,
      response: { status: response.status, ok: response.ok, headers: headersToObject(response.headers), body },
      durationMs: Date.now() - startedAt,
    });
    logged = true;
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
    return body;
  } catch (error) {
    if (!logged) {
      logBrowserHttpExchange({
        source: 'host-search',
        method: 'GET',
        url,
        request,
        ...(response ? { response: { status: response.status, ok: response.ok, headers: headersToObject(response.headers) } } : {}),
        durationMs: Date.now() - startedAt,
        error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) },
      });
    }
    throw error;
  }
}

type TextFetcher = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'text'> & { headers?: Headers }>;

export interface SearchResultImage {
  source?: string;
  width?: number;
  height?: number;
}

export interface SearchResultLinks {
  page?: string;
  revisions?: string;
  edit?: string;
  talk?: string;
}

export interface SearchResultStructuredPayload {
  id?: string;
  type?: string;
  title?: string;
  displaytitle?: string;
  description?: string;
  description_source?: string;
  extract?: string;
  extract_html?: string;
  pageid?: number;
  wikibase_item?: string;
  namespace?: { id?: number; text?: string };
  lang?: string;
  dir?: string;
  revision?: string;
  timestamp?: string;
  tid?: string;
  titles?: { canonical?: string; normalized?: string; display?: string };
  content_urls?: { desktop?: SearchResultLinks; mobile?: SearchResultLinks };
  thumbnail?: SearchResultImage;
  originalimage?: SearchResultImage;
  content?: {
    text?: string;
    charCount?: number;
    wordCount?: number;
    contentType?: string;
    encoding?: string;
  };
  source?: {
    name?: string;
    provider?: string;
    origin?: string;
    url?: string;
    headers?: Record<string, string>;
    responseHeaders?: Record<string, string>;
  };
  observability?: {
    requestId?: string;
    durationMs?: number;
    collectedAt?: string;
  };
  [key: string]: unknown;
}

export interface SearchResultDetails {
  body: SearchResultStructuredPayload;
  bodyText: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  durationMs: number;
}

type StructuredContentFetcher = (url: string) => Promise<Pick<Response, 'ok' | 'status' | 'text'> & { headers?: Headers }>;

/** Computes the parallel metadata route for a content.txt URL. */
export function contentJsonUrlFromContentUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/content.txt')) {
      parsed.pathname = parsed.pathname.slice(0, -'content.txt'.length) + 'content.json';
    }
    return parsed.href;
  } catch {
    return url.replace(/\/content\.txt(?=$|[?#])/, '/content.json');
  }
}

/** Fetches the structured content used by the result's dedicated page. */
export async function fetchSearchResultDetails(
  contentUrl: string,
  fetchFn: StructuredContentFetcher = (requestUrl) => fetch(requestUrl, { headers: { Accept: 'application/json' }}),
): Promise<SearchResultDetails> {
  const url = contentJsonUrlFromContentUrl(contentUrl);
  const startedAt = Date.now();
  const request = { method: 'GET', url, headers: { Accept: 'application/json' }, body: null };
  let response: Awaited<ReturnType<StructuredContentFetcher>> | undefined;
  let bodyText = '';
  let logged = false;

  try {
    response = await fetchFn(url);
    bodyText = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
    const details = {
      body: body as SearchResultStructuredPayload,
      bodyText,
      status: response.status,
      ok: response.ok,
      headers: headersToObject(response.headers),
      durationMs: Date.now() - startedAt,
    } satisfies SearchResultDetails;
    logBrowserHttpExchange({
      source: 'host-content-page',
      method: 'GET',
      url,
      request,
      response: { status: response.status, ok: response.ok, headers: details.headers, body, bodyText },
      durationMs: details.durationMs,
    });
    logged = true;
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('The result structured response is invalid.');
    return details;
  } catch (error) {
    if (!logged) {
      logBrowserHttpExchange({
        source: 'host-content-page',
        method: 'GET',
        url,
        request,
        ...(response ? {
          response: {
            status: response.status,
            ok: response.ok,
            headers: headersToObject(response.headers),
            ...(bodyText ? { bodyText } : {}),
          },
        } : {}),
        durationMs: Date.now() - startedAt,
        error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) },
      });
    }
    throw error;
  }
}

/** Fetches compatible text when an older add-on does not provide content.json. */
export async function fetchSearchResultContent(
  url: string,
  fetchFn: TextFetcher = (requestUrl) => fetch(requestUrl, { headers: { Accept: 'text/plain' } }),
): Promise<string> {
  const startedAt = Date.now();
  const request = { method: 'GET', url, headers: { Accept: 'text/plain' }, body: null };
  let response: Awaited<ReturnType<TextFetcher>> | undefined;
  let logged = false;
  try {
    response = await fetchFn(url);
    const body = await response.text();
    logBrowserHttpExchange({
      source: 'host-content-page-fallback',
      method: 'GET',
      url,
      request,
      response: { status: response.status, ok: response.ok, headers: headersToObject(response.headers), body },
      durationMs: Date.now() - startedAt,
    });
    logged = true;
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`);
    return body;
  } catch (error) {
    if (!logged) {
      logBrowserHttpExchange({
        source: 'host-content-page-fallback',
        method: 'GET',
        url,
        request,
        ...(response ? { response: { status: response.status, ok: response.ok, headers: headersToObject(response.headers) } } : {}),
        durationMs: Date.now() - startedAt,
        error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) },
      });
    }
    throw error;
  }
}

/** Search adapter used by the host; servers remain independent. */
export function createFetchSearchClient(fetchFn: typeof fetch = fetch): SearchClient {
  return {
    async search(baseUrl, type, query, page) {
      const url = `${baseUrl.replace(/\/+$/, '')}/search/${encodeURIComponent(type)}/${encodeURIComponent(query)}.json`;
      const params = new URLSearchParams();
      if (page?.limit !== undefined) params.set('limit', String(page.limit));
      if (page?.cursor) params.set('cursor', page.cursor);
      if (page?.lang) params.set('lang', page.lang);
      const queryString = params.toString();
      return (await fetchJson(queryString ? `${url}?${queryString}` : url, fetchFn)) as TextSearchPayload;
    },
    async catalog(baseUrl, type, catalogId, page) {
      const url = `${baseUrl.replace(/\/+$/, '')}/catalog/${encodeURIComponent(type)}/${encodeURIComponent(catalogId)}.json`;
      const params = new URLSearchParams();
      if (page?.limit !== undefined) params.set('limit', String(page.limit));
      if (page?.cursor) params.set('cursor', page.cursor);
      if (page?.lang) params.set('lang', page.lang);
      const queryString = params.toString();
      return (await fetchJson(queryString ? `${url}?${queryString}` : url, fetchFn)) as TextSearchPayload;
    },
  };
}

interface ExtendedTextMeta extends TextMeta {
  /** Add-ons may provide their own public URL for the result. */
  url?: string;
  /** Add-ons may choose an emoji or an image for the row. */
  emoji?: string;
  image?: string;
  /** Optional column labels and values, interpreted generically by the host. */
  displayFields?: unknown;
}

function isSearchResource(resource: AddonResource): boolean {
  return resource.name === 'search' && resource.types.length > 0;
}

export function getSearchResources(addon: AddonInstance): AddonResource[] {
  return (addon.manifest.contract.resources ?? []).filter(isSearchResource);
}

/** Languages announced by the add-on's search resources, in manifest order. */
export function getSearchLanguages(addon: AddonInstance): string[] {
  return [...new Set(getSearchResources(addon).flatMap((resource) => resource.languages ?? []).filter((language): language is string => typeof language === 'string' && language.trim().length > 0))];
}

function isCatalogResource(resource: AddonResource): boolean {
  return resource.name === 'catalog' && resource.types.length > 0;
}

/** Resources that list content without a search term. */
export function getCatalogResources(addon: AddonInstance): AddonResource[] {
  return (addon.manifest.contract.resources ?? []).filter(isCatalogResource);
}

/** Languages announced by the add-on's catalogue resources, in manifest order. */
export function getCatalogLanguages(addon: AddonInstance): string[] {
  return [...new Set(getCatalogResources(addon).flatMap((resource) => resource.languages ?? []).filter((language): language is string => typeof language === 'string' && language.trim().length > 0))];
}

export function isBrowsableAddon(addon: AddonInstance, disabledManifestUrls: readonly string[] = []): boolean {
  return addon.status === 'ready'
    && !disabledManifestUrls.includes(addon.manifestUrl)
    && getCatalogResources(addon).length > 0
    && (addon.manifest.contract.catalogs ?? []).length > 0;
}

/**
 * Catalogue the host lists for one add-on when there is no search term.
 *
 * One per add-on: the first catalogue it declares, in manifest order. A domain
 * that publishes several views of the same items — the chord catalogue declares
 * four — would otherwise repeat every row on the page.
 */
export function browseCatalogFor(addon: AddonInstance): AddonCatalog | undefined {
  const allowedTypes = new Set(getCatalogResources(addon).flatMap((resource) => resource.types));
  return (addon.manifest.contract.catalogs ?? []).find((catalog) => allowedTypes.has(catalog.type));
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

function normalizeDisplayFields(value: unknown, baseUrl: string): SearchResultDisplayField[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fields = value.flatMap((candidate): SearchResultDisplayField[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const field = candidate as Record<string, unknown>;
    if (typeof field.id !== 'string' || !field.id.trim()
      || typeof field.label !== 'string' || !field.label.trim()
      || typeof field.value !== 'string') return [];
    return [{
      id: field.id.trim(),
      label: field.label.trim(),
      value: field.value,
      ...(typeof field.detail === 'string' && field.detail.trim() ? { detail: field.detail.trim() } : {}),
      ...(typeof field.image === 'string' && field.image.trim() ? { image: absoluteUrl(field.image, field.image, baseUrl) } : {}),
      ...(typeof field.url === 'string' && field.url.trim() ? { url: absoluteUrl(field.url, field.url, baseUrl) } : {}),
    }];
  });
  return fields.length ? fields : undefined;
}

function fallbackResultUrl(baseUrl: string, type: string, id: string, language?: string): string {
  const url = new URL(
    `text/${encodeURIComponent(type)}/${encodeURIComponent(id)}/content.txt`,
    baseUrl,
  );
  if (language) url.searchParams.set('lang', language);
  return url.href;
}

function normalizeMeta(
  meta: ExtendedTextMeta,
  addon: AddonInstance,
  type: string,
  baseUrl: string,
  language?: string,
): SearchResultRow | undefined {
  if (meta == null || (typeof meta.id !== 'string' && typeof meta.id !== 'number') || typeof meta.name !== 'string') {
    return undefined;
  }
  const id = String(meta.id);
  const resultType = typeof meta.type === 'string' && meta.type.trim() ? meta.type : type;
  const fallbackUrl = fallbackResultUrl(baseUrl, resultType, id, language);
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
  const displayFields = normalizeDisplayFields(meta.displayFields, baseUrl);

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
    ...(displayFields ? { displayFields } : {}),
  };
}

function assertSearchPayload(value: unknown): { metas: ExtendedTextMeta[]; pagination?: TextPagination } {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { metas?: unknown }).metas)) {
    throw new Error('Invalid search response: expected a metas list');
  }
  const pagination = (value as { pagination?: unknown }).pagination;
  if (pagination !== undefined) {
    if (!pagination || typeof pagination !== 'object') throw new Error('Invalid search response: pagination must be an object');
    const page = pagination as { limit?: unknown; total?: unknown; next?: unknown };
    if (typeof page.limit !== 'number' || !Number.isSafeInteger(page.limit) || page.limit < 1) throw new Error('Invalid search response: pagination.limit');
    if (page.total !== undefined && (typeof page.total !== 'number' || !Number.isSafeInteger(page.total) || page.total < 0)) throw new Error('Invalid search response: pagination.total');
    if (page.next !== undefined && typeof page.next !== 'string') throw new Error('Invalid search response: pagination.next');
  }
  return value as { metas: ExtendedTextMeta[]; pagination?: TextPagination };
}

function paginationKey(manifestUrl: string, type: string): string {
  return `${manifestUrl}::${type}`;
}

/** Queries active HTTP add-ons that declare `search` and normalizes their rows. */
export async function searchActiveAddons(
  addons: AddonInstance[],
  disabledManifestUrls: readonly string[],
  query: string,
  limits: SearchLimits = {},
  client: SearchClient = createFetchSearchClient(),
  previousPagination: SearchPagination = {},
  languages: SearchLanguages = {},
): Promise<SearchCollection> {
  const providers = addons.filter((addon) => isSearchableAddon(addon, disabledManifestUrls));
  const outcomes = await Promise.all(providers.map(async (addon) => {
    const baseUrl = addonBaseUrl(addon.manifestUrl);
    const pageLimit = clampSearchLimit(limits[addon.manifestUrl]);
    const supportedLanguages = getSearchLanguages(addon);
    const language = supportedLanguages.includes(languages[addon.manifestUrl] ?? '')
      ? languages[addon.manifestUrl]
      : supportedLanguages[0];
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
          ...(language ? { lang: language } : {}),
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
          message: (outcome.reason as Error)?.message ?? 'The search failed.',
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
        const row = normalizeMeta(meta, addon, outcome.value.type, baseUrl, language);
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

/**
 * Lists what the active add-ons publish, without a search term.
 *
 * It reads the first catalogue of every add-on that declares one, with the same
 * paging rules as a search: the per-add-on limit, the cursor the add-on returns,
 * and a failure that is shown without hiding the other sources.
 */
export async function browseActiveAddons(
  addons: AddonInstance[],
  disabledManifestUrls: readonly string[],
  limits: SearchLimits = {},
  client: SearchClient = createFetchSearchClient(),
  previousPagination: SearchPagination = {},
  languages: SearchLanguages = {},
): Promise<SearchCollection> {
  const providers = addons.filter((addon) => isBrowsableAddon(addon, disabledManifestUrls));
  const outcomes = await Promise.all(providers.map(async (addon) => {
    const baseUrl = addonBaseUrl(addon.manifestUrl);
    const pageLimit = clampSearchLimit(limits[addon.manifestUrl]);
    const catalog = browseCatalogFor(addon);
    if (!catalog) return { rows: [] as SearchResultRow[], failures: [] as SearchProviderError[], pagination: {} as SearchPagination };

    const key = paginationKey(addon.manifestUrl, catalog.id);
    const previous = previousPagination[key];
    const loaded = previous?.loaded ?? 0;
    if (previous && !previous.next) {
      return { rows: [] as SearchResultRow[], failures: [] as SearchProviderError[], pagination: { [key]: previous } as SearchPagination };
    }

    const supportedLanguages = getCatalogLanguages(addon);
    const language = supportedLanguages.includes(languages[addon.manifestUrl] ?? '')
      ? languages[addon.manifestUrl]
      : supportedLanguages[0];

    try {
      if (!client.catalog) throw new Error('The search client cannot read a catalogue.');
      const payload = assertSearchPayload(await client.catalog(baseUrl, catalog.type, catalog.id, {
        limit: pageLimit,
        ...(previous?.next ? { cursor: previous.next } : {}),
        ...(language ? { lang: language } : {}),
      }));
      const rows = payload.metas
        .map((meta) => normalizeMeta(meta, addon, catalog.type, baseUrl, language))
        .filter((row): row is SearchResultRow => row !== undefined)
        .slice(0, pageLimit);
      const next = payload.pagination?.next;
      return {
        rows,
        failures: [] as SearchProviderError[],
        pagination: {
          [key]: {
            loaded: loaded + rows.length,
            ...(payload.pagination?.total === undefined ? {} : { total: payload.pagination.total }),
            ...(next ? { next } : {}),
          },
        } as SearchPagination,
      };
    } catch (error) {
      return {
        rows: [] as SearchResultRow[],
        failures: [{ addonName: addon.manifest.name, message: (error as Error)?.message ?? 'The catalogue could not be read.' }],
        pagination: (previous ? { [key]: previous } : {}) as SearchPagination,
      };
    }
  }));

  const pagination = Object.assign({}, ...outcomes.map((outcome) => outcome.pagination));
  return {
    results: outcomes.flatMap((outcome) => outcome.rows),
    errors: outcomes.flatMap((outcome) => outcome.failures),
    providerCount: providers.length,
    pagination,
  };
}

/** Loads a numbered page of the catalogue listing, advancing through cursors. */
export async function browsePage(
  addons: AddonInstance[],
  disabledManifestUrls: readonly string[],
  page: number,
  limits: SearchLimits = {},
  client: SearchClient = createFetchSearchClient(),
  cachedPages: Map<number, SearchCollection> = new Map(),
  languages: SearchLanguages = {},
): Promise<SearchPageLoadResult> {
  const targetPage = Number.isSafeInteger(page) && page > 0 ? page : 1;
  let previousPagination: SearchPagination = {};
  let collection: SearchCollection = { results: [], errors: [], providerCount: 0, pagination: {} };
  let reachedPage = 1;

  for (let currentPage = 1; currentPage <= targetPage; currentPage += 1) {
    const cached = cachedPages.get(currentPage);
    collection = cached ?? await browseActiveAddons(addons, disabledManifestUrls, limits, client, previousPagination, languages);
    if (!cached) cachedPages.set(currentPage, collection);
    previousPagination = collection.pagination;
    reachedPage = currentPage;
    if (currentPage < targetPage && !hasNextSearchPage(collection.pagination)) break;
  }

  return { page: reachedPage, collection };
}

export interface SearchPageLoadResult {
  page: number;
  collection: SearchCollection;
}

/** Loads a numbered page, advancing through cursors when necessary. */
export async function searchPage(
  addons: AddonInstance[],
  disabledManifestUrls: readonly string[],
  query: string,
  page: number,
  limits: SearchLimits = {},
  client: SearchClient = createFetchSearchClient(),
  cachedPages: Map<number, SearchCollection> = new Map(),
  languages: SearchLanguages = {},
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
      languages,
    );
    if (!cached) cachedPages.set(currentPage, collection);
    previousPagination = collection.pagination;
    reachedPage = currentPage;
    if (currentPage < targetPage && !hasNextSearchPage(collection.pagination)) break;
  }

  return { page: reachedPage, collection };
}
