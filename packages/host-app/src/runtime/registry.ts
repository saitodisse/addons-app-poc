import type { InteractionPayload, ServiceInteraction } from '@addons-poc/protocol';

export interface RegisteredServiceDescriptor {
  version: string;
  methods: ReadonlyMap<string, { receives?: InteractionPayload; returns?: InteractionPayload }>;
}

interface ServiceEntry<T = unknown> {
  serviceId: string;
  instance: T;
  addonId: string;
  priority: number;
  descriptor?: ServiceInteraction;
}

/** Registro interno do host. O protocolo só descreve como consumidores o acessam. */
export class ServiceRegistry {
  private entries = new Map<string, ServiceEntry[]>();

  register<T>(serviceId: string, instance: T, addonId: string, priority?: number, descriptor?: ServiceInteraction): void {
    const list = this.entries.get(serviceId) ?? [];
    list.push({ serviceId, instance, addonId, priority: priority ?? descriptor?.priority ?? 0, descriptor });
    list.sort((a, b) => b.priority - a.priority || a.addonId.localeCompare(b.addonId));
    this.entries.set(serviceId, list);
  }

  get<T>(serviceId: string): T | undefined {
    return this.entries.get(serviceId)?.[0]?.instance as T | undefined;
  }

  getAll<T>(serviceId: string): T[] {
    return (this.entries.get(serviceId) ?? []).map((entry) => entry.instance as T);
  }

  has(serviceId: string): boolean {
    return (this.entries.get(serviceId)?.length ?? 0) > 0;
  }

  /** Snapshot usado para negociar consumidores antes de importar bundles. */
  describe(): ReadonlyMap<string, RegisteredServiceDescriptor> {
    const result = new Map<string, RegisteredServiceDescriptor>();
    for (const [serviceId, entries] of this.entries) {
      const descriptor = entries.find((entry) => entry.descriptor)?.descriptor;
      if (!descriptor) continue;
      const methods = new Map<string, { receives?: InteractionPayload; returns?: InteractionPayload }>();
      for (const method of descriptor.methods ?? []) methods.set(method.id, { receives: method.receives, returns: method.returns });
      result.set(serviceId, { version: descriptor.version ?? '0.0.0', methods });
    }
    return result;
  }

  clearAddon(addonId: string): void {
    for (const [serviceId, entries] of this.entries) {
      const remaining = entries.filter((entry) => entry.addonId !== addonId);
      if (remaining.length) this.entries.set(serviceId, remaining);
      else this.entries.delete(serviceId);
    }
  }
}
