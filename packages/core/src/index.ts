// Domain
export type { AddonManifest, ServiceRegistration, AddonResource, AddonResourceName, AddonCatalog, AddonTabMetadata } from './domain/manifest';
export { INTERACTION_CONTRACT_VERSION, assertProvidedService, createContractServiceAccess, getInteractionContractFingerprint, getStateDestination, validateTabActionInput } from './domain/interactions';
export type { AddonInteractionContract, AddonServiceAccess, DataClassification, HttpInteraction, InteractionPayload, InteractionSchema, LogInteraction, ServiceInteraction, StateInteraction, TabActionInteraction, TabFieldInteraction } from './domain/interactions';
export type { AddonInstance, AddonStatus } from './domain/instance';
export type { HostAPI, AddonModule } from './domain/host-api';
export type { AddonTab, AddonTabField, AddonTabAction, AddonTabResult, AddonTabResultItem, AddonTabViewState, AddonTabPersistence, JsonValue } from './domain/tab';
export type { AddonStateStore } from './domain/state';
export { createTabStatePersistence } from './domain/state';
export type { AddonLogLevel, DebugEntry, DebugLog } from './domain/debug';
export { ServiceRegistry } from './domain/registry';
export type { ServiceEntry } from './domain/registry';
export { validateManifest, validateInteractionContract, validateTabContract } from './domain/validation';
export type { ValidationResult } from './domain/validation';
export { withFallback, withFallbackAsync, AggregateFallbackError } from './domain/fallback';
export type { Greeter, Counter, SearchProvider, SearchResult, HttpFetcher } from './domain/interfaces';
export type { TextItem, TextMeta, TextCatalogPayload, TextSearchPayload, TextPayload } from './domain/text';
export { toMarkdown, htmlFromMarkdown, createTextFormatter } from './domain/formatting';
export type { TextFormatter } from './domain/formatting';
export type { Bookmark, BookmarkStore, FavoritesService } from './domain/bookmarks';

// Ports
export type { AddonLoaderPort } from './ports/addon-loader';
export type { LoggerPort } from './ports/logger';
export type { TextAddonClientPort } from './ports/text-addon-client';

// Adapters
export { FetchAddonLoader } from './adapters/http-loader';
export { MemoryBookmarkStore } from './adapters/memory-bookmark-store';
export { LocalStorageBookmarkStore } from './adapters/local-storage-bookmark-store';
export { BrowserStateStore } from './adapters/browser-state-store';
export { HttpTextAddonClient } from './adapters/http-text-client';
export { ConsoleLogger } from './adapters/console-logger';
export { SilentLogger } from './adapters/silent-logger';
