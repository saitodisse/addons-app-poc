/**
 * Domain types for text-sharing add-ons,
 * modeled on the Stremio protocol (reference: Torrentio's subtitles/catalog resources).
 */

/**
 * Text item returned by the `text` resource.
 *
 * Mirrors Stremio's subtitle format: `{ id, url, lang, name }`,
 * where `url` points to the text file/content that the host fetches later.
 */
export interface TextItem {
  id: string;
  /** Absolute URL for text content (served by the add-on itself). */
  url: string;
  /** Language code (for example, 'pt' or 'en'). */
  lang?: string;
  name: string;
  description?: string;
}

/**
 * Metadata entry in catalog/search results (Stremio's `metas` format).
 */
export interface TextMeta {
  id: string;
  type: string;
  name: string;
  poster?: string;
  author?: string;
  description?: string;
}

/** Common options for fetching a catalog or result page. */
export interface TextPageRequest {
  /** Maximum number of items requested on this page. */
  limit?: number;
  /** Opaque cursor returned by the previous page. */
  cursor?: string;
  /** Selected language when the resource declares language support. */
  lang?: string;
}

/** Optional continuation of a catalog or search response. */
export interface TextPagination {
  /** Number actually requested or delivered on the page. */
  limit: number;
  /** Known total, when the provider can report it. */
  total?: number;
  /** Opaque cursor for fetching the next page. */
  next?: string;
}

/** Payload for the `catalog` resource (Stremio style: `{ metas: [...] }`). */
export interface TextCatalogPayload {
  metas: TextMeta[];
  pagination?: TextPagination;
}

/** Payload for the `search` resource (Stremio style: `{ metas: [...] }`). */
export interface TextSearchPayload {
  metas: TextMeta[];
  pagination?: TextPagination;
}

/** Payload for the `text` resource (Stremio subtitle style: `{ texts: [...] }`). */
export interface TextPayload {
  texts: TextItem[];
}
