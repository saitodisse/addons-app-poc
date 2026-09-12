import { useEffect, useRef } from 'react';
import type { AddonInstance } from '@addons-poc/protocol';
import { AddonSidebar } from './AddonSidebar';
import { AddonDetailPanel } from './AddonDetailPanel';
import type { SearchLimitValue } from '../search';

interface LiveDemoModalProps {
  open: boolean;
  addons: AddonInstance[];
  disabledAddonUrls: string[];
  pendingContractUrls: string[];
  selectedManifestUrl: string | null;
  loading: boolean;
  searchLimits: Record<string, SearchLimitValue>;
  onClose: () => void;
  onSelect: (manifestUrl: string) => void;
  onToggle: (manifestUrl: string) => void;
  onReviewContract: (manifestUrl: string) => void;
  onSearchLimitChange: (manifestUrl: string, value: SearchLimitValue) => void;
}

export function LiveDemoModal({ open, addons, disabledAddonUrls, pendingContractUrls, selectedManifestUrl, loading, searchLimits, onClose, onSelect, onToggle, onReviewContract, onSearchLimitChange }: LiveDemoModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const visibleManifestUrl = selectedManifestUrl ?? addons.find((addon) => addon.status === 'ready' && !disabledAddonUrls.includes(addon.manifestUrl))?.manifestUrl ?? null;
  const visibleAddon = addons.find((addon) => addon.manifestUrl === visibleManifestUrl) ?? null;

  return (
    <div className="host-live-modal-backdrop">
      <div className="host-live-modal" role="dialog" aria-modal="true" aria-labelledby="live-demo-title">
        <header className="host-live-modal-header">
          <div>
            <h2 id="live-demo-title">Demonstração ao vivo</h2>
            <p>Os detalhes completos da extensão ativa aparecem aqui; clique em uma extensão para abrir sua rota dedicada.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar demonstração ao vivo"
            title="Fechar demonstração ao vivo"
            className="host-live-modal-gear"
          >
            ⚙️
          </button>
        </header>

        <div className="host-live-modal-grid">
          <AddonSidebar
            addons={addons}
            disabledAddonUrls={disabledAddonUrls}
            pendingContractUrls={pendingContractUrls}
            selectedManifestUrl={selectedManifestUrl}
            loading={loading}
            onSelect={onSelect}
            onToggle={onToggle}
            onReviewContract={onReviewContract}
            searchLimits={searchLimits}
            onSearchLimitChange={onSearchLimitChange}
          />
          <div className="host-live-modal-detail">
            <AddonDetailPanel addon={visibleAddon} loading={loading} selectedManifestUrl={visibleManifestUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
