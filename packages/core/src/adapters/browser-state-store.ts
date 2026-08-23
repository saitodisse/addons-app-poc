import type { AddonStateStore } from '../domain/state';

/** Adaptador compartilhado pelos add-ons de localStorage e sessionStorage. */
export class BrowserStateStore implements AddonStateStore {
  constructor(
    private storage: Storage | null,
    private prefix = 'addons:state:',
  ) {}

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.storage) return undefined;
    try {
      const raw = this.storage.getItem(this.fullKey(key));
      return raw == null ? undefined : JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.fullKey(key), JSON.stringify(value));
    } catch {
      // Armazenamento bloqueado, cheio ou dado não serializável: o add-on segue em memória.
    }
  }

  async remove(key: string): Promise<void> {
    try {
      this.storage?.removeItem(this.fullKey(key));
    } catch {
      // Remoção é opcional; não deve quebrar a extensão consumidora.
    }
  }

  async listKeys(): Promise<string[]> {
    if (!this.storage) return [];
    const keys: string[] = [];
    try {
      for (let index = 0; index < this.storage.length; index++) {
        const key = this.storage.key(index);
        if (key?.startsWith(this.prefix)) keys.push(key.slice(this.prefix.length));
      }
    } catch {
      return [];
    }
    return keys.sort();
  }

  async clear(): Promise<void> {
    if (!this.storage) return;
    for (const key of await this.listKeys()) {
      await this.remove(key);
    }
  }

  private fullKey(key: string): string {
    return `${this.prefix}${key}`;
  }
}
