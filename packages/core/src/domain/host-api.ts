import type { ServiceRegistry } from './registry';
import type { AddonManifest } from './manifest';

export interface HostAPI {
  services: ServiceRegistry;
  registerService: <T>(serviceId: string, instance: T, priority?: number) => void;
  onUnload: (callback: () => void) => void;
  log: (level: 'info' | 'warn' | 'error', message: string) => void;
}

export interface AddonModule {
  manifest: AddonManifest;
  setup: (host: HostAPI) => void | Promise<void>;
}