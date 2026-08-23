import { useCallback, useEffect, useState, useRef } from 'react';
import { ServiceRegistry, ConsoleLogger, FetchAddonLoader, assertProvidedService, createContractServiceAccess, getInteractionContractFingerprint, validateInteractionContract, validateManifest, validateTabContract } from '@addons/core';
import type { AddonInstance, AddonManifest, DebugLog, HostAPI, AddonModule } from '@addons/core';
import { Header } from './components/Header';
import { AddonManager } from './components/AddonManager';
import { AddonSidebar } from './components/AddonSidebar';
import { AddonTabView } from './components/AddonTabView';
import { manifestUrlDaRota, navegar, RUTAS, rotaDoAddon, useRuta } from './router';

// Hello add-on
import * as helloModule from '@addons/addon-hello';
// Hello PT add-on
import * as helloPtModule from '@addons/addon-hello-pt';
// Counter add-on
import * as counterModule from '@addons/addon-counter';
// Markdown add-on
import * as markdownModule from '@addons/addon-markdown';
// Aggregator add-on
import * as aggregatorModule from '@addons/addon-aggregator';
// Favorites add-on
import * as favoritesModule from '@addons/addon-favorites';
// Health Check add-on
import * as healthModule from '@addons/addon-health';
// Persistência opcional
import * as storageLocalModule from '@addons/addon-storage-local';
import * as storageSessionModule from '@addons/addon-storage-session';
// Observabilidade opcional
import * as debugModule from '@addons/addon-debug';

type AddonKey = 'hello' | 'hello-pt' | 'counter' | 'markdown' | 'aggregator' | 'favorites' | 'health' | 'storage-local' | 'storage-session' | 'debug';

interface AddonInfo {
  key: AddonKey;
  name: string;
  description: string;
  manifestUrl: string;
  module: () => AddonModule;
}

// Hello add-on
const ADDONS: Record<AddonKey, AddonInfo> = {
  hello: {
    key: 'hello',
    name: helloModule.manifest.name,
    description: helloModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-hello/manifest.json',
    module: () => helloModule,
  },
  'hello-pt': {
    key: 'hello-pt',
    name: helloPtModule.manifest.name,
    description: helloPtModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-hello-pt/manifest.json',
    module: () => helloPtModule,
  },
  counter: {
    key: 'counter',
    name: counterModule.manifest.name,
    description: counterModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-counter/manifest.json',
    module: () => counterModule,
  },
  markdown: {
    key: 'markdown',
    name: markdownModule.manifest.name,
    description: markdownModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-markdown/manifest.json',
    module: () => markdownModule,
  },
  aggregator: {
    key: 'aggregator',
    name: aggregatorModule.manifest.name,
    description: aggregatorModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-aggregator/manifest.json',
    module: () => aggregatorModule,
  },
  favorites: {
    key: 'favorites',
    name: favoritesModule.manifest.name,
    description: favoritesModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-favorites/manifest.json',
    module: () => favoritesModule,
  },
  health: {
    key: 'health',
    name: healthModule.manifest.name,
    description: healthModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-health/manifest.json',
    module: () => healthModule,
  },
  'storage-local': {
    key: 'storage-local',
    name: storageLocalModule.manifest.name,
    description: storageLocalModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-storage-local/manifest.json',
    module: () => storageLocalModule,
  },
  'storage-session': {
    key: 'storage-session',
    name: storageSessionModule.manifest.name,
    description: storageSessionModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-storage-session/manifest.json',
    module: () => storageSessionModule,
  },
  debug: {
    key: 'debug',
    name: debugModule.manifest.name,
    description: debugModule.manifest.description,
    manifestUrl: 'http://localhost:5280/packages/addon-debug/manifest.json',
    module: () => debugModule,
  },
};

const DEFAULT_KEYS: AddonKey[] = [];
const ALL_KEYS: AddonKey[] = ['storage-local', 'storage-session', 'debug', 'hello', 'hello-pt', 'counter', 'markdown', 'aggregator', 'favorites', 'health'];
const INSTALLATIONS_STORAGE_KEY = 'addons:host-installations:v1';

