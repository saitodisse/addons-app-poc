import { describe, expect, it, vi } from 'vitest';
import { validateManifest, type HostAPI } from '@addons-poc/protocol';
import { ChartContentEditor, manifest } from './index';
import type { EditableChart } from './catalog';

const chart: EditableChart = {
  id: 'harbor-light', title: 'Harbor Light', artist: 'Mare Alta', key: 'G',
  sourceUrl: 'http://localhost:5295/text/chart/harbor-light/content.json',
  sourceChecksum: 'current', originalText: '[Verse]\nG D\nHello',
};

describe('chord editor add-on', () => {
  it('publishes a valid independent manifest', () => {
    const served = { ...manifest, entrypoint: 'http://localhost:5309/bundle.js' };
    const result = validateManifest(served);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
    expect(manifest.contract.services.filter((service) => service.role === 'consumes').map((service) => service.id)).toEqual(['addons.chords.viewer', 'state-store']);
    expect(manifest.contract.services.find((service) => service.id === 'addons.chords.viewer')).toMatchObject({
      role: 'consumes',
      version: '^1.0.0',
      required: true,
    });
  });

  it('opens only chart URLs and restores a saved local draft', async () => {
    const viewer = { render: vi.fn(() => ({ html: '<div>Preview</div>' })) };
    const host = { services: { use: vi.fn(() => viewer) } } as unknown as HostAPI;
    const drafts = { get: vi.fn(async () => ({ found: true, text: '[Verse]\nA E', baseChecksum: 'current' })), save: vi.fn(), remove: vi.fn() };
    const load = vi.fn(async () => chart) as unknown as typeof import('./catalog').loadEditableChart;
    const editor = new ChartContentEditor(host, drafts, load);
    expect(editor.supports({ url: chart.sourceUrl, type: 'chart' })).toBe(true);
    expect(editor.supports({ url: 'https://en.wikipedia.org/wiki/Harbor', type: 'page' })).toBe(false);
    const result = await editor.render({ url: chart.sourceUrl, type: 'chart' });
    expect(result.title).toContain('Harbor Light');
    expect(result.html).toContain('addons-chord-editor');
    expect(load).toHaveBeenCalledWith(chart.sourceUrl);
    expect(drafts.get).toHaveBeenCalledWith({ sourceUrl: chart.sourceUrl });
  });
});
