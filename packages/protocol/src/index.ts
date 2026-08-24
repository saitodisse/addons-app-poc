// Domain
export { defineAddonManifest } from './domain/manifest';
export type { AddonManifest, AddonManifestInput, ServiceRegistration, AddonResource, AddonResourceName, AddonCatalog, AddonTabMetadata } from './domain/manifest';
export { PROTOCOL_VERSION, INTERACTION_CONTRACT_VERSION, assertProvidedService, checkContractCompatibility, checkServiceCompatibility, createContractServiceAccess, getInteractionContractFingerprint, getStateDestination, parseSemVer, semverSatisfies, validateTabActionInput } from './domain/contract';
export type { AddonContract, AddonInteractionContract, AddonServiceAccess, DataClassification, HostCompatibility, CompatibilityResult, HttpInteraction, InteractionPayload, InteractionSchema, LogInteraction, ServiceCompatibilityDescriptor, ServiceContractRef, ServiceInteraction, StateInteraction, TabActionInteraction, TabFieldInteraction } from './domain/contract';
export type { AddonInstance, AddonStatus } from './domain/instance';
export type { HostAPI, AddonModule } from './domain/host-api';
export type { AddonTab, AddonTabField, AddonTabAction, AddonTabResult, AddonTabResultItem, AddonTabViewState, AddonTabPersistence, JsonValue } from './domain/tab';
export type { AddonStateStore } from './domain/state';
export { createTabStatePersistence } from './domain/state';
export type { AddonLogLevel, DebugEntry, DebugLog } from './domain/debug';
export { validateManifest, validateInteractionContract, validateTabContract } from './domain/validation';
export type { ValidationResult } from './domain/validation';
export { validateLogEvent, validatePayloadValue, validateServiceCallInput, validateServiceCallOutput, validateStateValue, validateTabResult, validateTabResultType, validateValueAgainstSchema } from './domain/runtime-validation';
export type { RuntimeValidationResult } from './domain/runtime-validation';
export type { TextItem, TextMeta, TextCatalogPayload, TextSearchPayload, TextPayload } from './domain/text';

// Ports
export type { TextAddonClientPort } from './ports/text-addon-client';