const EMPTY_INTERACTIONS = {
  version: '1.0.0',
  services: [],
  tab: { fields: [], actions: [] },
  state: [],
  http: [],
  logs: [],
};

interface PersistedInstallations {
  manifestUrls: string[];
  disabledManifestUrls: string[];
  acceptedContractFingerprints: Record<string, string>;
}

function readPersistedInstallations(): PersistedInstallations {
  if (typeof window === 'undefined') return { manifestUrls: [], disabledManifestUrls: [], acceptedContractFingerprints: {} };
  try {
    const saved = JSON.parse(window.localStorage.getItem(INSTALLATIONS_STORAGE_KEY) ?? '{}') as Partial<PersistedInstallations>;
    const manifestUrls = Array.isArray(saved.manifestUrls) ? saved.manifestUrls.filter((url): url is string => typeof url === 'string') : [];
    const disabledManifestUrls = Array.isArray(saved.disabledManifestUrls)
      ? saved.disabledManifestUrls.filter((url): url is string => typeof url === 'string' && manifestUrls.includes(url))
      : [];
    const acceptedContractFingerprints = saved.acceptedContractFingerprints && typeof saved.acceptedContractFingerprints === 'object'
      ? Object.fromEntries(Object.entries(saved.acceptedContractFingerprints).filter(([url, fingerprint]) => manifestUrls.includes(url) && typeof fingerprint === 'string'))
      : {};
    return { manifestUrls: [...new Set(manifestUrls)], disabledManifestUrls: [...new Set(disabledManifestUrls)], acceptedContractFingerprints };
  } catch {
    return { manifestUrls: [], disabledManifestUrls: [], acceptedContractFingerprints: {} };
  }
}

function normalizeManifestUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('A URL precisa usar http ou https');
  return url.href;
}

function persistInstallations(installations: PersistedInstallations): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INSTALLATIONS_STORAGE_KEY, JSON.stringify(installations));
  } catch {
    // Se o navegador bloquear localStorage, a instalação continua válida até esta aba ser recarregada.
  }
}

function installationOrder(manifestUrl: string): number {
  const key = ALL_KEYS.find((candidate) => ADDONS[candidate].manifestUrl === manifestUrl);
  if (key === 'storage-local' || key === 'storage-session') return 0;
  if (key === 'debug') return 1;
  return 2;
}

export interface AddonSuggestion {
  manifestUrl: string;
  name: string;
  description: string;
}

const SUGGESTIONS: AddonSuggestion[] = ALL_KEYS.map((key) => ({
  manifestUrl: ADDONS[key].manifestUrl,
  name: ADDONS[key].name,
  description: ADDONS[key].description,
}));

