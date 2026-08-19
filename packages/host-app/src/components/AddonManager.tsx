import { useState } from 'react';
import type { AddonInstance } from '@addons/core';
import { AddonCard } from './AddonCard';

interface AddonSource {
  name: string;
  url: string;
  manifestUrl: string;
}

interface AddonManagerProps {
  addons: AddonInstance[];
  onAdd: (source: AddonSource) => Promise<void>;
  onRemove: (manifestUrl: string) => Promise<void>;
  loading: boolean;
}

const CATALOG = [
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

export function AddonManager({ addons, onAdd, onRemove, loading }: AddonManagerProps) {
  const [showCatalog, setShowCatalog] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const installedUrls = addons.map(a => a.manifestUrl);
  const availableAddons = CATALOG.filter(a => !installedUrls.includes(a.manifestUrl));

  const handleAddFromCatalog = async (source: AddonSource) => {
    setAdding(true);
    await onAdd(source);
    setAdding(false);
    setShowCatalog(false);
  };

  const handleAddCustom = async () => {
    if (!customUrl.trim()) return;
    setAdding(true);
    await onAdd({
      name: customUrl.split('/').pop()?.split('.').shift() ?? 'custom',
      url: customUrl,
      manifestUrl: customUrl,
    });
    setAdding(false);
    setCustomUrl('');
  };

  return (
    <div>
      {/* Add-ons instalados */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        {addons.map((addon) => (
          <AddonCard
            key={addon.manifestUrl}
            addon={addon}
            onRemove={onRemove}
          />
        ))}
        {addons.length === 0 && !loading && (
          <div style={{
            gridColumn: '1 / -1',
            padding: 32,
            textAlign: 'center',
            color: '#64748b',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 12,
            border: '2px dashed rgba(255,255,255,0.1)',
            fontSize: 14,
          }}>
            Nenhum add-on instalado. Adicione um do catálogo ou por URL.
          </div>
        )}
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {availableAddons.length > 0 && (
          <button
            onClick={() => setShowCatalog(!showCatalog)}
            disabled={loading || adding}
            style={{
              padding: '10px 20px',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: 13,
              transition: 'all 0.2s',
              opacity: loading || adding ? 0.5 : 1,
            }}
          >
            📦 Catálogo ({availableAddons.length} disponíveis)
          </button>
        )}

        <button
          onClick={() => setCustomUrl(!customUrl ? ' ' : '')}
          style={{
            padding: '10px 20px',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          🔗 URL Personalizada
        </button>
      </div>

      {/* Catálogo */}
      {showCatalog && availableAddons.length > 0 && (
        <div style={{
          marginTop: 12,
          padding: 16,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>
            Catálogo de Add-ons
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {availableAddons.map((source) => (
              <button
                key={source.manifestUrl}
                onClick={() => handleAddFromCatalog(source)}
                disabled={adding}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  color: '#e2e8f0',
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  opacity: adding ? 0.5 : 1,
                }}
              >
                <span>
                  <strong>{source.name}</strong>
                  <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{source.url}</span>
                </span>
                <span style={{ color: '#22c55e' }}>+ Instalar</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* URL personalizada */}
      {customUrl !== undefined && (
        <div style={{
          marginTop: 12,
          padding: 16,
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>
            Instalar por URL
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://exemplo.com/meu-addon/manifest.json"
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.3)',
                color: '#e2e8f0',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={handleAddCustom}
              disabled={adding || !customUrl.trim()}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                opacity: adding || !customUrl.trim() ? 0.5 : 1,
              }}
            >
              {adding ? 'Instalando...' : 'Instalar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}