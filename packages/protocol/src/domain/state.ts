import type { AddonTabPersistence, AddonTabViewState } from './tab';
import type { HostAPI } from './host-api';

/** Optional serializable storage offered by a persistence add-on. */
export interface AddonStateStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  listKeys(): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * Creates a tab persistence bridge without assuming that it is available.
 * If no storage add-on is active, operations are no-ops.
 */
export function createTabStatePersistence(host: Pick<HostAPI, 'services'>, key: string): AddonTabPersistence {
  return {
    load: async () => host.services.use<AddonStateStore>({ id: 'state-store' })?.get<AddonTabViewState>(key),
    save: async (state) => {
      await host.services.use<AddonStateStore>({ id: 'state-store' })?.set(key, state);
    },
  };
}
