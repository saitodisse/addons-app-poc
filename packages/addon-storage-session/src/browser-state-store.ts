import type { AddonStateStore } from '@addons-poc/protocol';

export class BrowserStateStore implements AddonStateStore {
  constructor(private storage: Storage | null, private prefix = 'addons:state:') {}
  async get<T>(key: string): Promise<T | undefined> { try { const value = this.storage?.getItem(`${this.prefix}${key}`); return value == null ? undefined : JSON.parse(value) as T; } catch { return undefined; } }
  async set<T>(key: string, value: T): Promise<void> { try { this.storage?.setItem(`${this.prefix}${key}`, JSON.stringify(value)); } catch { /* fallback de memória */ } }
  async remove(key: string): Promise<void> { try { this.storage?.removeItem(`${this.prefix}${key}`); } catch { /* opcional */ } }
  async listKeys(): Promise<string[]> { const keys: string[] = []; for (let index = 0; index < (this.storage?.length ?? 0); index += 1) { const key = this.storage?.key(index); if (key?.startsWith(this.prefix)) keys.push(key.slice(this.prefix.length)); } return keys.sort(); }
  async clear(): Promise<void> { for (const key of await this.listKeys()) await this.remove(key); }
}
