import type { AddonInstance, AddonManifest, AddonModule, HostAPI } from '@addons-poc/protocol';
import { assertProvidedService, checkContractCompatibility, createContractServiceAccess, getInteractionContractFingerprint, validateLogEvent, validateManifest, validateTabContract } from '@addons-poc/protocol';
import type { DebugLog } from '@addons-poc/protocol';
import { ServiceRegistry } from './registry';
import { analyzeAddonDependencies } from './dependency-graph';

interface LoggerPort { log(level: 'info' | 'warn' | 'error', message: string): void; }

const HOST_CAPABILITIES = new Set(['registry.services', 'ui.tab', 'logs', 'state-store']);

class HostAPIImpl implements HostAPI {
  readonly services;
  private unload: (() => void)[] = [];
  private registered: string[] = [];

  constructor(private registry: ServiceRegistry, private addonId: string, private logger: LoggerPort, private manifest: AddonManifest) {
    this.services = createContractServiceAccess(registry, manifest.contract);
  }

  registerService<T>(serviceId: string, instance: T, priority?: number): void {
    assertProvidedService(this.manifest.contract, serviceId);
    if (!this.registered.includes(serviceId)) this.registered.push(serviceId);
    const declaration = this.manifest.contract.services.find((service) => service.id === serviceId);
    if (declaration?.priority !== undefined && priority !== undefined && declaration.priority !== priority) {
      throw new Error(`Mismatched priority for ${serviceId}: manifest ${declaration.priority}, registry ${priority}`);
    }
    this.registry.register(serviceId, instance, this.addonId, priority, declaration);
  }

  onUnload(callback: () => void): void { this.unload.push(callback); }

  log(level: 'info' | 'warn' | 'error', message: string, details?: unknown): void {
    const validation = validateLogEvent(this.manifest.contract, level, message, details);
    if (!validation.valid) throw new Error(`Log rejected: ${validation.errors.join('; ')}`);
    this.logger.log(level, `[${this.addonId}] ${message}`);
    this.registry.get<DebugLog>('addons.debug.log')?.record({ addonId: this.addonId, level, message, details, timestamp: Date.now() });
  }

  getRegisteredServiceIds(): string[] { return [...this.registered]; }
  unloadAll(): void { for (const callback of this.unload.splice(0)) callback(); }
}

export class FetchAddonLoader {
  constructor(private registry: ServiceRegistry, private logger: LoggerPort, private importFn: (url: string) => Promise<AddonModule> = (url) => import(/* @vite-ignore */ url)) {}

