import { Fragment, useEffect, useRef, useState } from 'react';
import { getInteractionContractFingerprint, getStateDestination } from '@addons-poc/protocol';
import type { AddonInstance, AddonManifest } from '@addons-poc/protocol';
import { AddonCard } from './AddonCard';
import { AddonContractView } from './AddonContractView';
import { FactoryResetControl } from './FactoryResetControl';
import { LOCAL_MANIFEST_SUGGESTIONS, loadLocalManifestSuggestions } from '../local-manifest-suggestions';
import { DEFAULT_SEARCH_LIMIT } from '../search';
import type { SearchLanguages, SearchLimitValue } from '../search';

interface AddonManagerProps {
  addons: AddonInstance[];
  disabledAddonUrls: string[];
  pendingContractUrls: string[];
  searchLimits: Record<string, SearchLimitValue>;
  searchLanguages: SearchLanguages;
  onSearchLimitChange: (manifestUrl: string, value: SearchLimitValue) => void;
  onSearchLanguageChange: (manifestUrl: string, value: string) => void;
  onInspectManifest: (url: string) => Promise<AddonManifest>;
  onInstallFromUrl: (url: string, acceptedFingerprint: string) => Promise<string | undefined>;
  onToggle: (manifestUrl: string) => Promise<void>;
  onRemove: (manifestUrl: string) => void;
  onAcceptContract: (manifestUrl: string) => Promise<void>;
  onFactoryReset: () => void | Promise<void>;
  loading: boolean;
}

interface PendingInstallation {
  manifestUrl: string;
  manifest: AddonManifest;
}

