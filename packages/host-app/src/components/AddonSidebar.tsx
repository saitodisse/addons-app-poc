import type { AddonInstance } from '@addons-poc/protocol';
import { DEFAULT_SEARCH_LIMIT, getSearchResources } from '../search';

interface AddonSidebarProps {
  addons: AddonInstance[];
  disabledAddonUrls: string[];
  pendingContractUrls: string[];
  selectedManifestUrl: string | null;
  loading: boolean;
  onSelect: (manifestUrl: string) => void;
  onToggle: (manifestUrl: string) => void;
  onReviewContract: (manifestUrl: string) => void;
  searchLimits: Record<string, number>;
  onSearchLimitChange: (manifestUrl: string, value: number) => void;
}

export function AddonSidebar({ addons, disabledAddonUrls, pendingContractUrls, selectedManifestUrl, loading, onSelect, onToggle, onReviewContract, searchLimits, onSearchLimitChange }: AddonSidebarProps) {
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
          const requiresContractReview = pendingContractUrls.includes(addon.manifestUrl);
          const selected = enabled && selectedManifestUrl === addon.manifestUrl;
          const actionLabel = requiresContractReview ? 'Revisar e ativar' : enabled ? 'Desativar' : 'Ativar';
          const actionDisabled = loading || addon.status === 'error' || (!requiresContractReview && addon.status !== 'ready');
          const itemDisabled = loading || addon.status !== 'ready';
          const searchTypes = [...new Set(getSearchResources(addon).flatMap((resource) => resource.types))];
          const searchLimitInputId = `sidebar-search-limit-${encodeURIComponent(addon.manifestUrl)}`;

          return (
            <div key={addon.manifestUrl} style={{
              display: 'grid', gap: 4, padding: 4, borderRadius: 8,
              background: selected ? 'rgba(99,102,241,0.16)' : 'transparent', opacity: addon.status === 'error' ? 0.55 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    if (enabled) onSelect(addon.manifestUrl);
                    else if (requiresContractReview) onReviewContract(addon.manifestUrl);
                    else onToggle(addon.manifestUrl);
                  }}
                  disabled={itemDisabled}
                  aria-label={`${enabled ? 'Abrir' : actionLabel} ${addon.manifest.name}`}
                  title={addon.manifest.description}
                  style={{
                    flex: 1, minWidth: 0, padding: '6px 4px', border: 'none', background: 'transparent', textAlign: 'left',
                    color: selected ? '#e0e7ff' : '#cbd5e1', cursor: itemDisabled ? 'default' : 'pointer', fontSize: 12,
                  }}
                >
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: selected ? 650 : 500 }}>
                    {addon.ui?.title ?? addon.manifest.name}
                  </span>
                  <span style={{ display: 'block', marginTop: 2, color: enabled ? '#64748b' : '#94a3b8', fontSize: 10 }}>
                    {enabled ? 'Ativo' : addon.status === 'blocked' ? 'Aguardando dependência' : addon.status === 'error' ? 'Com erro' : 'Desativado'}
                  </span>
                </button>

                <button
                  type="button"
                  role={requiresContractReview ? undefined : 'switch'}
                  aria-checked={requiresContractReview ? undefined : enabled}
                  aria-label={`${actionLabel} ${addon.manifest.name}`}
                  onClick={() => requiresContractReview ? onReviewContract(addon.manifestUrl) : onToggle(addon.manifestUrl)}
                  disabled={actionDisabled}
                  style={{
                    flex: '0 0 auto', minWidth: requiresContractReview ? 112 : 70, height: 28, padding: '0 8px',
                    border: `1px solid ${requiresContractReview ? 'rgba(251,191,36,0.45)' : 'rgba(129,140,248,0.35)'}`,
                    borderRadius: 6,
                    background: requiresContractReview ? 'rgba(251,191,36,0.12)' : enabled ? 'rgba(99,102,241,0.2)' : 'rgba(148,163,184,0.16)',
                    color: requiresContractReview ? '#fde68a' : enabled ? '#c7d2fe' : '#cbd5e1',
                    cursor: actionDisabled ? 'not-allowed' : loading ? 'wait' : 'pointer', opacity: actionDisabled ? 0.55 : 1,
                    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  {actionLabel}
                </button>
              </div>

              {searchTypes.length > 0 && (
                <label htmlFor={searchLimitInputId} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px 3px', color: '#64748b', fontSize: 10 }}>
                  <span style={{ flex: 1 }}>Máx. resultados ({searchTypes.join(', ')})</span>
                  <input
                    id={searchLimitInputId}
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={searchLimits[addon.manifestUrl] ?? DEFAULT_SEARCH_LIMIT}
                    onChange={(event) => onSearchLimitChange(addon.manifestUrl, Number(event.target.value))}
                    disabled={loading || addon.status !== 'ready'}
                    aria-label={`Máximo de resultados de busca para ${addon.manifest.name}`}
                    style={{ width: 54, padding: '4px 5px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, background: 'rgba(0,0,0,0.18)', color: '#cbd5e1', font: 'inherit', fontSize: 11 }}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