  async load(manifestUrl: string): Promise<AddonInstance> {
    let manifest: AddonManifest;
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status} while fetching the manifest`);
      const data = await response.json();
      const validation = validateManifest(data);
      if (!validation.valid) throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
      manifest = data as AddonManifest;
    } catch (error) {
      this.logger.log('error', `Failed to load manifest: ${(error as Error).message}`);
      return { manifest: null as unknown as AddonManifest, manifestUrl, status: 'error', error: error as Error, services: [] };
    }
    return this.loadValidated(manifestUrl, manifest);
  }

  private async loadValidated(manifestUrl: string, manifest: AddonManifest): Promise<AddonInstance> {
    const compatibility = checkContractCompatibility(manifest.contract, {
      protocolVersion: '1.0.0',
      capabilities: HOST_CAPABILITIES,
      services: this.registry.describe(),
    });
    if (!compatibility.compatible) {
      const requiredConsumers = manifest.contract.services.filter((service) => service.role === 'consumes' && service.required !== false);
      const describedServices = this.registry.describe();
      const blockedReasons = requiredConsumers.flatMap((service) => {
        const provided = describedServices.get(service.id);
        if (!provided) return [`Missing required service: ${service.id}`];
        return (service.methods ?? [])
          .filter((method) => !provided.methods.has(method.id))
          .map((method) => `Missing method in ${service.id}: ${method.id}`);
      });
      const blocked = blockedReasons.length > 0 || compatibility.errors.some((error) => error.startsWith('Missing method in') || error.startsWith('Method not declared'));
      const error = new Error(`Incompatible contract: ${compatibility.errors.join(', ')}`);
      const blockReason = blockedReasons.length > 0
        ? blockedReasons.join(', ')
        : compatibility.errors.filter((error) => error.startsWith('Missing method in') || error.startsWith('Method not declared')).join(', ');
      return { manifest, manifestUrl, status: blocked ? 'blocked' : 'error', error, blockReason: blocked ? blockReason : undefined, services: [] };
    }
    if (!manifest.entrypoint) {
      return {
        manifest,
        manifestUrl,
        status: 'ready',
        services: [],
        ui: { title: manifest.contract.ui.title ?? manifest.name, body: manifest.contract.ui.body ?? manifest.description },
      };
    }

    let module: AddonModule;
    try {
      module = await this.importFn(new URL(manifest.entrypoint, manifestUrl).href);
      if (!module.manifest || typeof module.setup !== 'function' || typeof module.createTab !== 'function') throw new Error('The add-on must export manifest, setup, and createTab');
      // The remote manifest is the source of the bundle's public URL. The
      // manifest exported by the bundle may use a build-project-relative
      // entrypoint, as local demonstration servers do.
      const bundleManifestForValidation = { ...module.manifest, entrypoint: manifest.entrypoint };
      const moduleValidation = validateManifest(bundleManifestForValidation);
      if (!moduleValidation.valid) throw new Error(`Invalid bundle manifest: ${moduleValidation.errors.join(', ')}`);
      if (module.manifest.id !== manifest.id || module.manifest.version !== manifest.version) throw new Error('The bundle identity or version differs from the installed manifest');
      if (getInteractionContractFingerprint(module.manifest.contract) !== getInteractionContractFingerprint(manifest.contract)) throw new Error('The bundle contract differs from the installed manifest');
    } catch (error) {
      this.logger.log('error', `Failed to import bundle: ${(error as Error).message}`);
      return { manifest, manifestUrl, status: 'error', error: error as Error, services: [] };
    }
    const api = new HostAPIImpl(this.registry, manifestUrl, this.logger, manifest);
    try {
      await module.setup(api);
      const ui = module.createTab(api);
      const tabValidation = validateTabContract(manifest as unknown as Record<string, unknown>, ui);
      if (!tabValidation.valid) throw new Error(`The tab differs from the contract: ${tabValidation.errors.join(', ')}`);
      return { manifest, manifestUrl, status: 'ready', services: api.getRegisteredServiceIds(), ui };
    } catch (error) {
      api.unloadAll();
      this.registry.clearAddon(manifestUrl);
      return { manifest, manifestUrl, status: 'error', error: error as Error, services: [] };
    }
  }

  /** Pre-validates a set of URLs and runs each required provider before its consumers. */
  async loadAll(manifestUrls: string[]): Promise<AddonInstance[]> {
    const inputs: { key: string; manifest: AddonManifest }[] = [];
    const invalid = new Map<string, AddonInstance>();
    for (const manifestUrl of manifestUrls) {
      try {
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} while fetching the manifest`);
        const data = await response.json();
        const validation = validateManifest(data);
        if (!validation.valid) throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
        inputs.push({ key: manifestUrl, manifest: data as AddonManifest });
      } catch (error) {
        invalid.set(manifestUrl, { manifest: null as unknown as AddonManifest, manifestUrl, status: 'error', error: error as Error, services: [] });
      }
    }

    const analysis = analyzeAddonDependencies(inputs);
    const results = new Map<string, AddonInstance>(invalid);
    const visiting = new Set<string>();
    const loaded = new Set<string>();
    const byKey = new Map(inputs.map((input) => [input.key, input]));
    const loadOne = async (key: string): Promise<void> => {
      if (loaded.has(key) || visiting.has(key)) return;
      const status = analysis.statuses.get(key);
      const input = byKey.get(key);
      if (!status || !input) return;
      if (status.status === 'blocked') {
        results.set(key, { manifest: input.manifest, manifestUrl: key, status: 'blocked', blockReason: status.errors.join(', '), error: new Error(status.errors.join(', ')), services: [] });
        loaded.add(key);
        return;
      }
      visiting.add(key);
      for (const provider of Object.values(status.providers)) await loadOne(provider);
      visiting.delete(key);
      const instance = await this.loadValidated(key, input.manifest);
      results.set(key, instance);
      loaded.add(key);
    };
    for (const input of inputs) await loadOne(input.key);
    return manifestUrls.map((manifestUrl) => results.get(manifestUrl)!).filter(Boolean);
  }
}
