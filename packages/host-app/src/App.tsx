import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { getInteractionContractFingerprint, validateManifest } from '@addons-poc/protocol';
import type { AddonInstance, AddonManifest, AddonStateStore } from '@addons-poc/protocol';
import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import { ServiceRegistry } from './runtime/registry';
import { ConsoleLogger } from './runtime/logger';
import { FetchAddonLoader } from './runtime/loader';
import { Header } from './components/Header';
import { AddonManager } from './components/AddonManager';
import { AddonDetailPanel } from './components/AddonDetailPanel';
import { SearchResultPage } from './components/SearchResultPage';
import { CONTENT_VIEW_SERVICE, type ContentViewProvider } from './content-view';
import { SearchResultsTable } from './components/SearchResultsTable';
import { browsePage, clampSearchLimit, createFetchSearchClient, hasNextSearchPage, searchPage } from './search';
import type { SearchCollection, SearchLanguages, SearchLimitValue, SearchPageState, SearchPagination, SearchProviderError, SearchResultRow } from './search';
import { isResultRoute, manifestUrlFromRoute, navigate, ROUTES, addonRoute, resultUrlFromRoute, useRoute } from './router';
import { INSTALLATIONS_STORAGE_KEY, resetFactoryStorage } from './factory-reset';
import { headersToObject, logBrowserHttpExchange } from './http-observability';

const SEARCH_STATE_KEY = 'host:search:results:v1';
const SEARCH_URL_PARAMS = {
  q: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
};

interface PersistedInstallations {
  manifestUrls: string[];
  disabledManifestUrls: string[];
  acceptedContractFingerprints: Record<string, string>;
  searchLimits: Record<string, SearchLimitValue>;
  searchLanguages: SearchLanguages;
}

interface PersistedSearchState {
  query: string;
  results: SearchResultRow[];
  pagination?: SearchPagination;
  page?: number;
}

function readPersistedInstallations(): PersistedInstallations {
  if (typeof window === 'undefined') return { manifestUrls: [], disabledManifestUrls: [], acceptedContractFingerprints: {}, searchLimits: {}, searchLanguages: {} };
  try {
    const saved = JSON.parse(window.localStorage.getItem(INSTALLATIONS_STORAGE_KEY) ?? '{}') as Partial<PersistedInstallations>;
    const manifestUrls = Array.isArray(saved.manifestUrls) ? saved.manifestUrls.filter((url): url is string => typeof url === 'string') : [];
    const disabledManifestUrls = Array.isArray(saved.disabledManifestUrls)
      ? saved.disabledManifestUrls.filter((url): url is string => typeof url === 'string' && manifestUrls.includes(url))
      : [];
    const acceptedContractFingerprints = saved.acceptedContractFingerprints && typeof saved.acceptedContractFingerprints === 'object'
      ? Object.fromEntries(Object.entries(saved.acceptedContractFingerprints).filter(([url, fingerprint]) => manifestUrls.includes(url) && typeof fingerprint === 'string'))
      : {};
    const searchLimits: Record<string, SearchLimitValue> = saved.searchLimits && typeof saved.searchLimits === 'object'
      ? Object.fromEntries(Object.entries(saved.searchLimits)
        .filter(([url, value]) => manifestUrls.includes(url) && (value === '' || (typeof value === 'number' && Number.isFinite(value))))
        .map(([url, value]) => [url, value === '' ? '' : clampSearchLimit(value)])) as Record<string, SearchLimitValue>
      : {};
    const searchLanguages: SearchLanguages = saved.searchLanguages && typeof saved.searchLanguages === 'object'
      ? Object.fromEntries(Object.entries(saved.searchLanguages)
        .filter(([url, value]) => manifestUrls.includes(url) && typeof value === 'string' && value.trim()))
      : {};
    return { manifestUrls: [...new Set(manifestUrls)], disabledManifestUrls: [...new Set(disabledManifestUrls)], acceptedContractFingerprints, searchLimits, searchLanguages };
  } catch {
    return { manifestUrls: [], disabledManifestUrls: [], acceptedContractFingerprints: {}, searchLimits: {}, searchLanguages: {} };
  }
}

function normalizeManifestUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('The URL must use http or https');
  return url.href;
}

function persistInstallations(installations: PersistedInstallations): void {
  if (typeof window === 'undefined') return;
  try {
    if (installations.manifestUrls.length === 0) {
      window.localStorage.removeItem(INSTALLATIONS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(INSTALLATIONS_STORAGE_KEY, JSON.stringify(installations));
  } catch {
    // If the browser blocks localStorage, the installation remains valid until this tab reloads.
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
  const pagination = candidate.pagination && typeof candidate.pagination === 'object'
    ? Object.fromEntries(Object.entries(candidate.pagination).flatMap(([key, value]) => {
      if (!value || typeof value !== 'object') return [];
      const page = value as Partial<SearchPageState>;
      if (typeof page.loaded !== 'number' || !Number.isSafeInteger(page.loaded) || page.loaded < 0) return [];
      if (page.total !== undefined && (typeof page.total !== 'number' || !Number.isSafeInteger(page.total) || page.total < 0)) return [];
      if (page.next !== undefined && typeof page.next !== 'string') return [];
      return [[key, {
        loaded: page.loaded,
        ...(page.total === undefined ? {} : { total: page.total }),
        ...(page.next === undefined ? {} : { next: page.next }),
      } satisfies SearchPageState]];
    })) as SearchPagination
    : {};
  const page = typeof candidate.page === 'number' && Number.isSafeInteger(candidate.page) && candidate.page > 0
    ? candidate.page
    : 1;
  return { query: candidate.query, results, pagination, page };
}

export function App() {
  const [registry] = useState(() => new ServiceRegistry());
  const [logger] = useState(() => new ConsoleLogger());
  const [addons, setAddons] = useState<AddonInstance[]>([]);
  const [disabledAddonUrls, setDisabledAddonUrls] = useState<string[]>([]);
  const [acceptedContractFingerprints, setAcceptedContractFingerprints] = useState<Record<string, string>>({});
  const [pendingContractUrls, setPendingContractUrls] = useState<string[]>([]);
  const [searchLimits, setSearchLimits] = useState<Record<string, SearchLimitValue>>({});
  const [searchLanguages, setSearchLanguages] = useState<SearchLanguages>({});
  const [{ q: searchUrlQuery, page: searchUrlPage }, setSearchUrl] = useQueryStates(SEARCH_URL_PARAMS, { history: 'push' });
  const currentSearchPage = Number.isSafeInteger(searchUrlPage) && searchUrlPage > 0 ? searchUrlPage : 1;
  const [searchInput, setSearchInput] = useState(searchUrlQuery);
  /**
   * The query the address bar carried when the page opened.
   *
   * It is read once, when the add-ons and the storage provider are ready: a ref
   * keeps a change of the address bar from running the hydration again, which
   * used to restore the previous term right after the person cleared the field.
   */
  const openingQueryRef = useRef(searchUrlQuery);
  openingQueryRef.current = searchUrlQuery;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultRow[]>([]);
  const [searchErrors, setSearchErrors] = useState<SearchProviderError[]>([]);
  const [searchProviderCount, setSearchProviderCount] = useState(0);
  const [searchPagination, setSearchPagination] = useState<SearchPagination>({});
  const [searching, setSearching] = useState(false);
  const [searchStateReady, setSearchStateReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [installationsReady, setInstallationsReady] = useState(false);
  const loadedRef = useRef(false);
  const searchRequestRef = useRef(0);
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const searchPagesRef = useRef(new Map<string, Map<number, SearchCollection>>());
  /** Pages of the catalogue listing, used while the search field is empty. */
  const browsePagesRef = useRef(new Map<number, SearchCollection>());
  const [browsing, setBrowsing] = useState(false);
  const addonLifecycleRef = useRef(0);
  const httpTextClient = useMemo(() => createFetchSearchClient(), []);
  const route = useRoute();

  const loadRemoteAddon = useCallback(async (manifestUrl: string): Promise<AddonInstance> => {
    return new FetchAddonLoader(registry, logger).load(manifestUrl);
  }, [logger, registry]);

  const recheckDependencies = useCallback(async (manifestUrls: string[]) => {
    const urls = [...new Set(manifestUrls)];
    if (urls.length === 0) return;
    const lifecycle = addonLifecycleRef.current;
    const refreshed = await Promise.all(urls.map(async (manifestUrl) => {
      registry.clearAddon(manifestUrl);
      return new FetchAddonLoader(registry, logger).load(manifestUrl);
    }));
    if (lifecycle !== addonLifecycleRef.current) {
      for (const instance of refreshed) registry.clearAddon(instance.manifestUrl);
      return;
    }
    setAddons((current) => current.map((addon) => refreshed.find((item) => item.manifestUrl === addon.manifestUrl) ?? addon));
  }, [logger, registry]);

  const inspectManifest = useCallback(async (value: string): Promise<AddonManifest> => {
    const manifestUrl = normalizeManifestUrl(value);
    const startedAt = Date.now();
    const request = { method: 'GET', url: manifestUrl, headers: { Accept: 'application/json' }, body: null };
    let response: Response | undefined;
    let logged = false;
    try {
      response = await fetch(manifestUrl, { headers: { Accept: 'application/json' } });
      const body = await response.json();
      logBrowserHttpExchange({
        source: 'host-manifest-inspection',
        method: 'GET',
        url: manifestUrl,
        request,
        response: { status: response.status, ok: response.ok, headers: headersToObject(response.headers), body },
        durationMs: Date.now() - startedAt,
      });
      logged = true;
      if (!response.ok) throw new Error(`HTTP ${response.status} while fetching the manifest`);
      const manifest = body as AddonManifest;
      const validation = validateManifest(manifest);
      if (!validation.valid) throw new Error(`Invalid manifest: ${validation.errors.join(', ')}`);
      return manifest;
    } catch (error) {
      if (!logged) {
        logBrowserHttpExchange({
          source: 'host-manifest-inspection',
          method: 'GET',
          url: manifestUrl,
          request,
          ...(response ? { response: { status: response.status, ok: response.ok, headers: headersToObject(response.headers) } } : {}),
          durationMs: Date.now() - startedAt,
          error: { name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) },
        });
      }
      throw error;
    }
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
          console.error('Could not restore installed add-ons', error);
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
        setSearchLanguages(persisted.searchLanguages);
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
        return limit === undefined
          ? []
          : [[addon.manifestUrl, limit === '' ? '' : clampSearchLimit(limit)]];
      })),
      searchLanguages: Object.fromEntries(addons.flatMap((addon) => {
        const language = searchLanguages[addon.manifestUrl];
        return language?.trim() ? [[addon.manifestUrl, language]] : [];
      })),
    });
  }, [acceptedContractFingerprints, addons, disabledAddonUrls, installationsReady, searchLanguages, searchLimits]);

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
    if (openingQueryRef.current.trim()) {
      hydratedStateStoreRef.current = activeStateStoreKey;
      setSearchInput(openingQueryRef.current);
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
        setSearchPagination(restored.pagination ?? {});
        if (restored.query.trim()) void setSearchUrl({ q: restored.query.trim(), page: restored.page ?? 1 });
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
  }, [activeStateStoreKey, installationsReady, registry, setSearchUrl]);

  useEffect(() => {
    if (!installationsReady || !searchStateReady || !activeStateStoreKey || hydratedStateStoreRef.current !== activeStateStoreKey) return;
    const store = registry.get<AddonStateStore>('state-store');
    void store?.set(SEARCH_STATE_KEY, { query: searchQuery, results: searchResults, pagination: searchPagination, page: currentSearchPage });
  }, [activeStateStoreKey, currentSearchPage, installationsReady, registry, searchPagination, searchQuery, searchResults, searchStateReady]);

  const onSearchLimitChange = useCallback((manifestUrl: string, value: SearchLimitValue) => {
    setSearchLimits((current) => ({ ...current, [manifestUrl]: value === '' ? '' : clampSearchLimit(value) }));
  }, []);

  const onSearchLanguageChange = useCallback((manifestUrl: string, value: string) => {
    if (!value.trim()) return;
    setSearchLanguages((current) => ({ ...current, [manifestUrl]: value }));
  }, []);

  const clearSearchView = useCallback(() => {
    searchRequestRef.current += 1;
    setSearchInput('');
    setSearchQuery('');
    setSearchResults([]);
    setSearchErrors([]);
    setSearchProviderCount(0);
    setSearchPagination({});
    setSearching(false);
  }, []);

  const clearSearch = useCallback(() => {
    clearSearchView();
    void setSearchUrl({ q: null, page: null });
  }, [clearSearchView, setSearchUrl]);

  useEffect(() => {
    searchPagesRef.current.clear();
    browsePagesRef.current.clear();
  }, [addons, disabledAddonUrls, searchLanguages, searchLimits]);

  const loadSearchPage = useCallback((query: string, page: number) => {
    let cachedPages = searchPagesRef.current.get(query);
    if (!cachedPages) {
      cachedPages = new Map<number, SearchCollection>();
      searchPagesRef.current.set(query, cachedPages);
    }
    return searchPage(addons, disabledAddonUrls, query, page, searchLimits, httpTextClient, cachedPages, searchLanguages);
  }, [addons, disabledAddonUrls, httpTextClient, searchLanguages, searchLimits]);

  const loadBrowsePage = useCallback((page: number) => browsePage(
    addons,
    disabledAddonUrls,
    page,
    searchLimits,
    httpTextClient,
    browsePagesRef.current,
    searchLanguages,
  ), [addons, disabledAddonUrls, httpTextClient, searchLanguages, searchLimits]);

  useEffect(() => {
    if (!installationsReady || !searchStateReady) return;
    const query = searchUrlQuery.trim();
    if (!query) {
      // Nothing to search: list what the active add-ons publish.
      setSearchInput('');
      setSearchQuery('');
      setBrowsing(true);
      setSearchResults([]);
      setSearchErrors([]);
      setSearchProviderCount(0);
      setSearchPagination({});
      setSearching(true);
      const requestId = ++searchRequestRef.current;
      void loadBrowsePage(currentSearchPage)
        .then(({ page, collection }) => {
          if (requestId !== searchRequestRef.current) return;
          setSearchResults(collection.results);
          setSearchErrors(collection.errors);
          setSearchProviderCount(collection.providerCount);
          setSearchPagination(collection.pagination);
          if (page !== currentSearchPage) void setSearchUrl({ page });
        })
        .catch((error) => {
          if (requestId !== searchRequestRef.current) return;
          setSearchResults([]);
          setSearchErrors([{ addonName: 'Host', message: (error as Error).message || 'The listing could not be completed.' }]);
          setSearchProviderCount(0);
          setSearchPagination({});
        })
        .finally(() => {
          if (requestId === searchRequestRef.current) setSearching(false);
        });
      return;
    }

    setBrowsing(false);
    setSearchInput(searchUrlQuery);
    setSearchQuery(query);
    setSearchResults([]);
    setSearchErrors([]);
    setSearchProviderCount(0);
    setSearchPagination({});
    setSearching(true);
    const requestId = ++searchRequestRef.current;
    void loadSearchPage(query, currentSearchPage)
      .then(({ page, collection }) => {
        if (requestId !== searchRequestRef.current) return;
        setSearchResults(collection.results);
        setSearchErrors(collection.errors);
        setSearchProviderCount(collection.providerCount);
        setSearchPagination(collection.pagination);
        if (page !== currentSearchPage) void setSearchUrl({ page });
      })
      .catch((error) => {
        if (requestId !== searchRequestRef.current) return;
        setSearchResults([]);
        setSearchErrors([{ addonName: 'Host', message: (error as Error).message || 'The search could not be completed.' }]);
        setSearchProviderCount(0);
        setSearchPagination({});
      })
      .finally(() => {
        if (requestId === searchRequestRef.current) setSearching(false);
      });
  }, [currentSearchPage, installationsReady, loadBrowsePage, loadSearchPage, searchRefreshKey, searchStateReady, searchUrlQuery, setSearchUrl]);

  const hasMoreSearchResults = hasNextSearchPage(searchPagination);

  const changeSearchPage = useCallback((page: number) => {
    if (searching || page < 1) return;
    if (page > currentSearchPage && !hasMoreSearchResults) return;
    setSearchResults([]);
    setSearchErrors([]);
    setSearchPagination({});
    void setSearchUrl({ page });
  }, [currentSearchPage, hasMoreSearchResults, searching, setSearchUrl]);

  const runSearch = useCallback((value: string) => {
    const query = value.trim();
    setSearchInput(value);
    if (!query) {
      clearSearch();
      return;
    }
    searchPagesRef.current.delete(query);
    setSearchRefreshKey((key) => key + 1);
    setSearchResults([]);
    setSearchErrors([]);
    setSearchPagination({});
    void setSearchUrl({ q: query, page: 1 });
  }, [clearSearch, setSearchUrl]);

  const installFromUrl = useCallback(async (value: string, acceptedFingerprint: string): Promise<string | undefined> => {
    let manifestUrl: string;
    try {
      manifestUrl = normalizeManifestUrl(value);
    } catch (error) {
      return (error as Error).message || 'Enter a valid manifest URL';
    }

    if (addons.some((addon) => addon.manifestUrl === manifestUrl)) {
      return 'This add-on is already installed';
    }

    setLoading(true);
    try {
      const installed = await loadRemoteAddon(manifestUrl);

      if (installed.status === 'error') {
        return installed.error?.message ?? 'Could not install the add-on';
      }
      const currentFingerprint = getInteractionContractFingerprint(installed.manifest.contract);
      if (currentFingerprint !== acceptedFingerprint) {
        registry.clearAddon(manifestUrl);
        return 'The contract changed during installation. Review it again before accepting.';
      }

      setAddons((current) => [...current, installed]);
      setAcceptedContractFingerprints((current) => ({ ...current, [manifestUrl]: currentFingerprint }));
      void recheckDependencies(addons.filter((addon) => addon.status === 'blocked').map((addon) => addon.manifestUrl));
      return undefined;
    } catch (error) {
      return (error as Error).message || 'Could not install the add-on';
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
        console.error('Could not enable the add-on', reloaded.error);
      }
    } catch (error) {
      console.error('Could not enable the add-on', error);
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

  const resetFactory = useCallback(async () => {
    addonLifecycleRef.current += 1;
    setLoading(true);
    try {
      const stateStores = registry.getAll<AddonStateStore>('state-store');
      await Promise.allSettled(stateStores.map((store) => store.clear()));
      for (const addon of addons) registry.clearAddon(addon.manifestUrl);
      resetFactoryStorage();
      setAddons([]);
      setDisabledAddonUrls([]);
      setAcceptedContractFingerprints({});
      setPendingContractUrls([]);
      setSearchLimits({});
      setSearchLanguages({});
      clearSearch();
      setSearchStateReady(true);
    } finally {
      setLoading(false);
    }
  }, [addons, clearSearch, registry]);

  const activeAddons = addons.filter((addon) =>
    addon.status === 'ready' &&
    addon.ui &&
    !disabledAddonUrls.includes(addon.manifestUrl),
  );

  const selectedManifestUrl = manifestUrlFromRoute(route);
  const selectedAddon = activeAddons.find((addon) => addon.manifestUrl === selectedManifestUrl) ?? null;
  // Re-read when the active add-ons change, so the result page follows them.
  const contentViewProvider = useMemo(
    () => registry.get<ContentViewProvider>(CONTENT_VIEW_SERVICE),
    [addons, registry],
  );
  // The add-on behind that service: the result page shows its controls too.
  const contentViewAddon = useMemo(() => {
    const manifestUrl = registry.providerOf(CONTENT_VIEW_SERVICE);
    return manifestUrl ? addons.find((addon) => addon.manifestUrl === manifestUrl) ?? null : null;
  }, [addons, registry]);
  const isAddonRoute = route.startsWith('/addons/');
  const isSearchResultRoute = isResultRoute(route);
  const searchResultContentUrl = resultUrlFromRoute(route);
  const selectedSearchResult = searchResultContentUrl
    ? searchResults.find((result) => result.url === searchResultContentUrl) ?? null
    : null;

  useEffect(() => {
    if (!loading && selectedManifestUrl && !selectedAddon) {
      navigate(ROUTES.home);
    }
  }, [loading, selectedAddon, selectedManifestUrl]);

  const reviewAddonContract = useCallback((_manifestUrl: string) => {
    navigate(ROUTES.settings);
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

      <main
        className={route === ROUTES.home ? 'host-home-main' : isSearchResultRoute ? 'host-search-result-page-main' : isAddonRoute ? 'host-addon-route-main' : undefined}
        // A rendered result uses the whole window; prose keeps a readable width.
        style={{ maxWidth: isSearchResultRoute ? '100%' : 1200, margin: '0 auto', padding: '24px 24px 48px' }}
      >
        {!isAddonRoute && !isSearchResultRoute && (
          <SearchResultsTable
            query={searchQuery}
            browsing={browsing}
            results={searchResults}
            errors={searchErrors}
            loading={searching}
            providerCount={searchProviderCount}
            page={currentSearchPage}
            canGoPrevious={currentSearchPage > 1}
            canGoNext={hasMoreSearchResults}
            onPreviousPage={() => changeSearchPage(currentSearchPage - 1)}
            onNextPage={() => changeSearchPage(currentSearchPage + 1)}
          />
        )}
        {route === ROUTES.settings ? (
          <section>
            <AddonManager
              addons={addons}
              disabledAddonUrls={disabledAddonUrls}
              pendingContractUrls={pendingContractUrls}
              searchLimits={searchLimits}
              searchLanguages={searchLanguages}
              onSearchLimitChange={onSearchLimitChange}
              onSearchLanguageChange={onSearchLanguageChange}
              onInspectManifest={inspectManifest}
              onInstallFromUrl={installFromUrl}
              onToggle={toggleAddon}
              onRemove={removeAddon}
              onAcceptContract={acceptContract}
              onFactoryReset={resetFactory}
              loading={loading}
            />
          </section>
        ) : isSearchResultRoute ? (
          <SearchResultPage
            contentUrl={searchResultContentUrl}
            result={selectedSearchResult}
            viewProvider={contentViewProvider}
            viewAddon={contentViewAddon}
          />
        ) : route === ROUTES.home ? null : (
          <section className="addon-route-page" aria-label={selectedAddon ? `Add-on details for ${selectedAddon.manifest.name}` : 'Add-on details'}>
            <a href="#/" className="addon-route-back">← Back to start</a>
            {selectedAddon && (
              <header className="addon-route-header">
                <span className="addon-route-kicker">Installed add-on</span>
                <h2>{selectedAddon.manifest.name}</h2>
                <p>{selectedAddon.manifest.description}</p>
                <code>{selectedAddon.manifestUrl}</code>
              </header>
            )}
            <div className="addon-route-detail">
              <AddonDetailPanel addon={selectedAddon} loading={loading} selectedManifestUrl={selectedManifestUrl} />
            </div>
          </section>
        )}
      </main>

    </div>
  );
}
