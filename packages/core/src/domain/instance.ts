import type { AddonManifest } from './manifest';
import type { AddonTab } from './tab';

export type AddonStatus = 'loading' | 'ready' | 'error';

export interface AddonInstance {
  manifest: AddonManifest;
  manifestUrl: string;
  status: AddonStatus;
  error?: Error;
  services: string[];
  tab?: AddonTab;
}
