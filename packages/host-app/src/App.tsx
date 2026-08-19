import { useCallback, useEffect, useState, useRef } from 'react';
import { ServiceRegistry, ConsoleLogger, LocalStorageBookmarkStore } from '@addons/core';
import type { AddonInstance, HostAPI, AddonModule } from '@addons/core';
import { Header } from './components/Header';
import { AddonCard } from './components/AddonCard';
import { AddonManager } from './components/AddonManager';
import { GreeterDemo } from './components/GreeterDemo';
import { CounterDemo } from './components/CounterDemo';
import { FallbackDemo } from './components/FallbackDemo';
import { RegistryInspector } from './components/RegistryInspector';
import { TextosDemo } from './components/TextosDemo';
import { ExtrasDemo } from './components/ExtrasDemo';

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

type AddonKey = 'hello' | 'hello-pt' | 'counter' | 'markdown' | 'aggregator' | 'favorites' | 'health';

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
};

const DEFAULT_KEYS: AddonKey[] = ['hello', 'hello-pt', 'counter', 'markdown', 'aggregator', 'favorites', 'health'];
const ALL_KEYS: AddonKey[] = ['hello', 'hello-pt', 'counter', 'markdown', 'aggregator', 'favorites', 'health'];

export type Tab = 'greeter' | 'counter' | 'fallback' | 'textos' | 'inspector' | 'extras';

export function App() {
  const [registry] = useState(() => new ServiceRegistry());
  const [logger] = useState(() => new ConsoleLogger());
  const [activeKeys, setActiveKeys] = useState<AddonKey[]>(DEFAULT_KEYS);
  const [addons, setAddons] = useState<AddonInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('greeter');
  const loadedRef = useRef(false);

  const loadAddons = useCallback(async (keys: AddonKey[]) => {
    setLoading(true);
    const instances: AddonInstance[] = [];

    // Serviço de infraestrutura fornecido pelo host (não é add-on):
    // o add-on favorites consome 'bookmarkStore' com degradação a memória.
    if (!registry.has('bookmarkStore')) {
      registry.register('bookmarkStore', new LocalStorageBookmarkStore(), 'host');
    }

    for (const key of keys) {
      const info = ADDONS[key];
      try {
        const mod = info.module();
        const host: HostAPI = {
          services: registry,
          registerService: <T,>(serviceId: string, instance: T, priority?: number) => {
            registry.register(serviceId, instance, info.manifestUrl, priority);
          },
          onUnload: () => {},
          log: (level, msg) => logger.log(level, msg),
        };
        mod.setup(host);
        const serviceIds = (mod.manifest.services ?? []).map((s) => s.id);
        instances.push({
          manifest: mod.manifest,
          manifestUrl: info.manifestUrl,
          status: 'ready',
          services: serviceIds,
        });
      } catch (error) {
        logger.log('error', `Erro ao carregar ${info.name}: ${error}`);
        instances.push({
          manifest: {
            id: key,
            version: '0.0.0',
            name: info.name,
            description: 'Falha ao carregar',
            author: '-',
            license: '-',
            entrypoint: info.manifestUrl,
            services: [],
          },
          manifestUrl: info.manifestUrl,
          status: 'error',
          error: error as Error,
          services: [],
        });
      }
    }

    setAddons(instances);
    setLoading(false);
  }, [registry, logger]);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadAddons(activeKeys);
    }
  }, [loadAddons, activeKeys]);

  const handleAdd = useCallback(async (key: AddonKey) => {
    if (activeKeys.includes(key)) return;
    const updated = [...activeKeys, key];
    setActiveKeys(updated);
    registry.clear();
    await loadAddons(updated);
  }, [activeKeys, registry, loadAddons]);

  const handleRemove = useCallback(async (key: AddonKey) => {
    const updated = activeKeys.filter(k => k !== key);
    setActiveKeys(updated);
    registry.clear();
    await loadAddons(updated);
  }, [activeKeys, registry, loadAddons]);

  const handleReload = useCallback(() => {
    loadedRef.current = false;
    registry.clear();
    setActiveKeys(DEFAULT_KEYS);
    setAddons([]);
    setLoading(true);
    loadedRef.current = true;
    loadAddons(DEFAULT_KEYS);
  }, [registry, loadAddons]);

  const greeter = registry.get<{ greet: (name: string) => string }>('greeter');
  const counter = registry.get<{
    increment: () => number;
    decrement: () => number;
    getValue: () => number;
    reset: () => number;
  }>('counter');
  const formatter = registry.get<{ format: (s: { title: string; content: string }) => { title: string; markdown: string; html: string } }>('textFormatter');
  const searchProvider = registry.get<{ search: (q: string, limit?: number) => Promise<{ title: string; snippet?: string }[]> }>('searchProvider');
  const favorites = registry.get<{ list: () => Promise<{ id: string; title: string; url?: string; createdAt: number }[]>; add: (title: string, url?: string) => Promise<{ id: string; title: string; url?: string; createdAt: number }>; remove: (id: string) => Promise<boolean> }>('favorites');
  const healthCheck = registry.get<{ checkAll: () => Promise<{ baseUrl: string; ok: boolean; latencyMs: number | null; error?: string }[]> }>('healthCheck');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <Header addons={addons} loading={loading} onReload={handleReload} />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px' }}>
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 12 }}>
            Gerenciar Add-ons
          </h2>
          <AddonManager
            addons={addons}
            activeKeys={activeKeys}
            allKeys={ALL_KEYS}
            onAdd={handleAdd}
            onRemove={handleRemove}
            loading={loading}
          />
        </section>

        <section>
          <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 12 }}>
            Demonstração ao Vivo
          </h2>

          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {([
              { id: 'greeter' as Tab, label: '👋 Saudação' },
              { id: 'counter' as Tab, label: '🔢 Contador' },
              { id: 'fallback' as Tab, label: '🔄 Fallback' },
              { id: 'textos' as Tab, label: '📄 Textos' },
              { id: 'inspector' as Tab, label: '🔍 Inspetor' },
              { id: 'extras' as Tab, label: '🧪 Extras' },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  background: activeTab === tab.id
                    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                    : 'rgba(255,255,255,0.05)',
                  color: activeTab === tab.id ? '#fff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: 24,
            minHeight: 300,
          }}>
            {activeTab === 'greeter' && <GreeterDemo greeter={greeter} />}
            {activeTab === 'counter' && <CounterDemo counter={counter} />}
            {activeTab === 'fallback' && <FallbackDemo registry={registry} />}
            {activeTab === 'textos' && <TextosDemo />}
            {activeTab === 'inspector' && <RegistryInspector registry={registry} />}
            {activeTab === 'extras' && (
              <ExtrasDemo
                formatter={formatter}
                searchProvider={searchProvider}
                favorites={favorites}
                healthCheck={healthCheck}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export { ADDONS };
export type { AddonKey };