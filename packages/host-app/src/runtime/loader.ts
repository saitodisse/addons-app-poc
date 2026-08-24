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
      throw new Error(`Prioridade divergente para ${serviceId}: manifesto ${declaration.priority}, registro ${priority}`);
    }
    this.registry.register(serviceId, instance, this.addonId, priority, declaration);
  }

  onUnload(callback: () => void): void { this.unload.push(callback); }

  log(level: 'info' | 'warn' | 'error', message: string, details?: unknown): void {
    const validation = validateLogEvent(this.manifest.contract, level, message, details);
    if (!validation.valid) throw new Error(`Log rejeitado: ${validation.errors.join('; ')}`);
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
      if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar manifesto`);
      const data = await response.json();
      const validation = validateManifest(data);
      if (!validation.valid) throw new Error(`Manifesto inválido: ${validation.errors.join(', ')}`);
      manifest = data as AddonManifest;
    } catch (error) {
      this.logger.log('error', `Falha ao carregar manifesto: ${(error as Error).message}`);
      return { manifest: null as unknown as AddonManifest, manifestUrl, status: 'error', error: error as Error, services: [] };
    }
    const compatibility = checkContractCompatibility(manifest.contract, {
      protocolVersion: '1.0.0',
      capabilities: HOST_CAPABILITIES,
      services: this.registry.describe(),
    });
    if (!compatibility.compatible) {
      const blocked = compatibility.errors.some((error) => error.startsWith('Serviço obrigatório ausente') || error.startsWith('Método ausente'));
      const error = new Error(`Contrato incompatível: ${compatibility.errors.join(', ')}`);
      return { manifest, manifestUrl, status: blocked ? 'blocked' : 'error', error, blockReason: blocked ? compatibility.errors.join(', ') : undefined, services: [] };
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
      if (!module.manifest || typeof module.setup !== 'function' || typeof module.createTab !== 'function') throw new Error('Add-on deve exportar manifest, setup e createTab');
      // O manifesto remoto é a fonte da URL pública do bundle. O manifesto
      // exportado pelo bundle pode usar um entrypoint relativo ao projeto de
      // build, como ocorre nos servidores locais da demonstração.
      const bundleManifestForValidation = { ...module.manifest, entrypoint: manifest.entrypoint };
      const moduleValidation = validateManifest(bundleManifestForValidation);
      if (!moduleValidation.valid) throw new Error(`Manifesto do bundle inválido: ${moduleValidation.errors.join(', ')}`);
      if (module.manifest.id !== manifest.id || module.manifest.version !== manifest.version) throw new Error('A identidade ou versão do bundle diverge do manifesto instalado');
      if (getInteractionContractFingerprint(module.manifest.contract) !== getInteractionContractFingerprint(manifest.contract)) throw new Error('O contrato do bundle diverge do manifesto instalado');
    } catch (error) {
      this.logger.log('error', `Falha ao importar bundle: ${(error as Error).message}`);
      return { manifest, manifestUrl, status: 'error', error: error as Error, services: [] };
    }
    const api = new HostAPIImpl(this.registry, manifestUrl, this.logger, manifest);
    try {
      await module.setup(api);
      const ui = module.createTab(api);
      const tabValidation = validateTabContract(manifest as unknown as Record<string, unknown>, ui);
      if (!tabValidation.valid) throw new Error(`A aba diverge do contrato: ${tabValidation.errors.join(', ')}`);
      return { manifest, manifestUrl, status: 'ready', services: api.getRegisteredServiceIds(), ui };
    } catch (error) {
      api.unloadAll();
      this.registry.clearAddon(manifestUrl);
      return { manifest, manifestUrl, status: 'error', error: error as Error, services: [] };
    }
  }

  /** Pré-valida um conjunto de URLs e importa provedores antes dos consumidores. */
  async loadAll(manifestUrls: string[]): Promise<AddonInstance[]> {
    const inputs: { key: string; manifest: AddonManifest }[] = [];
    const invalid = new Map<string, AddonInstance>();
    for (const manifestUrl of manifestUrls) {
      try {
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar manifesto`);
        const data = await response.json();
        const validation = validateManifest(data);
        if (!validation.valid) throw new Error(`Manifesto inválido: ${validation.errors.join(', ')}`);
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
      const instance = await this.load(key);
      results.set(key, instance);
      loaded.add(key);
    };
    for (const input of inputs) await loadOne(input.key);
    return manifestUrls.map((manifestUrl) => results.get(manifestUrl)!).filter(Boolean);
  }
}
