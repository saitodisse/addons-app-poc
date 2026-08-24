export interface ServiceEntry<T = unknown> {
  serviceId: string;
  instance: T;
  addonId: string;
  priority: number;
}

export class ServiceRegistry {
  private _entries = new Map<string, ServiceEntry[]>();

  register<T>(serviceId: string, instance: T, addonId: string, priority = 0): void {
    const entry: ServiceEntry<T> = { serviceId, instance, addonId, priority };
    const list = this._entries.get(serviceId) ?? [];
    list.push(entry as ServiceEntry);
    list.sort((a, b) => b.priority - a.priority);
    this._entries.set(serviceId, list);
  }

  unregister(serviceId: string, addonId: string): void {
    const list = this._entries.get(serviceId);
    if (!list) return;
    const remaining = list.filter(e => e.addonId !== addonId);
    if (remaining.length === 0) {
      this._entries.delete(serviceId);
    } else {
      this._entries.set(serviceId, remaining);
    }
  }

  get<T>(serviceId: string): T | undefined {
    const list = this._entries.get(serviceId);
    if (!list || list.length === 0) return undefined;
    return list[0]!.instance as T;
  }

  getAll<T>(serviceId: string): T[] {
    const list = this._entries.get(serviceId);
    return (list ?? []).map(e => e.instance as T);
  }

  has(serviceId: string): boolean {
    const list = this._entries.get(serviceId);
    return list !== undefined && list.length > 0;
  }

  clear(): void {
    this._entries.clear();
  }

  clearAddon(addonId: string): void {
    for (const [serviceId, list] of this._entries) {
      const remaining = list.filter(e => e.addonId !== addonId);
      if (remaining.length === 0) {
        this._entries.delete(serviceId);
      } else {
        this._entries.set(serviceId, remaining);
      }
    }
  }
}