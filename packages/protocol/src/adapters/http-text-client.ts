import type { AddonManifest } from '../domain/manifest';
import type { TextCatalogPayload, TextPageRequest, TextPayload, TextSearchPayload } from '../domain/text';
import type { TextAddonClientPort } from '../ports/text-addon-client';
import { validateManifest } from '../domain/validation';

type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function resourceUrl(baseUrl: string, resource: string, type: string, idOrQuery: string, page?: TextPageRequest): string {
  const base = baseUrl.replace(/\/+$/, '');
  const params = new URLSearchParams();
  if (page?.limit !== undefined) params.set('limit', String(page.limit));
  if (page?.cursor) params.set('cursor', page.cursor);
  if (page?.lang) params.set('lang', page.lang);
  const query = params.toString();
  return `${base}/${resource}/${encodeURIComponent(type)}/${encodeURIComponent(idOrQuery)}.json${query ? `?${query}` : ''}`;
}

async function getJson<T>(fetchFn: FetchFn, url: string, what: string): Promise<T> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${what} from ${url}`);
  }
  return (await response.json()) as T;
}

/**
 * HTTP client for Stremio-style text add-ons.
 *
 * Builds resource URLs (`/catalog/<type>/<id>.json`,
 * `/search/<type>/<query>.json`, `/text/<type>/<id>.json`) and fetches JSON
 * payloads. `fetchFn` is injectable for tests (the same pattern as FetchAddonLoader).
 */
export class HttpTextAddonClient implements TextAddonClientPort {
  constructor(private fetchFn: FetchFn = (url) => fetch(url)) {}

  async getManifest(baseUrl: string): Promise<AddonManifest> {
    const base = baseUrl.replace(/\/+$/, '');
    const manifest = await getJson<AddonManifest>(this.fetchFn, `${base}/manifest.json`, 'manifest');
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
    }
    return manifest;
  }

  catalog(baseUrl: string, type: string, catalogId: string, page?: TextPageRequest): Promise<TextCatalogPayload> {
    return getJson<TextCatalogPayload>(
      this.fetchFn,
      resourceUrl(baseUrl, 'catalog', type, catalogId, page),
      'catalog',
    );
  }

  search(baseUrl: string, type: string, query: string, page?: TextPageRequest): Promise<TextSearchPayload> {
    return getJson<TextSearchPayload>(
      this.fetchFn,
      resourceUrl(baseUrl, 'search', type, query, page),
      'search',
    );
  }

  text(baseUrl: string, type: string, id: string, page?: TextPageRequest): Promise<TextPayload> {
    return getJson<TextPayload>(
      this.fetchFn,
      resourceUrl(baseUrl, 'text', type, id, page),
      'text',
    );
  }
}
