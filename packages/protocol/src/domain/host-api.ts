import type { AddonManifest } from './manifest';
import type { AddonTab } from './tab';
import type { AddonLogLevel } from './debug';
import type { AddonServiceAccess } from './contract';

export interface HostAPI {
  services: AddonServiceAccess;
  registerService: <T>(serviceId: string, instance: T, priority?: number) => void;
  onUnload: (callback: () => void) => void;
  log: (level: AddonLogLevel, message: string, details?: unknown) => void;
}

export interface AddonModule {
  manifest: AddonManifest;
  setup: (host: HostAPI) => void | Promise<void>;
  createTab: (host: HostAPI) => AddonTab;
}
