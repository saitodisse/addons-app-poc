// Domain
export type { AddonManifest, ServiceRegistration, AddonResource, AddonResourceName, AddonCatalog } from './domain/manifest';
export type { AddonInstance, AddonStatus } from './domain/instance';
export type { HostAPI, AddonModule } from './domain/host-api';
export { ServiceRegistry } from './domain/registry';
export type { ServiceEntry } from './domain/registry';
export { validateManifest } from './domain/validation';
export type { ValidationResult } from './domain/validation';
export { withFallback, withFallbackAsync, AggregateFallbackError } from './domain/fallback';
export type { Greeter, Counter, SearchProvider, SearchResult, HttpFetcher } from './domain/interfaces';
export type { TextItem, TextMeta, TextCatalogPayload, TextSearchPayload, TextPayload } from './domain/text';

// Ports
export type { AddonLoaderPort } from './ports/addon-loader';
export type { LoggerPort } from './ports/logger';
export type { TextAddonClientPort } from './ports/text-addon-client';

// Adapters
export { FetchAddonLoader } from './adapters/http-loader';
export { HttpTextAddonClient } from './adapters/http-text-client';
export { ConsoleLogger } from './adapters/console-logger';
export { SilentLogger } from './adapters/silent-logger';