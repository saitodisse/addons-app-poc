import type { AddonTabMetadata } from './tab';
import type { AddonInteractionContract } from './interactions';

export type { AddonTabMetadata } from './tab';

export interface ServiceRegistration {
  id: string;
  version: string;
  name: string;
  description: string;
}

/**
 * Recurso declarado no manifesto (estilo Stremio/Torrentio).
 *
 * Assim como o Torrentio declara `{ name: 'stream', types: ['movie', 'series'] }`,
 * um add-on de texto declara recursos como `catalog`, `search` e `text`.
 */
export type AddonResourceName = 'catalog' | 'search' | 'text' | 'meta' | 'subtitles' | 'stream';

export interface AddonResource {
  name: AddonResourceName;
  /** Tipos de conteúdo que este recurso atende (ex.: 'text', 'quote'). */
  types: string[];
  /** Prefixos de id aceitos (ex.: 'tt' para IMDb, como o Torrentio). */
  idPrefixes?: string[];
}

/** Catálogo anunciado no manifesto (estilo Stremio). */
export interface AddonCatalog {
  type: string;
  id: string;
  name: string;
}

export interface AddonManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  author: string;
  icon?: string;
  license: string;
  /** Aba que o host pode exibir enquanto o add-on estiver ativo. */
  tab: AddonTabMetadata;
  /** Contrato obrigatório e verificável de todas as interações declaradas. */
  interactions: AddonInteractionContract;
  /** Formato em processo: bundle ESM + setup. */
  entrypoint?: string;
  services?: ServiceRegistration[];
  /** Formato Stremio: add-on servido por HTTP com resources. */
  resources?: AddonResource[];
  types?: string[];
  idPrefixes?: string[];
  catalogs?: AddonCatalog[];
}
