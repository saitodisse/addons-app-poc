// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddonManager } from './AddonManager';
import type { AddonInstance } from '@addons-poc/protocol';

vi.mock('./AddonCard', () => ({ AddonCard: () => null }));
vi.mock('../local-manifest-suggestions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../local-manifest-suggestions')>();
  const item = (url: string, id: string, version: string) => ({ manifestUrl: url, id, version, title: id, description: '' });
  const suggestions = [item('https://example.test/old', 'viewer', '1.0.0'), item('https://example.test/new', 'viewer', '2.0.0'), item('https://example.test/catalog', 'catalog', '1.0.0')];
  return { ...actual, LOCAL_MANIFEST_SUGGESTIONS: suggestions, loadLocalManifestSuggestions: async () => suggestions };
});

describe('available manifest versions', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('groups versions, keeps an installed old version visible and expands other old versions independently', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const installed = { manifestUrl: 'https://example.test/installed', status: 'ready', manifest: { id: 'viewer', name: 'viewer', description: '', version: '0.9.0', contract: { services: [], state: [] } } } as unknown as AddonInstance;
    await act(async () => {
      root.render(<AddonManager addons={[installed]} disabledAddonUrls={[]} pendingContractUrls={[]} searchLimits={{}} searchLanguages={{}} onSearchLimitChange={vi.fn()} onSearchLanguageChange={vi.fn()} onInspectManifest={vi.fn()} onInstallFromUrl={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} onAcceptContract={vi.fn()} onFactoryReset={vi.fn()} loading={false} />);
    });
    const available = container.querySelector('section[aria-label="Available manifests"]')!;
    const viewer = available.querySelector('section[aria-label="viewer"]')!;
    expect(viewer.textContent).toContain('v2.0.0');
    expect(viewer.textContent).toContain('Latest available');
    expect(viewer.textContent).toContain('v0.9.0');
    expect(viewer.textContent).toContain('Installed');
    const details = viewer.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.textContent).toContain('v1.0.0');
    expect(available.querySelector('section[aria-label="catalog"] details')).toBeNull();
    await act(async () => { (details.querySelector('summary') as HTMLElement).click(); });
    expect(details.open).toBe(true);
    await act(async () => root.unmount());
  });

  it('shows an installed fixed release with its PeekMosaic alias', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const installed = {
      manifestUrl: 'https://addons-poc-release-1-16-2.vercel.app/chord-viewer/manifest.json',
      status: 'ready',
      manifest: { id: 'chord-viewer', name: 'Chord Chart Viewer', description: '', version: '1.1.5', contract: { services: [], state: [] } },
    } as unknown as AddonInstance;
    await act(async () => {
      root.render(<AddonManager addons={[installed]} disabledAddonUrls={[]} pendingContractUrls={[]} searchLimits={{}} searchLanguages={{}} onSearchLimitChange={vi.fn()} onSearchLanguageChange={vi.fn()} onInspectManifest={vi.fn()} onInstallFromUrl={vi.fn()} onToggle={vi.fn()} onRemove={vi.fn()} onAcceptContract={vi.fn()} onFactoryReset={vi.fn()} loading={false} />);
    });
    const viewer = container.querySelector('section[aria-label="Chord Chart Viewer"]')!;
    const row = [...viewer.querySelectorAll<HTMLElement>('.host-addon-suggestion')]
      .find((element) => element.textContent?.includes('v1.1.5'))!;
    expect(row.querySelector('code')?.textContent).toBe('https://www.peekmosaic.com/addons/1.16.2/chord-viewer/manifest.json');
    expect(row.textContent).toContain('Installed');
    const install = row.querySelector<HTMLButtonElement>('button[aria-label^="Install "]')!;
    expect(install.disabled).toBe(true);
    await act(async () => root.unmount());
  });
});
