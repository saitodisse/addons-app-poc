import { useState } from 'react';
import type { AddonInstance } from '@addons-poc/protocol';
import { AddonContractView } from './AddonContractView';
import { getSearchLanguages, parseSearchLimitInput } from '../search';
import type { SearchLimitValue } from '../search';

interface AddonCardProps {
  addon: AddonInstance;
  enabled: boolean;
  onToggle: (manifestUrl: string) => void;
  onRemove: (manifestUrl: string) => void;
  stateDestination: string;
  searchLimit: SearchLimitValue;
  searchLanguage?: string;
  onSearchLimitChange: (manifestUrl: string, value: SearchLimitValue) => void;
  onSearchLanguageChange: (manifestUrl: string, value: string) => void;
  reviewRequired?: boolean;
  onAcceptContract?: (manifestUrl: string) => void;
}

export function AddonCard({ addon, enabled, onToggle, onRemove, stateDestination, searchLimit, searchLanguage, onSearchLimitChange, onSearchLanguageChange, reviewRequired = false, onAcceptContract }: AddonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleAvailable = !reviewRequired && addon.status !== 'error';
  const searchTypes = [...new Set((addon.manifest.contract.resources ?? []).filter((resource) => resource.name === 'search').flatMap((resource) => resource.types))];
  const searchLanguages = getSearchLanguages(addon);
  const selectedSearchLanguage = searchLanguages.includes(searchLanguage ?? '') ? searchLanguage! : searchLanguages[0];
  const searchLimitInputId = `search-limit-${encodeURIComponent(addon.manifestUrl)}`;
  const searchLanguageInputId = `search-language-${encodeURIComponent(addon.manifestUrl)}`;
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
        <span style={{ color: '#a5b4fc', fontSize: 12, whiteSpace: 'nowrap' }}>{expanded ? 'Hide details' : 'View contract'}</span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
        {reviewRequired && onAcceptContract && <button onClick={() => onAcceptContract(addon.manifestUrl)} style={{ padding: '6px 10px', border: '1px solid rgba(251,191,36,0.45)', borderRadius: 6, background: 'rgba(251,191,36,0.12)', color: '#fde68a', cursor: 'pointer', fontSize: 12 }}>Review and enable</button>}
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
          Installed
        </button>
        <button
          type="button"
          onClick={() => onToggle(addon.manifestUrl)}
          disabled={!toggleAvailable}
          style={{
            padding: '6px 10px',
            border: '1px solid rgba(129,140,248,0.35)',
            borderRadius: 6,
            background: 'rgba(99,102,241,0.12)',
            color: '#a5b4fc',
            cursor: toggleAvailable ? 'pointer' : 'not-allowed',
            fontSize: 12,
            opacity: toggleAvailable ? 1 : 0.55,
          }}
        >
          {reviewRequired ? 'Awaiting review' : enabled ? 'Disable' : 'Enable'}
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
          Remove
        </button>
      </div>
      </div>
      {searchTypes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <label htmlFor={searchLimitInputId} style={{ color: '#94a3b8', fontSize: 12 }}>
            Search results per page ({searchTypes.join(', ')})
          </label>
          <input
            id={searchLimitInputId}
            type="number"
            min={1}
            max={500}
            step={1}
            value={searchLimit}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
            onChange={(event) => onSearchLimitChange(addon.manifestUrl, parseSearchLimitInput(event.target.value))}
            aria-label={`Maximum search results for ${addon.manifest.name}`}
            style={{ width: 72, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, background: 'rgba(0,0,0,0.22)', color: '#e2e8f0', font: 'inherit', fontSize: 12 }}
          />
          <span style={{ color: '#64748b', fontSize: 11 }}>Empty uses the default of 10.</span>
        </div>
      )}
      {searchLanguages.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <label htmlFor={searchLanguageInputId} style={{ color: '#94a3b8', fontSize: 12 }}>Search language</label>
          <select
            id={searchLanguageInputId}
            value={selectedSearchLanguage}
            onChange={(event) => onSearchLanguageChange(addon.manifestUrl, event.target.value)}
            disabled={addon.status !== 'ready'}
            aria-label={`Search language for ${addon.manifest.name}`}
            style={{ minWidth: 132, padding: '6px 8px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, background: '#172033', color: '#e2e8f0', font: 'inherit', fontSize: 12 }}
          >
            {searchLanguages.map((language) => (
              <option key={language} value={language}>{language === 'pt' ? 'Portuguese (pt)' : language === 'en' ? 'English (en)' : language}</option>
            ))}
          </select>
        </div>
      )}
      {addon.status === 'blocked' && <p role="status" style={{ margin: '12px 0 0', color: '#fbbf24', fontSize: 12 }}>Blocked until a required dependency becomes available{addon.blockReason ? `: ${addon.blockReason}` : '.'}</p>}
      {reviewRequired && <p role="status" style={{ margin: '12px 0 0', color: '#fde68a', fontSize: 12 }}>The contract changed since the last acceptance. Review the JSON below before enabling.</p>}
      {expanded && <AddonContractView manifest={addon.manifest} manifestUrl={addon.manifestUrl} stateDestination={stateDestination} />}
    </div>
  );
}
