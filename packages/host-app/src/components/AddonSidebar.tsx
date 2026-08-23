import type { AddonInstance } from '@addons/core';

interface AddonSidebarProps {
  addons: AddonInstance[];
  disabledAddonUrls: string[];
  selectedManifestUrl: string | null;
  loading: boolean;
  onSelect: (manifestUrl: string) => void;
  onToggle: (manifestUrl: string) => void;
}

export function AddonSidebar({ addons, disabledAddonUrls, selectedManifestUrl, loading, onSelect, onToggle }: AddonSidebarProps) {
  return (
    <aside aria-label="Extensões instaladas" style={{
      alignSelf: 'start',
      padding: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.025)',
    }}>
      <h3 style={{ margin: '2px 4px 10px', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Extensões instaladas
      </h3>

      <div style={{ display: 'grid', gap: 4 }}>
        {addons.length === 0 && (
          <p style={{ margin: '4px', color: '#64748b', fontSize: 12, lineHeight: 1.45 }}>
            Nenhuma extensão instalada.
          </p>
        )}
        {addons.map((addon) => {
          const enabled = addon.status === 'ready' && !disabledAddonUrls.includes(addon.manifestUrl);
          const selected = enabled && selectedManifestUrl === addon.manifestUrl;

          return (
            <div key={addon.manifestUrl} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: 4, borderRadius: 8,
              background: selected ? 'rgba(99,102,241,0.16)' : 'transparent', opacity: addon.status === 'error' ? 0.55 : 1,
            }}>
              <button
                type="button"
                onClick={() => enabled && onSelect(addon.manifestUrl)}
                disabled={!enabled}
                title={addon.manifest.description}
                style={{
                  flex: 1, minWidth: 0, padding: '6px 4px', border: 'none', background: 'transparent', textAlign: 'left',
                  color: selected ? '#e0e7ff' : '#cbd5e1', cursor: enabled ? 'pointer' : 'default', fontSize: 12,
                }}
              >
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selected ? 650 : 500 }}>
                  {addon.tab?.title ?? addon.manifest.name}
                </span>
                <span style={{ display: 'block', marginTop: 2, color: enabled ? '#64748b' : '#94a3b8', fontSize: 10 }}>
                  {enabled ? 'Ativo' : addon.status === 'error' ? 'Com erro' : 'Desativado'}
                </span>
              </button>

              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${enabled ? 'Desativar' : 'Ativar'} ${addon.manifest.name}`}
                onClick={() => onToggle(addon.manifestUrl)}
                disabled={loading || addon.status === 'error'}
                style={{
                  position: 'relative', flex: '0 0 auto', width: 28, height: 16, padding: 0, border: 'none', borderRadius: 999,
                  background: enabled ? '#4f46e5' : 'rgba(148,163,184,0.35)', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
                }}
              >
                <span aria-hidden="true" style={{
                  position: 'absolute', top: 2, left: enabled ? 14 : 2, width: 12, height: 12, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.15s ease',
                }} />
              </button>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
