import { useCallback, useEffect, useState, useRef } from 'react';
import { ServiceRegistry, ConsoleLogger } from '@addons/core';
import type { AddonInstance } from '@addons/core';
import { Header } from './components/Header';
import { AddonCard } from './components/AddonCard';
import { AddonManager } from './components/AddonManager';
import { GreeterDemo } from './components/GreeterDemo';
import { CounterDemo } from './components/CounterDemo';
import { FallbackDemo } from './components/FallbackDemo';
import { RegistryInspector } from './components/RegistryInspector';

const DEFAULT_ADDONS = [
  {
    name: 'Hello',
    url: '/packages/addon-hello/src/index.ts',
    manifestUrl: 'http://localhost:5280/packages/addon-hello/manifest.json',
  },
  {
    name: 'Hello PT',
    url: '/packages/addon-hello-pt/src/index.ts',
    manifestUrl: 'http://localhost:5280/packages/addon-hello-pt/manifest.json',
  },
  {
    name: 'Counter',
    url: '/packages/addon-counter/src/index.ts',
    manifestUrl: 'http://localhost:5280/packages/addon-counter/manifest.json',
  },
];

export type Tab = 'greeter' | 'counter' | 'fallback' | 'inspector';

interface AddonSource {
  name: string;
  url: string;
  manifestUrl: string;
}

export function App() {
  const [registry] = useState(() => new ServiceRegistry());
  const [logger] = useState(() => new ConsoleLogger());
  const [sources, setSources] = useState<AddonSource[]>(DEFAULT_ADDONS);
  const [addons, setAddons] = useState<AddonInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('greeter');
  const loadedRef = useRef(false);

  const loadAddons = useCallback(async (sourceList: AddonSource[]) => {
    setLoading(true);
    const instances: AddonInstance[] = [];

    for (const addon of sourceList) {
      try {
        const mod = await import(addon.url);
        const host = {
          services: registry,
          registerService: <T,>(serviceId: string, instance: T, priority?: number) => {
            registry.register(serviceId, instance, addon.manifestUrl, priority);
          },
          onUnload: (_cb: () => void) => {},
          log: (level: 'info' | 'warn' | 'error', msg: string) => {
            logger.log(level, msg);
          },
        };
        mod.setup(host);
        const serviceIds = mod.manifest.services.map((s: { id: string }) => s.id);
        instances.push({
          manifest: mod.manifest,
          manifestUrl: addon.manifestUrl,
          status: 'ready',
          services: serviceIds,
        });
      } catch (error) {
        logger.log('error', `Erro ao carregar ${addon.name}: ${error}`);
        instances.push({
          manifest: {
            id: addon.name.toLowerCase(),
            version: '0.0.0',
            name: addon.name,
            description: 'Falha ao carregar',
            author: '-',
            license: '-',
            entrypoint: addon.url,
            services: [],
          },
          manifestUrl: addon.manifestUrl,
          status: 'error',
          error: error as Error,
          services: [],
        });
      }
    }

    setAddons(instances);
    setLoading(false);
  }, [registry, logger]);

  // Initial load
  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadAddons(sources);
    }
  }, [loadAddons, sources]);

  const handleAdd = useCallback(async (newSource: AddonSource) => {
    const updated = [...sources, newSource];
    setSources(updated);
    // Limpa o registry e recarrega tudo
    registry.clear();
    await loadAddons(updated);
  }, [sources, registry, loadAddons]);

  const handleRemove = useCallback(async (manifestUrl: string) => {
    const updated = sources.filter(s => s.manifestUrl !== manifestUrl);
    setSources(updated);
    // Limpa o registry e recarrega só os que restaram
    registry.clear();
    await loadAddons(updated);
  }, [sources, registry, loadAddons]);

  const handleReload = useCallback(() => {
    loadedRef.current = false;
    registry.clear();
    setSources(DEFAULT_ADDONS);
    setAddons([]);
    setLoading(true);
    loadedRef.current = true;
    loadAddons(DEFAULT_ADDONS);
  }, [registry, loadAddons]);

  const greeter = registry.get<{ greet: (name: string) => string }>('greeter');
  const counter = registry.get<{
    increment: () => number;
    decrement: () => number;
    getValue: () => number;
    reset: () => number;
  }>('counter');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#e2e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <Header
        addons={addons}
        loading={loading}
        onReload={handleReload}
      />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px' }}>
        {/* Gerenciador de Add-ons */}
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 12 }}>
            Gerenciar Add-ons
          </h2>
          <AddonManager
            addons={addons}
            onAdd={handleAdd}
            onRemove={handleRemove}
            loading={loading}
          />
        </section>

        {/* Demonstração ao Vivo */}
        <section>
          <h2 style={{ fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 12 }}>
            Demonstração ao Vivo
          </h2>

          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            {([
              { id: 'greeter' as Tab, label: '👋 Saudação' },
              { id: 'counter' as Tab, label: '🔢 Contador' },
              { id: 'fallback' as Tab, label: '🔄 Fallback' },
              { id: 'inspector' as Tab, label: '🔍 Inspetor' },
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
            {activeTab === 'inspector' && <RegistryInspector registry={registry} />}
          </div>
        </section>
      </main>
    </div>
  );
}