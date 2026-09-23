import { describe, expect, it, vi } from 'vitest';
import { CatalogClient, type ChartRecord } from './catalog-client';
import { CONTENT_VIEW_SERVICE, ChartContentViewProvider } from './content-view';
import { DEFAULT_SETTINGS, normalizeSettings, type ViewerSettings } from './settings';

const CHART: ChartRecord = {
  id: 'harbor-light',
  title: 'Harbor Light',
  artist: 'Mare Alta',
  key: 'G',
  text: ['[Verse]', 'G        D', 'Hello    world'].join('\n'),
  chords: [],
  notationFormat: 'chord-over-lyrics',
};

function providerWith(chart: ChartRecord | (() => Promise<ChartRecord>), settings?: Partial<ViewerSettings>) {
  const chartFromUrl = vi.fn(typeof chart === 'function' ? chart : async () => chart);
  const client = { chartFromUrl } as unknown as CatalogClient;
  let current = normalizeSettings({ ...DEFAULT_SETTINGS, ...settings });
  const adopt = vi.fn(async () => undefined);
  const provider = new ChartContentViewProvider({
    client,
    adopt,
    settings: async () => current,
  });
  return {
    provider,
    chartFromUrl,
    adopt,
    /** Moves the controls, as the panel of the result page does. */
    controls: (next: Partial<ViewerSettings>) => { current = normalizeSettings({ ...current, ...next }); },
  };
}

describe('ChartContentViewProvider', () => {
  it('declares the service the host asks for', () => {
    expect(CONTENT_VIEW_SERVICE).toBe('host.content-view');
  });

  it('renders a chord chart result as HTML', async () => {
    const { provider, chartFromUrl } = providerWith(CHART);
    const result = await provider.render({ url: 'http://localhost:5295/text/chart/harbor-light/content.json', type: 'chart' });

    expect(chartFromUrl).toHaveBeenCalledWith('http://localhost:5295/text/chart/harbor-light/content.json');
    expect(result?.title).toBe('Harbor Light — Mare Alta');
    expect(result?.html).toContain('data-tab-root');
    expect(result?.html).toContain('Hello');
  });

  it('declines a result that is not a chord chart', async () => {
    const article = { ...CHART, notationFormat: undefined, title: 'Wikipedia article' };
    expect(await providerWith(article).provider.render({ url: 'http://localhost:5294/text/page/x/content.json' })).toBeUndefined();
    expect(await providerWith(article).provider.render({ url: '' })).toBeUndefined();
  });

  it('renders with the controls in use', async () => {
    const { provider } = providerWith(CHART, { transposeNumber: 2, displayMode: 'lyrics' });
    const result = await provider.render({ url: 'http://localhost:5295/text/chart/harbor-light/content.json' });
    expect(result?.html).toContain('Hello');
    expect(result?.html).not.toContain('font-weight:bold');
  });

  it('reads the content URL once for any number of renders', async () => {
    const { provider, chartFromUrl, controls } = providerWith(CHART);
    const url = 'http://localhost:5295/text/chart/harbor-light/content.json';

    await provider.render({ url });
    controls({ fontSize: 24 });
    await provider.render({ url });
    controls({ fontSize: 28 });
    await provider.render({ url });

    expect(chartFromUrl).toHaveBeenCalledTimes(1);
  });

  it('hands the chart it read to the add-on, so the panel edits it', async () => {
    const { provider, adopt } = providerWith(CHART);
    const url = 'http://localhost:5295/text/chart/harbor-light/content.json';

    await provider.render({ url });
    await provider.render({ url });

    // Every render says which chart the page shows: a return to a chart already
    // read must restore the controls kept for it, and only the add-on knows them.
    expect(adopt).toHaveBeenCalledTimes(2);
    expect(adopt).toHaveBeenCalledWith(CHART);
  });

  it('renders again only when the controls moved', async () => {
    const { provider, controls } = providerWith(CHART);
    const url = 'http://localhost:5295/text/chart/harbor-light/content.json';

    const first = await provider.render({ url });
    const repeated = await provider.render({ url });
    controls({ fontSize: 24 });
    const changed = await provider.render({ url });

    // The same chart with the same controls is the same view, returned as is.
    expect(repeated?.html).toBe(first?.html);
    expect(changed?.html).not.toBe(first?.html);
    expect(changed?.html).toContain('font-size:24px');
  });

  it('declines when the chart cannot be read', async () => {
    const { provider } = providerWith(async () => { throw new Error('HTTP 404'); });
    await expect(provider.render({ url: 'http://localhost:5295/text/chart/missing/content.json' })).rejects.toThrow(/HTTP 404/u);
  });
});