export function AddonManager({ addons, disabledAddonUrls, pendingContractUrls, searchLimits, searchLanguages, onSearchLimitChange, onSearchLanguageChange, onInspectManifest, onInstallFromUrl, onToggle, onRemove, onAcceptContract, onFactoryReset, loading }: AddonManagerProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingInstallation, setPendingInstallation] = useState<PendingInstallation | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [suggestions, setSuggestions] = useState(LOCAL_MANIFEST_SUGGESTIONS);
  const pendingReviewRef = useRef<HTMLDivElement>(null);
  const busy = loading || inspecting;
  const installedManifestUrls = new Set(addons.map((addon) => addon.manifestUrl));
  const pendingIsLocalSuggestion = pendingInstallation ? suggestions.some((suggestion) => suggestion.manifestUrl === pendingInstallation.manifestUrl) : false;
  const activeProviderIds = new Set(addons
    .filter((addon) => addon.status === 'ready' && !disabledAddonUrls.includes(addon.manifestUrl))
    .filter((addon) => addon.manifest.contract.services.some((service) => service.role === 'provides' && service.id === 'state-store'))
    .map((addon) => addon.manifest.id));

  useEffect(() => {
    let mounted = true;
    void loadLocalManifestSuggestions().then((loadedSuggestions) => {
      if (mounted) setSuggestions(loadedSuggestions);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (pendingInstallation) pendingReviewRef.current?.focus();
  }, [pendingInstallation]);

  const inspectAndReview = async (manifestUrl: string) => {
    setUrl(manifestUrl);
    setInspecting(true);
    try {
      const manifest = await onInspectManifest(manifestUrl);
      setPendingInstallation({ manifestUrl, manifest });
      setError(null);
    } catch (inspectionError) {
      setError((inspectionError as Error).message || 'Could not read the manifest');
    } finally {
      setInspecting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void inspectAndReview(url);
  };

  const copySuggestion = (manifestUrl: string) => {
    setUrl(manifestUrl);
    setError(null);
    document.getElementById('addon-manifest-url')?.focus();
  };

  const acceptPendingInstallation = async () => {
    if (!pendingInstallation) return;
    const installError = await onInstallFromUrl(
      pendingInstallation.manifestUrl,
      getInteractionContractFingerprint(pendingInstallation.manifest.contract),
    );
    setError(installError ?? null);
    if (!installError) {
      setUrl('');
      setPendingInstallation(null);
    }
  };

  const renderPendingReview = () => {
    if (!pendingInstallation) return null;
    return (
      <section aria-label="Review before installation" style={{ margin: '0 0 12px', padding: 18, border: '1px solid rgba(129,140,248,0.35)', borderRadius: 10, background: 'rgba(30,41,59,0.52)' }}>
        <h2 style={{ margin: '0 0 6px', color: '#f1f5f9', fontSize: 24, lineHeight: 1.15 }}>{pendingInstallation.manifest.name}</h2>
        <p style={{ margin: '0 0 16px', color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{pendingInstallation.manifest.description}</p>
        <div ref={pendingReviewRef} tabIndex={-1} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 18px' }}>
          <button type="button" onClick={() => void acceptPendingInstallation()} disabled={busy} style={{ padding: '10px 14px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700 }}>Install and accept contract</button>
          <button type="button" onClick={() => setPendingInstallation(null)} disabled={busy} style={{ padding: '10px 14px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 8, background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', cursor: busy ? 'wait' : 'pointer', fontSize: 13 }}>Cancel</button>
        </div>
        <h3 style={{ margin: '0 0 6px', color: '#e2e8f0', fontSize: 15 }}>Review the contract before installing</h3>
        <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>Installation is activated only after this acceptance. If the manifest changes before confirmation, the host will request a new review.</p>
        <AddonContractView
          manifest={pendingInstallation.manifest}
          manifestUrl={pendingInstallation.manifestUrl}
          stateDestination={getStateDestination(pendingInstallation.manifest.contract, activeProviderIds)}
        />
      </section>
    );
  };

  return (
    <div>
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>
          Add add-on by URL
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="addon-manifest-url" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Add-on manifest URL
          </label>
          <input
            id="addon-manifest-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/manifest.json"
            required
            disabled={busy}
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
            disabled={busy}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              cursor: busy ? 'wait' : 'pointer',
              fontSize: 13,
              fontWeight: 600,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Reading...' : 'View contract'}
          </button>
        </form>
        {error && <p role="alert" style={{ color: '#fca5a5', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
      </section>

      {pendingInstallation && !pendingIsLocalSuggestion && renderPendingReview()}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>
          Installed add-ons
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, margin: '0 0 12px' }}>
          Add-ons that declare search let you adjust how many results appear on each page of the main list.
        </p>
        {addons.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>No add-ons installed.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {addons.map((addon) => (
              <AddonCard
                key={addon.manifestUrl}
                addon={addon}
                enabled={!disabledAddonUrls.includes(addon.manifestUrl)}
                onToggle={onToggle}
                onRemove={onRemove}
                stateDestination={getStateDestination(addon.manifest.contract, activeProviderIds)}
                searchLimit={searchLimits[addon.manifestUrl] ?? DEFAULT_SEARCH_LIMIT}
                searchLanguage={searchLanguages[addon.manifestUrl]}
                onSearchLimitChange={onSearchLimitChange}
                onSearchLanguageChange={onSearchLanguageChange}
                reviewRequired={pendingContractUrls.includes(addon.manifestUrl)}
                onAcceptContract={(manifestUrl) => void onAcceptContract(manifestUrl)}
              />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Available local manifests" style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>
          Available local manifests
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, margin: '0 0 12px' }}>
          These URLs are known by the local demonstration; the titles and summaries below come from each `manifest.json`, without importing or executing the add-on.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {suggestions.map((suggestion) => {
            const isOpen = pendingInstallation?.manifestUrl === suggestion.manifestUrl;
            const isInstalled = installedManifestUrls.has(suggestion.manifestUrl);
            const actionLabel = isOpen ? 'Close' : isInstalled ? 'Installed' : 'Install';
            return (
              <Fragment key={suggestion.manifestUrl}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                    <strong style={{ display: 'block', color: '#e2e8f0', fontSize: 13, marginBottom: 3 }}>{suggestion.title}</strong>
                    <span style={{ display: 'block', color: '#94a3b8', fontSize: 12, lineHeight: 1.4, marginBottom: 4 }}>{suggestion.description}</span>
                    <code style={{ display: 'block', color: '#cbd5e1', fontSize: 11, overflowWrap: 'anywhere' }}>{suggestion.manifestUrl}</code>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                    <button
                      type="button"
                      onClick={() => copySuggestion(suggestion.manifestUrl)}
                      disabled={busy}
                      aria-label={`Copy ${suggestion.manifestUrl} to the URL field`}
                      style={{ padding: '7px 10px', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: '#cbd5e1', cursor: busy ? 'wait' : 'pointer', fontSize: 12 }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isOpen) {
                          setPendingInstallation(null);
                          return;
                        }
                        void inspectAndReview(suggestion.manifestUrl);
                      }}
                      disabled={busy || isInstalled}
                      aria-label={`${isOpen ? 'Close' : 'Install'} ${suggestion.manifestUrl}`}
                      style={{ padding: '7px 10px', border: 'none', borderRadius: 6, background: isInstalled ? 'rgba(34,197,94,0.1)' : isOpen ? 'rgba(239,68,68,0.12)' : 'linear-gradient(135deg, #3b82f6, #6366f1)', color: isInstalled ? '#86efac' : isOpen ? '#fca5a5' : '#fff', cursor: busy ? 'wait' : isInstalled ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, opacity: busy || isInstalled ? 0.6 : 1 }}
                    >
                      {actionLabel}
                    </button>
                  </div>
                </div>
                {isOpen && renderPendingReview()}
              </Fragment>
            );
          })}
        </div>
      </section>

      <FactoryResetControl disabled={loading} onReset={onFactoryReset} />

    </div>
  );
}
