import type { AddonInstance } from '@addons-poc/protocol';
import { AddonTabView } from './AddonTabView';
import { AddonContractView } from './AddonContractView';
import { HttpTrafficPanel } from './HttpTrafficPanel';

interface AddonDetailPanelProps {
  addon: AddonInstance | null;
  loading: boolean;
  selectedManifestUrl: string | null;
}

export function AddonDetailPanel({ addon, loading, selectedManifestUrl }: AddonDetailPanelProps) {
  if (addon) {
    return (
      <div style={{ display: 'grid', gap: 24 }}>
        <AddonTabView key={addon.manifestUrl} addon={addon} />
        <AddonContractView manifest={addon.manifest} manifestUrl={addon.manifestUrl} />
        <HttpTrafficPanel addon={addon} />
      </div>
    );
  }
  if (loading) {
    return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Loading installed add-on…</p>;
  }
  if (selectedManifestUrl) {
    return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>This add-on is not active.</p>;
  }
  return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Select an active add-on from the list.</p>;
}
