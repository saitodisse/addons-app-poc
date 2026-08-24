import type { AddonTabPersistence, AddonTabViewState } from './tab';
import type { HostAPI } from './host-api';

/** Armazenamento opcional e serializável oferecido por um add-on de persistência. */
export interface AddonStateStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  listKeys(): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * Cria a ponte de persistência de uma aba sem assumir que ela esteja disponível.
 * Se nenhum add-on de armazenamento estiver ativo, as operações são no-op.
 */
export function createTabStatePersistence(host: Pick<HostAPI, 'services'>, key: string): AddonTabPersistence {
  return {
    load: async () => host.services.use<AddonStateStore>({ id: 'state-store' })?.get<AddonTabViewState>(key),
    save: async (state) => {
      await host.services.use<AddonStateStore>({ id: 'state-store' })?.set(key, state);
    },
  };
}
