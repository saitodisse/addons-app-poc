import { useState } from 'react';
import { getInteractionContractFingerprint, getStateDestination } from '@addons/core';
import type { AddonInstance, AddonManifest } from '@addons/core';
import type { AddonSuggestion } from '../App';
import { AddonCard } from './AddonCard';
import { AddonContractView } from './AddonContractView';

interface AddonManagerProps {
  addons: AddonInstance[];
  disabledAddonUrls: string[];
  pendingContractUrls: string[];
  onInspectManifest: (url: string) => Promise<AddonManifest>;
  onInstallFromUrl: (url: string, acceptedFingerprint: string) => Promise<string | undefined>;
  onToggle: (manifestUrl: string) => Promise<void>;
  onRemove: (manifestUrl: string) => void;
  onAcceptContract: (manifestUrl: string) => Promise<void>;
  suggestions: AddonSuggestion[];
  loading: boolean;
}

interface PendingInstallation {
  manifestUrl: string;
  manifest: AddonManifest;
}

export function AddonManager({ addons, disabledAddonUrls, pendingContractUrls, onInspectManifest, onInstallFromUrl, onToggle, onRemove, onAcceptContract, suggestions, loading }: AddonManagerProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingInstallation, setPendingInstallation] = useState<PendingInstallation | null>(null);
  const activeProviderIds = new Set(addons.filter((addon) => !disabledAddonUrls.includes(addon.manifestUrl)).map((addon) => addon.manifest.id));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const manifest = await onInspectManifest(url);
      setPendingInstallation({ manifestUrl: url, manifest });
      setError(null);
    } catch (inspectionError) {
      setError((inspectionError as Error).message || 'Não foi possível ler o manifesto');
    }
  };

  const acceptPendingInstallation = async () => {
    if (!pendingInstallation) return;
    const installError = await onInstallFromUrl(
      pendingInstallation.manifestUrl,
      getInteractionContractFingerprint(pendingInstallation.manifest.interactions),
    );
    setError(installError ?? null);
    if (!installError) {
      setUrl('');
      setPendingInstallation(null);
    }
  };

  const useSuggestion = (manifestUrl: string) => {
    setUrl(manifestUrl);
    setError(null);
  };

  return (
    <div>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>
          Adicionar add-on pela URL
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="addon-manifest-url" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            URL do manifesto do add-on
          </label>
          <input
            id="addon-manifest-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://exemplo.com/manifest.json"
            required
            disabled={loading}
            style={{
              flex: '1 1 360px',
              minWidth: 0,
              padding: '10px 12px',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              color: '#f1f5f9',
              fontSize: 13,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              cursor: loading ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Lendo...' : 'Ver contrato'}
          </button>
        </form>
        {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
      </section>

      {pendingInstallation && (
        <section aria-label="Revisão antes da instalação" style={{ margin: '0 0 32px', padding: 18, border: '1px solid rgba(129,140,248,0.35)', borderRadius: 10, background: 'rgba(30,41,59,0.52)' }}>
          <h2 style={{ margin: '0 0 6px', color: '#e2e8f0', fontSize: 15 }}>Revise o contrato antes de instalar</h2>
          <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>A instalação só será ativada depois desta aceitação. Se o manifesto mudar antes da confirmação, o host pedirá nova revisão.</p>
          <AddonContractView
            manifest={pendingInstallation.manifest}
            manifestUrl={pendingInstallation.manifestUrl}
            stateDestination={getStateDestination(pendingInstallation.manifest.interactions, activeProviderIds)}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            <button type="button" onClick={() => void acceptPendingInstallation()} disabled={loading} style={{ padding: '10px 14px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700 }}>Instalar e aceitar contrato</button>
            <button type="button" onClick={() => setPendingInstallation(null)} disabled={loading} style={{ padding: '10px 14px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', cursor: loading ? 'wait' : 'pointer', fontSize: 13 }}>Cancelar</button>
          </div>
        </section>
      )}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>
          Add-ons instalados
        </h2>
        {addons.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Nenhum add-on instalado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {addons.map((addon) => (
              <AddonCard
                key={addon.manifestUrl}
                addon={addon}
                enabled={!disabledAddonUrls.includes(addon.manifestUrl)}
                onToggle={onToggle}
                onRemove={onRemove}
                stateDestination={getStateDestination(addon.manifest.interactions, activeProviderIds)}
                reviewRequired={pendingContractUrls.includes(addon.manifestUrl)}
                onAcceptContract={(manifestUrl) => void onAcceptContract(manifestUrl)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>
          Sugestões de add-ons
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 12px' }}>
          Escolha uma sugestão para preencher a URL acima. A instalação só acontece ao confirmar o formulário.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.manifestUrl}
              type="button"
              onClick={() => useSuggestion(suggestion.manifestUrl)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 16px',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                color: '#e2e8f0',
                cursor: 'pointer',
                fontSize: 13,
                textAlign: 'left',
              }}
            >
              <span>
                <strong>{suggestion.name}</strong>
                <span style={{ color: '#64748b', marginLeft: 8, fontSize: 12 }}>{suggestion.description}</span>
              </span>
              <code style={{ color: '#94a3b8', fontSize: 11, overflowWrap: 'anywhere' }}>{suggestion.manifestUrl}</code>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
