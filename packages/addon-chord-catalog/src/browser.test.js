import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateTabContract } from '@addons-poc/protocol';
import { createTab, request, setup } from './browser.js';
import { CHARTS } from './data/charts.js';
import { manifest } from './manifest.js';

describe('chord catalogue browser tab', () => {
  it('matches the public runtime field and action contract', () => {
    expect(validateTabContract(manifest, createTab())).toEqual({ valid: true, errors: [] });
  });

  it('shows local archive credentials in the Settings panel', () => {
    const fields = createTab().fields
      .filter(({ id }) => id === 'certificate' || id === 'certificatePassphrase')
      .map(({ id, group }) => ({ id, group }));

    expect(fields).toEqual([
      { id: 'certificate', group: 'Settings' },
      { id: 'certificatePassphrase', group: 'Settings' },
    ]);
  });
});

const stored = vi.hoisted(() => ({ sources: [], list: vi.fn(), summaries: vi.fn(), searchEntries: vi.fn(), getChartsByIds: vi.fn(), remove: vi.fn() }));
vi.mock('./library-store.js', () => ({
  createLibraryStore: () => ({ list: stored.list, summaries: stored.summaries, searchEntries: stored.searchEntries, getChartsByIds: stored.getChartsByIds, remove: stored.remove }),
}));

afterEach(() => vi.unstubAllGlobals());

describe('browser catalogue navigation cache', () => {
  it('loads the library once for multiple pages and invalidates results after deleting a source', async () => {
    stored.sources = [{ root: 'https://example.test/charts/', charts: [
      { ...CHARTS[0], id: 'imported-cache-test', title: 'Unique cached chart', checksum: 'test' },
    ] }];
    stored.list.mockReset().mockImplementation(async () => stored.sources);
    stored.searchEntries.mockReset().mockImplementation(async () => stored.sources.flatMap((source) => source.charts.map((chart) => ({
      id: chart.id, title: chart.title, artist: chart.artist.name, genre: chart.genre?.name ?? chart.tags?.join(' ') ?? '',
    }))));
    stored.getChartsByIds.mockReset().mockImplementation(async (ids) => stored.sources.flatMap((source) => source.charts.filter((chart) => ids.includes(chart.id))));
    stored.remove.mockReset().mockImplementation(async () => { stored.sources = []; });
    vi.stubGlobal('location', { origin: 'http://localhost:5280' });
    await setup({ registerService: vi.fn() });
    const search = (cursor) => request({ url: new URL(
      `./search/chart/unique%20cached%20chart.json?limit=1&cursor=${cursor}`, import.meta.url,
    ).href });
    const first = JSON.parse((await search(0)).body);
    expect(first.metas.map((chart) => chart.id)).toEqual(['imported-cache-test']);
    expect(JSON.parse((await search(1)).body).metas).toEqual([]);
    expect(stored.searchEntries).toHaveBeenCalledTimes(1);
    await createTab().run('delete', { deleteSource: 'https://example.test/charts/' });
    expect(JSON.parse((await search(0)).body).metas).toEqual([]);
    expect(stored.searchEntries).toHaveBeenCalledTimes(2);
  });
});
