import type { AddonInstance } from '@addons/core';

interface AddonListProps {
  addons: AddonInstance[];
  selected: AddonInstance | null;
  onSelect: (addon: AddonInstance) => void;
}

const statusColors: Record<string, string> = {
  ready: '#22c55e',
  loading: '#f59e0b',
  error: '#ef4444',
};

export function AddonList({ addons, selected, onSelect }: AddonListProps) {
  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 12 }}>Add-ons Instalados</h2>
      {addons.length === 0 && (
        <p style={{ color: '#999' }}>Nenhum add-on instalado</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {addons.map((addon) => (
          <li
            key={addon.manifestUrl}
            onClick={() => onSelect(addon)}
            style={{
              padding: '12px 16px',
              marginBottom: 8,
              borderRadius: 8,
              border: `2px solid ${selected?.manifestUrl === addon.manifestUrl ? '#3b82f6' : '#e5e7eb'}`,
              cursor: 'pointer',
              background: selected?.manifestUrl === addon.manifestUrl ? '#eff6ff' : '#fff',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: statusColors[addon.status] ?? '#999',
                  display: 'inline-block',
                }}
              />
              <strong>{addon.manifest.name}</strong>
              <span style={{ color: '#999', fontSize: 12 }}>v{addon.manifest.version}</span>
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
              {addon.manifest.description}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}