import type { AddonManifest } from '../domain/manifest';
import type { TextCatalogPayload, TextPageRequest, TextPayload, TextSearchPayload } from '../domain/text';

/**
 * Port for consuming a text add-on served over HTTP (Stremio style).
 *
 * The client builds URLs for the resources declared in the manifest and fetches
 * JSON payloads, serving the same role as the official Stremio client for
 * add-ons such as Torrentio.
 */
export interface TextAddonClientPort {
  /** Fetches and validates the manifest at the add-on base URL. */
  getManifest(baseUrl: string): Promise<AddonManifest>;
  /** Calls `GET /catalog/<type>/<catalogId>.json`. */
  catalog(baseUrl: string, type: string, catalogId: string, page?: TextPageRequest): Promise<TextCatalogPayload>;
  /** Calls `GET /search/<type>/<query>.json`. */
  search(baseUrl: string, type: string, query: string, page?: TextPageRequest): Promise<TextSearchPayload>;
  /** Calls `GET /text/<type>/<id>.json` and returns its text items. */
  text(baseUrl: string, type: string, id: string, page?: TextPageRequest): Promise<TextPayload>;
}
