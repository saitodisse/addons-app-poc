import { useCallback, useEffect, useState, useRef } from 'react';
import { getInteractionContractFingerprint, validateManifest } from '@addons-poc/protocol';
import type { AddonInstance, AddonManifest } from '@addons-poc/protocol';
import { ServiceRegistry } from './runtime/registry';
import { ConsoleLogger } from './runtime/logger';
import { FetchAddonLoader } from './runtime/loader';
import { Header } from './components/Header';
import { AddonManager } from './components/AddonManager';
import { AddonSidebar } from './components/AddonSidebar';
import { AddonTabView } from './components/AddonTabView';
import { manifestUrlDaRota, navegar, RUTAS, rotaDoAddon, useRuta } from './router';

const INSTALLATIONS_STORAGE_KEY = 'addons:host-installations:v1';

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

  const loadRemoteAddon = useCallback(async (manifestUrl: string): Promise<AddonInstance> => {
    return new FetchAddonLoader(registry, logger).load(manifestUrl);
  }, [logger, registry]);

  const recheckDependencies = useCallback(async (manifestUrls: string[]) => {
    const urls = [...new Set(manifestUrls)];
    if (urls.length === 0) return;
    const refreshed = await Promise.all(urls.map(async (manifestUrl) => {
      registry.clearAddon(manifestUrl);
      return new FetchAddonLoader(registry, logger).load(manifestUrl);
    }));
    setAddons((current) => current.map((addon) => refreshed.find((item) => item.manifestUrl === addon.manifestUrl) ?? addon));
  }, [logger, registry]);

  const inspectManifest = useCallback(async (value: string): Promise<AddonManifest> => {
    const manifestUrl = normalizeManifestUrl(value);
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
        const instances = new Map<string, AddonInstance>();
        const persisted = readPersistedInstallations();
        const initialUrls = persisted.manifestUrls;
        try {
          for (const instance of await new FetchAddonLoader(registry, logger).loadAll(initialUrls)) {
            if (instance.manifest) instances.set(instance.manifestUrl, instance);
          }
        } catch (error) {
          console.error('Não foi possível restaurar os add-ons instalados', error);
        }
        let restored = [...instances.values()];
        const pending: string[] = [];
        for (const instance of restored) {
          if (instance.status !== 'ready') continue;
          const fingerprint = getInteractionContractFingerprint(instance.manifest.contract);
          if (persisted.acceptedContractFingerprints[instance.manifestUrl] !== fingerprint) {
            pending.push(instance.manifestUrl);
            registry.clearAddon(instance.manifestUrl);
          }
        }
        const disabled = new Set(persisted.disabledManifestUrls);
        for (const instance of restored) {
          if (disabled.has(instance.manifestUrl) || pending.includes(instance.manifestUrl)) {
            registry.clearAddon(instance.manifestUrl);
          }
        }
        const dependents = restored
          .filter((instance) => instance.status !== 'error' && !disabled.has(instance.manifestUrl) && !pending.includes(instance.manifestUrl))
          .filter((instance) => instance.manifest.contract.services.some((service) => service.role === 'consumes'))
          .map((instance) => instance.manifestUrl);
        if (dependents.length > 0) {
          const refreshed = await Promise.all(dependents.map(async (manifestUrl) => {
            registry.clearAddon(manifestUrl);
            return new FetchAddonLoader(registry, logger).load(manifestUrl);
          }));
          restored = restored.map((instance) => refreshed.find((item) => item.manifestUrl === instance.manifestUrl) ?? instance);
        }
        setAddons(restored);
        setAcceptedContractFingerprints(persisted.acceptedContractFingerprints);
        setPendingContractUrls(pending);
        setDisabledAddonUrls([...new Set([
          ...persisted.disabledManifestUrls.filter((url) => restored.some((addon) => addon.manifestUrl === url)),
          ...pending,
        ])]);
        setInstallationsReady(true);
        setLoading(false);
      };
      void loadInitialAddons();
    }
  }, [loadRemoteAddon]);

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

    setLoading(true);
    try {
      const installed = await loadRemoteAddon(manifestUrl);

      if (installed.status === 'error') {
        return installed.error?.message ?? 'Não foi possível instalar o add-on';
      }
      const currentFingerprint = getInteractionContractFingerprint(installed.manifest.contract);
      if (currentFingerprint !== acceptedFingerprint) {
        registry.clearAddon(manifestUrl);
        return 'O contrato mudou durante a instalação. Revise-o novamente antes de aceitar.';
      }

      setAddons((current) => [...current, installed]);
      setAcceptedContractFingerprints((current) => ({ ...current, [manifestUrl]: currentFingerprint }));
      logInstalledContract(installed);
      void recheckDependencies(addons.filter((addon) => addon.status === 'blocked').map((addon) => addon.manifestUrl));
      return undefined;
    } catch (error) {
      return (error as Error).message || 'Não foi possível instalar o add-on';
    } finally {
      setLoading(false);
    }
  }, [addons, loadRemoteAddon, recheckDependencies, registry]);

  const toggleAddon = useCallback(async (manifestUrl: string) => {
    const addon = addons.find((current) => current.manifestUrl === manifestUrl);
    if (!addon) return;

    if (pendingContractUrls.includes(manifestUrl)) return;

    if (!disabledAddonUrls.includes(manifestUrl)) {
      const dependents = addons
        .filter((item) => item.manifestUrl !== manifestUrl && item.manifest.contract.services.some((service) => service.role === 'consumes'))
        .map((item) => item.manifestUrl);
      registry.clearAddon(manifestUrl);
      setDisabledAddonUrls((urls) => [...urls, manifestUrl]);
      void recheckDependencies(dependents);
      return;
    }

    setLoading(true);
    try {
      const reloaded = await loadRemoteAddon(manifestUrl);

      if (reloaded.status === 'ready') {
        setAddons((current) => current.map((item) => item.manifestUrl === manifestUrl ? reloaded : item));
        setDisabledAddonUrls((urls) => urls.filter((url) => url !== manifestUrl));
        void recheckDependencies(addons.filter((addon) => addon.status === 'blocked' && addon.manifestUrl !== manifestUrl).map((addon) => addon.manifestUrl));
      } else {
        console.error('Não foi possível ativar o add-on', reloaded.error);
      }
    } catch (error) {
      console.error('Não foi possível ativar o add-on', error);
    } finally {
      setLoading(false);
    }
  }, [addons, disabledAddonUrls, loadRemoteAddon, pendingContractUrls, recheckDependencies, registry]);

  const acceptContract = useCallback(async (manifestUrl: string) => {
    const addon = addons.find((current) => current.manifestUrl === manifestUrl);
    if (!addon) return;
    const reviewedFingerprint = getInteractionContractFingerprint(addon.manifest.contract);
    setLoading(true);
    try {
      const reloaded = await loadRemoteAddon(manifestUrl);
      if (reloaded.status !== 'ready') return;
      if (getInteractionContractFingerprint(reloaded.manifest.contract) !== reviewedFingerprint) {
        setAddons((current) => current.map((item) => item.manifestUrl === manifestUrl ? reloaded : item));
        return;
      }
      setAddons((current) => current.map((item) => item.manifestUrl === manifestUrl ? reloaded : item));
      setAcceptedContractFingerprints((current) => ({ ...current, [manifestUrl]: reviewedFingerprint }));
      setPendingContractUrls((urls) => urls.filter((url) => url !== manifestUrl));
      setDisabledAddonUrls((urls) => urls.filter((url) => url !== manifestUrl));
      void recheckDependencies(addons
        .filter((item) => item.manifestUrl !== manifestUrl && item.manifest.contract.services.some((service) => service.role === 'consumes'))
        .map((item) => item.manifestUrl));
    } finally {
      setLoading(false);
    }
  }, [addons, loadRemoteAddon]);

  const removeAddon = useCallback((manifestUrl: string) => {
    registry.clearAddon(manifestUrl);
    const dependents = addons
      .filter((addon) => addon.manifestUrl !== manifestUrl && addon.manifest.contract.services.some((service) => service.role === 'consumes'))
      .map((addon) => addon.manifestUrl);
    setAddons((current) => current.filter((addon) => addon.manifestUrl !== manifestUrl));
    setDisabledAddonUrls((urls) => urls.filter((url) => url !== manifestUrl));
    setPendingContractUrls((urls) => urls.filter((url) => url !== manifestUrl));
    setAcceptedContractFingerprints((current) => {
      const { [manifestUrl]: _removed, ...remaining } = current;
      return remaining;
    });
    void recheckDependencies(dependents);
  }, [addons, recheckDependencies, registry]);
  const activeAddons = addons.filter((addon) =>
    addon.status === 'ready' &&
    addon.ui &&
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
