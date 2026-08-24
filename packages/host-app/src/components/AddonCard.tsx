import { useState } from 'react';
import type { AddonInstance } from '@addons-poc/protocol';
import { AddonContractView } from './AddonContractView';

interface AddonCardProps {
  addon: AddonInstance;
  enabled: boolean;
  onToggle: (manifestUrl: string) => void;
  onRemove: (manifestUrl: string) => void;
  stateDestination: string;
  reviewRequired?: boolean;
  onAcceptContract?: (manifestUrl: string) => void;
}

export function AddonCard({ addon, enabled, onToggle, onRemove, stateDestination, reviewRequired = false, onAcceptContract }: AddonCardProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      padding: '12px 16px',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 420px', padding: 0, border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{
          width: 8,
          height: 8,
          flex: '0 0 auto',
          borderRadius: '50%',
          background: enabled ? '#22c55e' : '#64748b',
        }} />
        <strong style={{ color: '#f1f5f9', fontSize: 13, whiteSpace: 'nowrap' }}>{addon.manifest.name}</strong>
        <span style={{ color: '#64748b', fontSize: 12, whiteSpace: 'nowrap' }}>v{addon.manifest.version}</span>
        <span style={{ color: '#64748b', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {addon.manifest.description}
        </span>
        <code style={{ color: '#94a3b8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {addon.manifestUrl}
        </code>
        <span style={{ color: '#a5b4fc', fontSize: 12, whiteSpace: 'nowrap' }}>{expanded ? 'Ocultar detalhes' : 'Ver contrato'}</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
        {reviewRequired && onAcceptContract && <button onClick={() => onAcceptContract(addon.manifestUrl)} style={{ padding: '6px 10px', border: '1px solid rgba(251,191,36,0.45)', borderRadius: 6, background: 'rgba(251,191,36,0.12)', color: '#fde68a', cursor: 'pointer', fontSize: 12 }}>Revisar e ativar</button>}
        <button
          disabled
          style={{
            padding: '6px 10px',
            border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 6,
            background: 'rgba(34,197,94,0.1)',
            color: '#86efac',
            fontSize: 12,
          }}
        >
          Instalado
        </button>
        <button
          onClick={() => onToggle(addon.manifestUrl)}
          style={{
            padding: '6px 10px',
            border: '1px solid rgba(129,140,248,0.35)',
            borderRadius: 6,
            background: 'rgba(99,102,241,0.12)',
            color: '#a5b4fc',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          {enabled ? 'Desativar' : 'Ativar'}
        </button>
        <button
          onClick={() => onRemove(addon.manifestUrl)}
          style={{
            padding: '6px 10px',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6,
            background: 'rgba(239,68,68,0.1)',
            color: '#fca5a5',
            cursor: 'pointer',
            fontSize: 12,
          }}
        >
          Remover
        </button>
      </div>
      </div>
      {addon.status === 'blocked' && <p role="status" style={{ margin: '12px 0 0', color: '#fbbf24', fontSize: 12 }}>Bloqueado até uma dependência obrigatória ficar disponível{addon.blockReason ? `: ${addon.blockReason}` : '.'}</p>}
      {reviewRequired && <p role="status" style={{ margin: '12px 0 0', color: '#fde68a', fontSize: 12 }}>O contrato mudou desde a última aceitação. Revise o JSON abaixo antes de ativar.</p>}
      {expanded && <AddonContractView manifest={addon.manifest} manifestUrl={addon.manifestUrl} stateDestination={stateDestination} />}
    </div>
  );
}
