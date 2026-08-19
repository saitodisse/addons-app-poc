import type { AddonInstance } from '@addons/core';

interface AddonCardProps {
  addon: AddonInstance;
  onRemove?: (manifestUrl: string) => Promise<void>;
}

const statusConfig = {
  ready: { color: '#22c55e', label: 'Ativo', bg: 'rgba(34,197,94,0.1)' },
  loading: { color: '#f59e0b', label: 'Carregando...', bg: 'rgba(245,158,11,0.1)' },
  error: { color: '#ef4444', label: 'Erro', bg: 'rgba(239,68,68,0.1)' },
};

export function AddonCard({ addon, onRemove }: AddonCardProps) {
  const status = statusConfig[addon.status];

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 16,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: status.color,
              display: 'inline-block',
            }} />
            <strong style={{ fontSize: 14, color: '#f1f5f9' }}>{addon.manifest.name}</strong>
            <span style={{ fontSize: 11, color: '#64748b' }}>v{addon.manifest.version}</span>
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0', lineHeight: 1.4 }}>
            {addon.manifest.description}
          </p>
        </div>

        {onRemove && addon.status === 'ready' && (
          <button
            onClick={() => onRemove(addon.manifestUrl)}
            style={{
              padding: '4px 10px',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: 12,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            title="Remover add-on"
          >
            ✕ Remover
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#64748b' }}>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: status.bg,
          color: status.color,
          fontSize: 11,
          fontWeight: 600,
        }}>
          {status.label}
        </span>
        <span>{addon.manifest.author}</span>
      </div>

      {addon.services.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {addon.services.map((svc) => (
            <span key={svc} style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(99,102,241,0.15)',
              color: '#818cf8',
              fontSize: 11,
              fontFamily: 'monospace',
            }}>
              {svc}
            </span>
          ))}
        </div>
      )}

      {addon.error && (
        <div style={{
          marginTop: 8,
          padding: '8px 10px',
          borderRadius: 6,
          background: 'rgba(239,68,68,0.1)',
          fontSize: 12,
          color: '#fca5a5',
          lineHeight: 1.4,
        }}>
          {addon.error.message}
        </div>
      )}
    </div>
  );
}