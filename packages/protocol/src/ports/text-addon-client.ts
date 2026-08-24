import type { AddonManifest } from '../domain/manifest';
import type { TextCatalogPayload, TextPayload, TextSearchPayload } from '../domain/text';

/**
 * Port para consumir um add-on de texto servido por HTTP (estilo Stremio).
 *
 * O cliente monta as URLs dos resources declarados no manifesto e busca os
 * payloads JSON — o mesmo papel que o cliente oficial do Stremio faz com os
 * add-ons (como o Torrentio).
 */
export interface TextAddonClientPort {
  /** Busca e valida o manifesto na URL base do add-on. */
  getManifest(baseUrl: string): Promise<AddonManifest>;
  /** Chama `GET /catalog/<type>/<catalogId>.json`. */
  catalog(baseUrl: string, type: string, catalogId: string): Promise<TextCatalogPayload>;
  /** Chama `GET /search/<type>/<query>.json`. */
  search(baseUrl: string, type: string, query: string): Promise<TextSearchPayload>;
  /** Chama `GET /text/<type>/<id>.json` e devolve os itens de texto. */
  text(baseUrl: string, type: string, id: string): Promise<TextPayload>;
}
