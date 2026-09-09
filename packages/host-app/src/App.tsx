import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { getInteractionContractFingerprint, validateManifest } from '@addons-poc/protocol';
import type { AddonInstance, AddonManifest, AddonStateStore } from '@addons-poc/protocol';
import { ServiceRegistry } from './runtime/registry';
import { ConsoleLogger } from './runtime/logger';
import { FetchAddonLoader } from './runtime/loader';
import { Header } from './components/Header';
import { AddonManager } from './components/AddonManager';
import { AddonSidebar } from './components/AddonSidebar';
import { AddonTabView } from './components/AddonTabView';
import { SearchResultsTable } from './components/SearchResultsTable';
import { clampSearchLimit, createFetchSearchClient, searchActiveAddons } from './search';
import type { SearchProviderError, SearchResultRow } from './search';
import { manifestUrlDaRota, navegar, RUTAS, rotaDoAddon, useRuta } from './router';

const INSTALLATIONS_STORAGE_KEY = 'addons:host-installations:v1';
const SEARCH_STATE_KEY = 'host:search:results:v1';

interface PersistedInstallations {
  manifestUrls: string[];
  disabledManifestUrls: string[];
  acceptedContractFingerprints: Record<string, string>;
  searchLimits: Record<string, number>;
}

interface PersistedSearchState {
  query: string;
  results: SearchResultRow[];
}

