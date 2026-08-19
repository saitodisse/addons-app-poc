// Domain
export type { AddonManifest, ServiceRegistration } from './domain/manifest';
export type { AddonInstance, AddonStatus } from './domain/instance';
export type { HostAPI, AddonModule } from './domain/host-api';
export { ServiceRegistry } from './domain/registry';
export type { ServiceEntry } from './domain/registry';
export { validateManifest } from './domain/validation';
export type { ValidationResult } from './domain/validation';
export { withFallback, AggregateFallbackError } from './domain/fallback';
export type { Greeter, Counter } from './domain/interfaces';

// Ports
export type { AddonLoaderPort } from './ports/addon-loader';
export type { LoggerPort } from './ports/logger';

// Adapters
export { FetchAddonLoader } from './adapters/http-loader';
export { ConsoleLogger } from './adapters/console-logger';