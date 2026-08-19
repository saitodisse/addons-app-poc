import type { AddonInstance } from '@addons/core';
import type { AddonKey } from '../App';
import { AddonCard } from './AddonCard';

interface AddonManagerProps {
  addons: AddonInstance[];
  activeKeys: AddonKey[];
  allKeys: AddonKey[];
  onAdd: (key: AddonKey) => Promise<void>;
  onRemove: (key: AddonKey) => Promise<void>;
  loading: boolean;
}

const LABELS: Record<AddonKey, { name: string; desc: string }> = {
  hello: { name: 'Hello', desc: 'Add-on de saudação em português' },
  'hello-pt': { name: 'Hello PT', desc: 'Versão prioritária do saudador' },
  counter: { name: 'Counter', desc: 'Add-on de contador' },
  markdown: { name: 'Markdown', desc: 'Formata texto em Markdown/HTML' },
  aggregator: { name: 'Aggregator', desc: 'Meta-search tolerante a falhas' },
  favorites: { name: 'Favorites', desc: 'Favoritos com persistência' },
  health: { name: 'Health', desc: 'Verifica disponibilidade dos add-ons' },
};

export function AddonManager({ addons, activeKeys, allKeys, onAdd, onRemove, loading }: AddonManagerProps) {
  const availableKeys = allKeys.filter(k => !activeKeys.includes(k));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        {addons.map((addon) => {
          const key = addon.manifest.id as AddonKey;
          return (
            <AddonCard
              key={addon.manifestUrl}
              addon={addon}
              onRemove={() => onRemove(key)}
            />
          );
        })}
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
            Nenhum add-on instalado. Adicione um do catálogo abaixo.
          </div>
        )}
      </div>

      {availableKeys.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>
            Catálogo de Add-ons
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {availableKeys.map((key) => (
              <button
                key={key}
                onClick={() => onAdd(key)}
                disabled={loading}
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
                  opacity: loading ? 0.5 : 1,
                }}
              >
                <span>
                  <strong>{LABELS[key].name}</strong>
                  <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>
                    {LABELS[key].desc}
                  </span>
                </span>
                <span style={{ color: '#22c55e' }}>+ Instalar</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}