export function App() {
  const [registry] = useState(() => new ServiceRegistry());
  const [logger] = useState(() => new ConsoleLogger());
  const [addons, setAddons] = useState<AddonInstance[]>([]);
  const [disabledAddonUrls, setDisabledAddonUrls] = useState<string[]>([]);
  const [acceptedContractFingerprints, setAcceptedContractFingerprints] = useState<Record<string, string>>({});
  const [pendingContractUrls, setPendingContractUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [installationsReady, setInstallationsReady] = useState(false);
  const loadedRef = useRef(false);
  const rota = useRuta();

  const loadBundledAddon = useCallback(async (key: AddonKey): Promise<AddonInstance> => {
    const info = ADDONS[key];

    try {
      const mod = info.module();
      const contractValidation = validateInteractionContract(mod.manifest as unknown as Record<string, unknown>);
      if (!contractValidation.valid) {
        throw new Error(`Contrato de interação inválido: ${contractValidation.errors.join(', ')}`);
      }
      const host: HostAPI = {
        services: createContractServiceAccess(registry, mod.manifest.interactions),
        registerService: <T,>(serviceId: string, instance: T, priority?: number) => {
          assertProvidedService(mod.manifest.interactions, serviceId);
          registry.register(serviceId, instance, info.manifestUrl, priority);
        },
        onUnload: () => {},
        log: (level, message, details) => {
          logger.log(level, `[${info.manifestUrl}] ${message}`);
          registry.get<DebugLog>('debugLog')?.record({
            addonId: info.manifestUrl,
            level,
            message,
            details,
            timestamp: Date.now(),
          });
        },
      };
      await mod.setup(host);
      const tab = mod.createTab(host);
      const tabValidation = validateTabContract(mod.manifest as unknown as Record<string, unknown>, tab);
      if (!tabValidation.valid) {
        registry.clearAddon(info.manifestUrl);
        throw new Error(`A aba diverge do contrato: ${tabValidation.errors.join(', ')}`);
      }
      return {
        manifest: mod.manifest,
        manifestUrl: info.manifestUrl,
        status: 'ready',
        services: (mod.manifest.services ?? []).map((service) => service.id),
        tab,
      };
    } catch (error) {
      logger.log('error', `Erro ao carregar ${info.name}: ${error}`);
      return {
        manifest: {
          id: key,
          version: '0.0.0',
          name: info.name,
          description: 'Falha ao carregar',
          author: '-',
          license: '-',
          tab: info.module().manifest.tab,
          entrypoint: info.manifestUrl,
          services: [],
          interactions: EMPTY_INTERACTIONS,
        },
        manifestUrl: info.manifestUrl,
        status: 'error',
        error: error as Error,
        services: [],
        tab: {
          ...info.module().manifest.tab,
        },
      };
    }
  }, [logger, registry]);

  const loadRemoteAddon = useCallback(async (manifestUrl: string): Promise<AddonInstance> => {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao buscar manifesto`);
    }

    const manifest = await response.json() as AddonManifest;
    const validation = validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Manifesto inválido: ${validation.errors.join(', ')}`);
    }

    if (!manifest.entrypoint) {
      return {
        manifest,
        manifestUrl,
        status: 'ready',
        services: [],
        tab: { ...manifest.tab },
      };
    }

    return new FetchAddonLoader(registry, logger).load(manifestUrl);
  }, [logger, registry]);

  const inspectManifest = useCallback(async (value: string): Promise<AddonManifest> => {
    const manifestUrl = normalizeManifestUrl(value);
    const bundledKey = ALL_KEYS.find((key) => ADDONS[key].manifestUrl === manifestUrl);
    if (bundledKey) {
      const manifest = ADDONS[bundledKey].module().manifest;
      const validation = validateInteractionContract(manifest as unknown as Record<string, unknown>);
      if (!validation.valid) throw new Error(`Contrato de interação inválido: ${validation.errors.join(', ')}`);
      return manifest;
    }
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status} ao buscar manifesto`);
    const manifest = await response.json() as AddonManifest;
    const validation = validateManifest(manifest);
    if (!validation.valid) throw new Error(`Manifesto inválido: ${validation.errors.join(', ')}`);
    return manifest;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      const loadInitialAddons = async () => {
        setLoading(true);
        const instances: AddonInstance[] = [];
        const persisted = readPersistedInstallations();
        const initialUrls = persisted.manifestUrls.length
          ? persisted.manifestUrls
          : DEFAULT_KEYS.map((key) => ADDONS[key].manifestUrl);
        const sortedUrls = initialUrls
          .map((url, index) => ({ url, index }))
          .sort((left, right) => installationOrder(left.url) - installationOrder(right.url) || left.index - right.index)
          .map(({ url }) => url);
        const pending: string[] = [];

        for (const manifestUrl of sortedUrls) {
          const bundledKey = ALL_KEYS.find((key) => ADDONS[key].manifestUrl === manifestUrl);
          try {
            const instance = bundledKey
              ? await loadBundledAddon(bundledKey)
              : await loadRemoteAddon(manifestUrl);
            if (instance.status === 'ready') {
              instances.push(instance);
              const fingerprint = getInteractionContractFingerprint(instance.manifest.interactions);
              if (persisted.acceptedContractFingerprints[manifestUrl] !== fingerprint) {
                pending.push(manifestUrl);
                registry.clearAddon(manifestUrl);
              }
            }
          } catch (error) {
            console.error('Não foi possível restaurar o add-on instalado', { manifestUrl, error });
          }
        }
        setAddons(instances);
        setAcceptedContractFingerprints(persisted.acceptedContractFingerprints);
        setPendingContractUrls(pending);
        setDisabledAddonUrls([...new Set([
          ...persisted.disabledManifestUrls.filter((url) => instances.some((addon) => addon.manifestUrl === url)),
          ...pending,
        ])]);
        setInstallationsReady(true);
        setLoading(false);
      };
      void loadInitialAddons();
    }
  }, [loadBundledAddon, loadRemoteAddon]);

  useEffect(() => {
    if (!installationsReady) return;
    persistInstallations({
      manifestUrls: addons.map((addon) => addon.manifestUrl),
      disabledManifestUrls: disabledAddonUrls.filter((url) => addons.some((addon) => addon.manifestUrl === url)),
      acceptedContractFingerprints: Object.fromEntries(addons.flatMap((addon) => {
        const fingerprint = acceptedContractFingerprints[addon.manifestUrl];
        return fingerprint ? [[addon.manifestUrl, fingerprint]] : [];
      })),
    });
  }, [acceptedContractFingerprints, addons, disabledAddonUrls, installationsReady]);

  const logInstalledContract = (installed: AddonInstance) => {
    console.info('Contrato do add-on instalado', {
      manifest: installed.manifest,
      manifestUrl: installed.manifestUrl,
      status: installed.status,
      services: installed.services,
    });
  };

  const installFromUrl = useCallback(async (value: string, acceptedFingerprint: string): Promise<string | undefined> => {
    let manifestUrl: string;
    try {
      manifestUrl = normalizeManifestUrl(value);
    } catch (error) {
      return (error as Error).message || 'Informe uma URL de manifesto válida';
    }

    if (addons.some((addon) => addon.manifestUrl === manifestUrl)) {
      return 'Este add-on já está instalado';
    }

    const bundledKey = ALL_KEYS.find((key) => ADDONS[key].manifestUrl === manifestUrl);
    setLoading(true);
    try {
      const installed = bundledKey
        ? await loadBundledAddon(bundledKey)
        : await loadRemoteAddon(manifestUrl);

      if (installed.status === 'error') {
        return installed.error?.message ?? 'Não foi possível instalar o add-on';
      }
      const currentFingerprint = getInteractionContractFingerprint(installed.manifest.interactions);
      if (currentFingerprint !== acceptedFingerprint) {
        registry.clearAddon(manifestUrl);
        return 'O contrato mudou durante a instalação. Revise-o novamente antes de aceitar.';
      }

      setAddons((current) => [...current, installed]);
      setAcceptedContractFingerprints((current) => ({ ...current, [manifestUrl]: currentFingerprint }));
      logInstalledContract(installed);
      return undefined;
    } catch (error) {
      return (error as Error).message || 'Não foi possível instalar o add-on';
    } finally {
      setLoading(false);
    }
  }, [addons, loadBundledAddon, loadRemoteAddon, registry]);

  const toggleAddon = useCallback(async (manifestUrl: string) => {
    const addon = addons.find((current) => current.manifestUrl === manifestUrl);
    if (!addon) return;

    if (pendingContractUrls.includes(manifestUrl)) return;

    if (!disabledAddonUrls.includes(manifestUrl)) {
      registry.clearAddon(manifestUrl);
      setDisabledAddonUrls((urls) => [...urls, manifestUrl]);
      return;
    }

    const bundledKey = ALL_KEYS.find((key) => ADDONS[key].manifestUrl === manifestUrl);
    setLoading(true);
    try {
      const reloaded = bundledKey
        ? await loadBundledAddon(bundledKey)
        : await loadRemoteAddon(manifestUrl);

      if (reloaded.status === 'ready') {
        setAddons((current) => current.map((item) => item.manifestUrl === manifestUrl ? reloaded : item));
        setDisabledAddonUrls((urls) => urls.filter((url) => url !== manifestUrl));
      } else {
        console.error('Não foi possível ativar o add-on', reloaded.error);
      }
    } catch (error) {
      console.error('Não foi possível ativar o add-on', error);
    } finally {
      setLoading(false);
    }
  }, [addons, disabledAddonUrls, loadBundledAddon, loadRemoteAddon, pendingContractUrls, registry]);

  const acceptContract = useCallback(async (manifestUrl: string) => {
    const addon = addons.find((current) => current.manifestUrl === manifestUrl);
    if (!addon) return;
    const reviewedFingerprint = getInteractionContractFingerprint(addon.manifest.interactions);
    const bundledKey = ALL_KEYS.find((key) => ADDONS[key].manifestUrl === manifestUrl);
    setLoading(true);
    try {
      const reloaded = bundledKey ? await loadBundledAddon(bundledKey) : await loadRemoteAddon(manifestUrl);
      if (reloaded.status !== 'ready') return;
      if (getInteractionContractFingerprint(reloaded.manifest.interactions) !== reviewedFingerprint) {
        setAddons((current) => current.map((item) => item.manifestUrl === manifestUrl ? reloaded : item));
        return;
      }
      setAddons((current) => current.map((item) => item.manifestUrl === manifestUrl ? reloaded : item));
      setAcceptedContractFingerprints((current) => ({ ...current, [manifestUrl]: reviewedFingerprint }));
      setPendingContractUrls((urls) => urls.filter((url) => url !== manifestUrl));
      setDisabledAddonUrls((urls) => urls.filter((url) => url !== manifestUrl));
    } finally {
      setLoading(false);
    }
  }, [addons, loadBundledAddon, loadRemoteAddon]);

  const removeAddon = useCallback((manifestUrl: string) => {
    registry.clearAddon(manifestUrl);
    setAddons((current) => current.filter((addon) => addon.manifestUrl !== manifestUrl));
    setDisabledAddonUrls((urls) => urls.filter((url) => url !== manifestUrl));
    setPendingContractUrls((urls) => urls.filter((url) => url !== manifestUrl));
    setAcceptedContractFingerprints((current) => {
      const { [manifestUrl]: _removed, ...remaining } = current;
      return remaining;
    });
  }, [registry]);
  const activeAddons = addons.filter((addon) =>
    addon.status === 'ready' &&
    addon.tab &&
    !disabledAddonUrls.includes(addon.manifestUrl),
  );

  const selectedManifestUrl = manifestUrlDaRota(rota);
  const selectedAddon = activeAddons.find((addon) => addon.manifestUrl === selectedManifestUrl) ?? null;

  useEffect(() => {
    if (!loading && selectedManifestUrl && !selectedAddon) {
      navegar(RUTAS.inicio);
    }
  }, [loading, selectedAddon, selectedManifestUrl]);

  const selectAddon = useCallback((manifestUrl: string) => {
    navegar(rotaDoAddon(manifestUrl));
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <Header addons={addons.filter((addon) => !disabledAddonUrls.includes(addon.manifestUrl))} />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px' }}>
        {rota === RUTAS.settings ? (
          <section>
            <AddonManager
              addons={addons}
              disabledAddonUrls={disabledAddonUrls}
              pendingContractUrls={pendingContractUrls}
              onInspectManifest={inspectManifest}
              onInstallFromUrl={installFromUrl}
              onToggle={toggleAddon}
              onRemove={removeAddon}
              onAcceptContract={acceptContract}
              suggestions={SUGGESTIONS}
              loading={loading}
            />
          </section>
        ) : (
          <section>
            <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 12 }}>
              Demonstração ao Vivo
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(216px, 276px) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
              <AddonSidebar
                addons={addons}
                disabledAddonUrls={disabledAddonUrls}
                selectedManifestUrl={selectedManifestUrl}
                loading={loading}
                onSelect={selectAddon}
                onToggle={toggleAddon}
              />

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12,
                padding: 24,
                minHeight: 300,
              }}>
                {selectedAddon ? (
                  <AddonTabView key={selectedAddon.manifestUrl} addon={selectedAddon} />
                ) : loading ? (
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
                    Carregando extensões instaladas…
                  </p>
                ) : selectedManifestUrl ? (
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
                    Esta extensão não está ativa.
                  </p>
                ) : (
                  <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>
                    Selecione uma extensão ativa na barra lateral ou instale uma em Configurações.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export { ADDONS };
export type { AddonKey };
