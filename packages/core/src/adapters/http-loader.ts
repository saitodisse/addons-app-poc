import type { ServiceRegistry } from '../domain/registry';
import type { AddonManifest } from '../domain/manifest';
import type { AddonInstance } from '../domain/instance';
import type { HostAPI, AddonModule } from '../domain/host-api';
import type { AddonLoaderPort } from '../ports/addon-loader';
import type { LoggerPort } from '../ports/logger';
import { validateManifest, validateTabContract } from '../domain/validation';
import type { DebugLog } from '../domain/debug';
import { assertProvidedService, createContractServiceAccess, getInteractionContractFingerprint } from '../domain/interactions';

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
    this.services = createContractServiceAccess(registry, this._manifest.interactions);
  }

  registerService<T>(serviceId: string, instance: T, priority?: number): void {
    // O registro recebe apenas capacidades anunciadas no manifesto.
    assertProvidedService(this._manifest.interactions, serviceId);
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
    this.registry.get<DebugLog>('debugLog')?.record({
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
        throw new Error(`HTTP ${response.status} ao buscar manifesto`);
      }
      const data = await response.json();
      const validation = validateManifest(data);
      if (!validation.valid) {
        throw new Error(`Manifest inválido: ${validation.errors.join(', ')}`);
      }
      manifest = data as AddonManifest;
    } catch (error) {
      this.logger.log('error', `Falha ao carregar manifesto: ${(error as Error).message}`);
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
        throw new Error('Manifesto em-processo deve declarar entrypoint');
      }
      module = await this.importFn(manifest.entrypoint);
    } catch (error) {
      this.logger.log('error', `Falha ao importar bundle: ${(error as Error).message}`);
      return {
        manifest,
        manifestUrl,
        status: 'error',
        error: error as Error,
        services: [],
      };
    }

    if (!module.manifest || typeof module.setup !== 'function' || typeof module.createTab !== 'function') {
      const err = new Error('Add-on deve exportar manifest, setup e createTab');
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
      if (getInteractionContractFingerprint(module.manifest.interactions) !== getInteractionContractFingerprint(manifest.interactions)) {
        throw new Error('O contrato de interação do bundle diverge do manifesto instalado');
      }
      const hostAPI = new HostAPIImpl(this.registry, manifestUrl, this.logger, manifest);
      await module.setup(hostAPI);
      const tab = module.createTab(hostAPI);
      const tabValidation = validateTabContract(manifest as unknown as Record<string, unknown>, tab);
      if (!tabValidation.valid) {
        this.registry.clearAddon(manifestUrl);
        throw new Error(`A aba diverge do contrato: ${tabValidation.errors.join(', ')}`);
      }
      this.logger.log('info', `Add-on ${manifest.id} carregado com sucesso`);
      return {
        manifest,
        manifestUrl,
        status: 'ready',
        services: hostAPI.getRegisteredServiceIds(),
        tab,
      };
    } catch (error) {
      this.logger.log('error', `Falha no setup do add-on: ${(error as Error).message}`);
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