function readPersistedInstallations(): PersistedInstallations {
  if (typeof window === 'undefined') return { manifestUrls: [], disabledManifestUrls: [], acceptedContractFingerprints: {}, searchLimits: {} };
  try {
    const saved = JSON.parse(window.localStorage.getItem(INSTALLATIONS_STORAGE_KEY) ?? '{}') as Partial<PersistedInstallations>;
    const manifestUrls = Array.isArray(saved.manifestUrls) ? saved.manifestUrls.filter((url): url is string => typeof url === 'string') : [];
    const disabledManifestUrls = Array.isArray(saved.disabledManifestUrls)
      ? saved.disabledManifestUrls.filter((url): url is string => typeof url === 'string' && manifestUrls.includes(url))
      : [];
    const acceptedContractFingerprints = saved.acceptedContractFingerprints && typeof saved.acceptedContractFingerprints === 'object'
      ? Object.fromEntries(Object.entries(saved.acceptedContractFingerprints).filter(([url, fingerprint]) => manifestUrls.includes(url) && typeof fingerprint === 'string'))
      : {};
    const searchLimits = saved.searchLimits && typeof saved.searchLimits === 'object'
      ? Object.fromEntries(Object.entries(saved.searchLimits)
        .filter(([url, value]) => manifestUrls.includes(url) && typeof value === 'number' && Number.isFinite(value))
        .map(([url, value]) => [url, clampSearchLimit(value)]))
      : {};
    return { manifestUrls: [...new Set(manifestUrls)], disabledManifestUrls: [...new Set(disabledManifestUrls)], acceptedContractFingerprints, searchLimits };
  } catch {
    return { manifestUrls: [], disabledManifestUrls: [], acceptedContractFingerprints: {}, searchLimits: {} };
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

function parsePersistedSearchState(value: unknown): PersistedSearchState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<PersistedSearchState>;
  if (typeof candidate.query !== 'string' || !Array.isArray(candidate.results)) return undefined;
  const results = candidate.results.filter((result): result is SearchResultRow => {
    if (!result || typeof result !== 'object') return false;
    const row = result as Partial<SearchResultRow>;
    return [row.key, row.sourceAddonId, row.sourceAddonName, row.sourceManifestUrl, row.type, row.id, row.url, row.name, row.description]
      .every((field) => typeof field === 'string');
  });
  return { query: candidate.query, results };
}

export function App() {
  const [registry] = useState(() => new ServiceRegistry());
  const [logger] = useState(() => new ConsoleLogger());
  const [addons, setAddons] = useState<AddonInstance[]>([]);
  const [disabledAddonUrls, setDisabledAddonUrls] = useState<string[]>([]);
  const [acceptedContractFingerprints, setAcceptedContractFingerprints] = useState<Record<string, string>>({});
  const [pendingContractUrls, setPendingContractUrls] = useState<string[]>([]);
  const [searchLimits, setSearchLimits] = useState<Record<string, number>>({});
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultRow[]>([]);
  const [searchErrors, setSearchErrors] = useState<SearchProviderError[]>([]);
  const [searchProviderCount, setSearchProviderCount] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchStateReady, setSearchStateReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [installationsReady, setInstallationsReady] = useState(false);
  const loadedRef = useRef(false);
  const searchRequestRef = useRef(0);
  const httpTextClient = useMemo(() => createFetchSearchClient(), []);
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
        setSearchLimits(persisted.searchLimits);
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
      searchLimits: Object.fromEntries(addons.flatMap((addon) => {
        const limit = searchLimits[addon.manifestUrl];
        return limit ? [[addon.manifestUrl, clampSearchLimit(limit)]] : [];
      })),
    });
  }, [acceptedContractFingerprints, addons, disabledAddonUrls, installationsReady, searchLimits]);

  const activeStateStoreAddon = useMemo(() => addons.find((addon) =>
    addon.status === 'ready'
    && !disabledAddonUrls.includes(addon.manifestUrl)
    && addon.services.includes('state-store'),
  ), [addons, disabledAddonUrls]);
  const activeStateStoreKey = activeStateStoreAddon?.manifestUrl ?? null;
  const hydratedStateStoreRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!installationsReady) return;
    hydratedStateStoreRef.current = undefined;
    const store = activeStateStoreKey ? registry.get<AddonStateStore>('state-store') : undefined;
    if (!store) {
      hydratedStateStoreRef.current = null;
      setSearchStateReady(true);
      return;
    }
    setSearchStateReady(false);
    let active = true;
    void store.get<unknown>(SEARCH_STATE_KEY).then((saved) => {
      if (!active) return;
      const restored = parsePersistedSearchState(saved);
      if (restored) {
        setSearchInput(restored.query);
        setSearchQuery(restored.query);
        setSearchResults(restored.results);
        setSearchErrors([]);
      }
      hydratedStateStoreRef.current = activeStateStoreKey;
      setSearchStateReady(true);
    }).catch(() => {
      if (!active) return;
      hydratedStateStoreRef.current = activeStateStoreKey;
      setSearchStateReady(true);
    });
    return () => {
      active = false;
    };
  }, [activeStateStoreKey, installationsReady, registry]);

  useEffect(() => {
    if (!installationsReady || !searchStateReady || !activeStateStoreKey || hydratedStateStoreRef.current !== activeStateStoreKey) return;
    const store = registry.get<AddonStateStore>('state-store');
    void store?.set(SEARCH_STATE_KEY, { query: searchQuery, results: searchResults });
  }, [activeStateStoreKey, installationsReady, registry, searchQuery, searchResults, searchStateReady]);

  const onSearchLimitChange = useCallback((manifestUrl: string, value: number) => {
    setSearchLimits((current) => ({ ...current, [manifestUrl]: clampSearchLimit(value) }));
  }, []);

  const clearSearch = useCallback(() => {
    searchRequestRef.current += 1;
    setSearchInput('');
    setSearchQuery('');
    setSearchResults([]);
    setSearchErrors([]);
    setSearchProviderCount(0);
    setSearching(false);
  }, []);

  const runSearch = useCallback(async (value: string) => {
    const query = value.trim();
    setSearchInput(value);
    const requestId = ++searchRequestRef.current;
    if (!query) {
      clearSearch();
      return;
    }
    setSearchQuery(query);
    setSearching(true);
    setSearchErrors([]);
    try {
      const collection = await searchActiveAddons(addons, disabledAddonUrls, query, searchLimits, httpTextClient);
      if (requestId !== searchRequestRef.current) return;
      setSearchResults(collection.results);
      setSearchErrors(collection.errors);
      setSearchProviderCount(collection.providerCount);
    } catch (error) {
      if (requestId !== searchRequestRef.current) return;
      setSearchResults([]);
      setSearchErrors([{ addonName: 'Host', message: (error as Error).message || 'A pesquisa não pôde ser concluída.' }]);
      setSearchProviderCount(0);
    } finally {
      if (requestId === searchRequestRef.current) setSearching(false);
    }
  }, [addons, clearSearch, disabledAddonUrls, httpTextClient, searchLimits]);

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

  const reviewAddonContract = useCallback((_manifestUrl: string) => {
    navegar(RUTAS.settings);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <Header
        addons={addons.filter((addon) => !disabledAddonUrls.includes(addon.manifestUrl))}
        searchValue={searchInput}
        searchDisabled={!installationsReady || !searchStateReady}
        searching={searching}
        onSearchValueChange={setSearchInput}
        onSearch={(value) => void runSearch(value)}
        onClearSearch={clearSearch}
      />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px' }}>
        <SearchResultsTable
          query={searchQuery}
          results={searchResults}
          errors={searchErrors}
          loading={searching}
          providerCount={searchProviderCount}
        />
        {rota === RUTAS.settings ? (
          <section>
            <AddonManager
              addons={addons}
              disabledAddonUrls={disabledAddonUrls}
              pendingContractUrls={pendingContractUrls}
              searchLimits={searchLimits}
              onSearchLimitChange={onSearchLimitChange}
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
                pendingContractUrls={pendingContractUrls}
                selectedManifestUrl={selectedManifestUrl}
                loading={loading}
                onSelect={selectAddon}
                onToggle={toggleAddon}
                onReviewContract={reviewAddonContract}
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
