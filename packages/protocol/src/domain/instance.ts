import type { AddonManifest } from './manifest';
import type { AddonTab } from './tab';

export type AddonStatus = 'loading' | 'ready' | 'blocked' | 'error';

export interface AddonInstance {
  manifest: AddonManifest;
  manifestUrl: string;
  status: AddonStatus;
  error?: Error;
  /** Stable explanation for a required dependency that is still missing. */
  blockReason?: string;
  services: string[];
  ui?: AddonTab;
}
