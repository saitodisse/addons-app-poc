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
    return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Carregando extensão instalada…</p>;
  }
  if (selectedManifestUrl) {
    return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Esta extensão não está ativa.</p>;
  }
  return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Selecione uma extensão ativa na lista.</p>;
}
