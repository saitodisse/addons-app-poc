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
 * Resource declared in the manifest (Stremio/Torrentio style).
 *
 * Just as Torrentio declares `{ name: 'stream', types: ['movie', 'series'] }`,
 * a text add-on declares resources such as `catalog`, `search`, and `text`.
 */
export type AddonResourceName = 'catalog' | 'search' | 'text' | 'meta' | 'subtitles' | 'stream';

export interface AddonResource {
  name: AddonResourceName;
  /** Content types served by this resource (for example, 'text' or 'quote'). */
  types: string[];
  /** Accepted ID prefixes (for example, 'tt' for IMDb, as in Torrentio). */
  idPrefixes?: string[];
  /** Languages accepted by the resource when it offers language selection. */
  languages?: string[];
}

/** Catalog announced in the manifest (Stremio style). */
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
  /** Required and verifiable contract for all declared interactions. */
  contract: AddonInteractionContract;
  /** In-process format: ESM bundle + setup. */
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

/** Normalizes metadata and returns only the public format, without legacy fields. */
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
