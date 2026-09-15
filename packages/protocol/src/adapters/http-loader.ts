import type { ServiceRegistry } from '../domain/registry';
import type { AddonManifest } from '../domain/manifest';
import type { AddonInstance } from '../domain/instance';
import type { HostAPI, AddonModule } from '../domain/host-api';
import type { AddonLoaderPort } from '../ports/addon-loader';
import type { LoggerPort } from '../ports/logger';
import { validateManifest, validateTabContract } from '../domain/validation';
import type { DebugLog } from '../domain/debug';
import { assertProvidedService, createContractServiceAccess, getInteractionContractFingerprint } from '../domain/contract';

class HostAPIImpl implements HostAPI {
  public services;
  private _onUnloadCallbacks: (() => void)[] = [];
  private _registeredServices: string[] = [];

  constructor(
    private registry: ServiceRegistry,
    private _addonId: string,
    private _logger: LoggerPort,
    private _manifest: AddonManifest,
  ) {
    this.services = createContractServiceAccess(registry, this._manifest.contract);
  }

  registerService<T>(serviceId: string, instance: T, priority?: number): void {
    // The registry receives only capabilities announced in the manifest.
    assertProvidedService(this._manifest.contract, serviceId);
    if (!this._registeredServices.includes(serviceId)) {
      this._registeredServices.push(serviceId);
    }
    this.registry.register(serviceId, instance, this._addonId, priority);
  }

  onUnload(callback: () => void): void {
    this._onUnloadCallbacks.push(callback);
  }

  log(level: 'info' | 'warn' | 'error', message: string, details?: unknown): void {
    this._logger.log(level, `[${this._addonId}] ${message}`);
      this.registry.get<DebugLog>('addons.debug.log')?.record({
      addonId: this._addonId,
      level,
      message,
      details,
      timestamp: Date.now(),
    });
  }

  getUnloadCallbacks(): (() => void)[] {
    return [...this._onUnloadCallbacks];
  }

  getRegisteredServiceIds(): string[] {
    return [...this._registeredServices];
  }
}

export class FetchAddonLoader implements AddonLoaderPort {
  constructor(
    private registry: ServiceRegistry,
    private logger: LoggerPort,
    private importFn: (url: string) => Promise<AddonModule> = (url) => import(url),
  ) {}

  async load(manifestUrl: string): Promise<AddonInstance> {
    let manifest: AddonManifest;
    try {
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} while fetching the manifest`);
      }
      const data = await response.json();
      const validation = validateManifest(data);
      if (!validation.valid) {
        throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
      }
      manifest = data as AddonManifest;
    } catch (error) {
      this.logger.log('error', `Failed to load manifest: ${(error as Error).message}`);
      return {
        manifest: null as unknown as AddonManifest,
        manifestUrl,
        status: 'error',
        error: error as Error,
        services: [],
      };
    }

    let module: AddonModule;
    try {
      if (!manifest.entrypoint) {
        throw new Error('In-process manifest must declare an entrypoint');
      }
      module = await this.importFn(manifest.entrypoint);
    } catch (error) {
      this.logger.log('error', `Failed to import bundle: ${(error as Error).message}`);
      return {
        manifest,
        manifestUrl,
        status: 'error',
        error: error as Error,
        services: [],
      };
    }

    if (!module.manifest || typeof module.setup !== 'function' || typeof module.createTab !== 'function') {
      const err = new Error('Add-on must export manifest, setup, and createTab');
      this.logger.log('error', err.message);
      return {
        manifest,
        manifestUrl,
        status: 'error',
        error: err,
        services: [],
      };
    }

    try {
      if (getInteractionContractFingerprint(module.manifest.contract) !== getInteractionContractFingerprint(manifest.contract)) {
        throw new Error('The bundle interaction contract differs from the installed manifest');
      }
      const hostAPI = new HostAPIImpl(this.registry, manifestUrl, this.logger, manifest);
      await module.setup(hostAPI);
      const tab = module.createTab(hostAPI);
      const tabValidation = validateTabContract(manifest as unknown as Record<string, unknown>, tab);
      if (!tabValidation.valid) {
        this.registry.clearAddon(manifestUrl);
        throw new Error(`The tab differs from the contract: ${tabValidation.errors.join(', ')}`);
      }
      this.logger.log('info', `Add-on ${manifest.id} loaded successfully`);
      return {
        manifest,
        manifestUrl,
        status: 'ready',
        services: hostAPI.getRegisteredServiceIds(),
        ui: tab,
      };
    } catch (error) {
      this.logger.log('error', `Add-on setup failed: ${(error as Error).message}`);
      return {
        manifest,
        manifestUrl,
        status: 'error',
        error: error as Error,
        services: [],
      };
    }
  }
}
