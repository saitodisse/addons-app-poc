import type { AddonManifest, TextAddonClientPort, TextCatalogPayload, TextPageRequest, TextPayload, TextSearchPayload } from '@addons-poc/protocol';

export class HttpTextAddonClient implements TextAddonClientPort {
  constructor(private fetchFn: (url: string) => Promise<Response> = (url) => fetch(url)) {}
  private async json<T>(url: string): Promise<T> { const response = await this.fetchFn(url); if (!response.ok) throw new Error(`HTTP ${response.status} at ${url}`); return response.json() as Promise<T>; }
  async getManifest(base: string): Promise<AddonManifest> { return this.json(`${base.replace(/\/+$/, '')}/manifest.json`); }
  private resourceUrl(base: string, resource: string, type: string, idOrQuery: string, page?: TextPageRequest): string {
    const params = new URLSearchParams();
    if (page?.limit !== undefined) params.set('limit', String(page.limit));
    if (page?.cursor) params.set('cursor', page.cursor);
    const query = params.toString();
    return `${base.replace(/\/+$/, '')}/${resource}/${encodeURIComponent(type)}/${encodeURIComponent(idOrQuery)}.json${query ? `?${query}` : ''}`;
  }
  catalog(base: string, type: string, id: string, page?: TextPageRequest): Promise<TextCatalogPayload> { return this.json(this.resourceUrl(base, 'catalog', type, id, page)); }
  search(base: string, type: string, query: string, page?: TextPageRequest): Promise<TextSearchPayload> { return this.json(this.resourceUrl(base, 'search', type, query, page)); }
  text(base: string, type: string, id: string): Promise<TextPayload> { return this.json(`${base}/text/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`); }
}
