import type { AddonManifest, TextAddonClientPort, TextCatalogPayload, TextPayload, TextSearchPayload } from '@addons-poc/protocol';

export class HttpTextAddonClient implements TextAddonClientPort {
  constructor(private fetchFn: (url: string) => Promise<Response> = (url) => fetch(url)) {}
  private async json<T>(url: string): Promise<T> { const response = await this.fetchFn(url); if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`); return response.json() as Promise<T>; }
  async getManifest(base: string): Promise<AddonManifest> { const manifest = await this.json<AddonManifest>(`${base.replace(/\/+$/, '')}/manifest.json`); return manifest; }
  catalog(base: string, type: string, id: string): Promise<TextCatalogPayload> { return this.json(`${base}/catalog/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`); }
  search(base: string, type: string, query: string): Promise<TextSearchPayload> { return this.json(`${base}/search/${encodeURIComponent(type)}/${encodeURIComponent(query)}.json`); }
  text(base: string, type: string, id: string): Promise<TextPayload> { return this.json(`${base}/text/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`); }
}
