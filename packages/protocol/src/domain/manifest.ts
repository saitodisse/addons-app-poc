import type { AddonTabMetadata } from './tab';
import type { AddonInteractionContract } from './contract';

export type { AddonTabMetadata } from './tab';

export interface ServiceRegistration {
  id: string;
  version: string;
  name: string;
  description: string;
  priority?: number;
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
  /** Contrato obrigatório e verificável de todas as interações declaradas. */
  contract: AddonInteractionContract;
  /** Formato em processo: bundle ESM + setup. */
  entrypoint?: string;
}

export type AddonManifestInput = Omit<AddonManifest, 'contract'> & {
  contract: AddonInteractionContract;
  ui?: AddonTabMetadata;
  services?: ServiceRegistration[];
  resources?: AddonResource[];
  types?: string[];
  idPrefixes?: string[];
  catalogs?: AddonCatalog[];
};

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => withoutUndefined(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, withoutUndefined(item)]),
    ) as T;
  }
  return value;
}

/** Normaliza autoria e devolve somente o formato público, sem campos legados. */
export function defineAddonManifest(input: AddonManifestInput): AddonManifest {
  const provided = new Map((input.services ?? []).map((service) => [service.id, service]));
  const contract = input.contract;
  const services = contract.services.map((service) => {
    const metadata = provided.get(service.id);
    return { ...service, version: service.version ?? metadata?.version ?? '1.0.0', name: service.name ?? metadata?.name ?? service.id, priority: service.priority ?? metadata?.priority };
  });
  const { ui: legacyUi, services: _services, resources, types, idPrefixes, catalogs, contract: _contract, ...metadata } = input;
  return withoutUndefined({
    ...metadata,
    contract: {
      ...contract,
      services,
      ui: { ...contract.ui, ...(legacyUi ?? {}) },
      resources: contract.resources ?? resources,
      types: contract.types ?? types,
      idPrefixes: contract.idPrefixes ?? idPrefixes,
      catalogs: contract.catalogs ?? catalogs,
    },
  });
}
