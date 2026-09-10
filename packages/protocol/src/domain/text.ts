/**
 * Tipos de domínio para add-ons de compartilhamento de texto,
 * modelados no protocolo Stremio (referência: recursos subtitles/catalog do Torrentio).
 */

/**
 * Item de texto retornado pelo recurso `text`.
 *
 * Espelha o formato de subtitles do Stremio: `{ id, url, lang, name }`,
 * onde `url` aponta para o arquivo/conteúdo de texto que o host busca depois.
 */
export interface TextItem {
  id: string;
  /** URL absoluta do conteúdo de texto (servida pelo próprio add-on). */
  url: string;
  /** Código de idioma (ex.: 'pt', 'en'). */
  lang?: string;
  name: string;
  description?: string;
}

/**
 * Entrada de metadados em resultados de catálogo/busca (formato `metas` do Stremio).
 */
export interface TextMeta {
  id: string;
  type: string;
  name: string;
  poster?: string;
  author?: string;
  description?: string;
}

/** Opções comuns para buscar uma página de catálogo ou de resultados. */
export interface TextPageRequest {
  /** Quantidade máxima de itens solicitada nesta página. */
  limit?: number;
  /** Cursor opaco devolvido pela página anterior. */
  cursor?: string;
}

/** Continuação opcional de uma resposta de catálogo ou busca. */
export interface TextPagination {
  /** Quantidade efetivamente solicitada ou entregue na página. */
  limit: number;
  /** Total conhecido, quando o provedor consegue informá-lo. */
  total?: number;
  /** Cursor opaco para buscar a próxima página. */
  next?: string;
}

/** Payload do recurso `catalog` (estilo Stremio: `{ metas: [...] }`). */
export interface TextCatalogPayload {
  metas: TextMeta[];
  pagination?: TextPagination;
}

/** Payload do recurso `search` (estilo Stremio: `{ metas: [...] }`). */
export interface TextSearchPayload {
  metas: TextMeta[];
  pagination?: TextPagination;
}

/** Payload do recurso `text` (estilo subtitles do Stremio: `{ texts: [...] }`). */
export interface TextPayload {
  texts: TextItem[];
}
