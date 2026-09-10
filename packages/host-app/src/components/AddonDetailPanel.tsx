import type { AddonInstance } from '@addons-poc/protocol';
import { AddonTabView } from './AddonTabView';

interface AddonDetailPanelProps {
  addon: AddonInstance | null;
  loading: boolean;
  selectedManifestUrl: string | null;
}

export function AddonDetailPanel({ addon, loading, selectedManifestUrl }: AddonDetailPanelProps) {
  if (addon) return <AddonTabView key={addon.manifestUrl} addon={addon} />;
  if (loading) {
    return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Carregando extensão instalada…</p>;
  }
  if (selectedManifestUrl) {
    return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Esta extensão não está ativa.</p>;
  }
  return <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Selecione uma extensão ativa na lista.</p>;
}
