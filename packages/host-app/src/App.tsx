import { useCallback, useEffect, useState } from 'react';
import { ServiceRegistry, ConsoleLogger, FetchAddonLoader } from '@addons/core';
import type { AddonInstance } from '@addons/core';
import { AddonList } from './components/AddonList';
import { AddonViewer } from './components/AddonViewer';

const ADDONS = [
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

export function App() {
  const [registry] = useState(() => new ServiceRegistry());
  const [logger] = useState(() => new ConsoleLogger());
  const [addons, setAddons] = useState<AddonInstance[]>([]);
  const [selected, setSelected] = useState<AddonInstance | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAddons = useCallback(async () => {
    setLoading(true);
    const loader = new FetchAddonLoader(registry, logger);
    const instances: AddonInstance[] = [];

    for (const addon of ADDONS) {
      try {
        // For local development, import directly
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

  useEffect(() => {
    loadAddons();
  }, [loadAddons]);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>🧩 Add-ons POC</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        Prova de conceito do sistema de add-ons
      </p>

      {loading && <p>Carregando add-ons...</p>}

      {!loading && (
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <AddonList
              addons={addons}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
          <div style={{ flex: 2 }}>
            {selected ? (
              <AddonViewer addon={selected} registry={registry} />
            ) : (
              <p style={{ color: '#999' }}>Selecione um add-on para ver detalhes</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}