import type { AddonManifest } from '../domain/manifest';
import type { TextCatalogPayload, TextPayload, TextSearchPayload } from '../domain/text';
import type { TextAddonClientPort } from '../ports/text-addon-client';
import { validateManifest } from '../domain/validation';

type FetchFn = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

function resourceUrl(baseUrl: string, resource: string, type: string, idOrQuery: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/${resource}/${encodeURIComponent(type)}/${encodeURIComponent(idOrQuery)}.json`;
}

async function getJson<T>(fetchFn: FetchFn, url: string, what: string): Promise<T> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${what} em ${url}`);
  }
  return (await response.json()) as T;
}

/**
 * Cliente HTTP para add-ons de texto estilo Stremio.
 *
 * Monta as URLs dos resources (`/catalog/<type>/<id>.json`,
 * `/search/<type>/<query>.json`, `/text/<type>/<id>.json`) e busca os payloads
 * JSON. O `fetchFn` é injetável para testes (mesmo padrão do FetchAddonLoader).
 */
export class HttpTextAddonClient implements TextAddonClientPort {
  constructor(private fetchFn: FetchFn = (url) => fetch(url)) {}

  async getManifest(baseUrl: string): Promise<AddonManifest> {
    const base = baseUrl.replace(/\/+$/, '');
    const manifest = await getJson<AddonManifest>(this.fetchFn, `${base}/manifest.json`, 'manifesto');
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Manifest inválido: ${validation.errors.join(', ')}`);
    }
    return manifest;
  }

  catalog(baseUrl: string, type: string, catalogId: string): Promise<TextCatalogPayload> {
    return getJson<TextCatalogPayload>(
      this.fetchFn,
      resourceUrl(baseUrl, 'catalog', type, catalogId),
      'catálogo',
    );
  }

  search(baseUrl: string, type: string, query: string): Promise<TextSearchPayload> {
    return getJson<TextSearchPayload>(
      this.fetchFn,
      resourceUrl(baseUrl, 'search', type, query),
      'busca',
    );
  }

  text(baseUrl: string, type: string, id: string): Promise<TextPayload> {
    return getJson<TextPayload>(
      this.fetchFn,
      resourceUrl(baseUrl, 'text', type, id),
      'texto',
    );
  }
}
