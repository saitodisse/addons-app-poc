import type { AddonInstance } from '../domain/instance';

export interface AddonLoaderPort {
  load(manifestUrl: string): Promise<AddonInstance>;
}