import type { AddonManifest } from './manifest';
import type { AddonTab } from './tab';

export type AddonStatus = 'loading' | 'ready' | 'blocked' | 'error';

export interface AddonInstance {
  manifest: AddonManifest;
  manifestUrl: string;
  status: AddonStatus;
  error?: Error;
  /** Explicação estável para uma dependência obrigatória ainda ausente. */
  blockReason?: string;
  services: string[];
  ui?: AddonTab;
}
