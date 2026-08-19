import type { AddonManifest } from './manifest';

export type AddonStatus = 'loading' | 'ready' | 'error';

export interface AddonInstance {
  manifest: AddonManifest;
  manifestUrl: string;
  status: AddonStatus;
  error?: Error;
  services: string[];
}