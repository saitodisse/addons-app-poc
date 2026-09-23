import { describe, expect, it } from 'vitest';
import { validateManifest } from '@addons-poc/protocol';
import { manifest } from './manifest.js';
import { catalog, chartContentUrl, content, contentJson, search, text } from './handlers.js';

const BASE = 'http://localhost:5295';
const dependencies = { baseUrl: BASE, now: () => new Date('2026-01-01T00:00:00.000Z'), requestId: () => 'req-1' };

describe('manifest', () => {
  it('passes the canonical validation', () => {
    const result = validateManifest(manifest);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('declares one route per resource', () => {
    const resources = (manifest.contract.resources ?? []).map((resource) => resource.name);
    const incoming = manifest.contract.http
      .filter((entry) => entry.direction === 'incoming' && entry.resource)
      .map((entry) => entry.resource);
    expect(resources).toEqual(['catalog', 'search', 'text']);
    expect(incoming).toEqual(['catalog', 'search', 'text']);
  });

  it('announces the chart type and the catalogue views', () => {
    expect(manifest.contract.types).toEqual(['chart']);
    expect(manifest.contract.catalogs?.map((entry) => entry.id))
      .toEqual(['recent', 'popular', 'beginner', 'alphabetical']);
  });
});

describe('catalog handler', () => {
  it('returns rows with an absolute content URL', async () => {
    const payload = await catalog('chart', 'recent', { limit: 2 }, dependencies);
    expect(payload.metas).toHaveLength(2);
    expect(payload.metas[0].type).toBe('chart');
    expect(payload.metas[0].url.startsWith(`${BASE}/text/chart/`)).toBe(true);
    expect(payload.pagination).toEqual({ limit: 2, total: 8, next: '2' });
  });

  it('returns nothing for an unknown type', async () => {
    expect(await catalog('movie', 'recent', {}, dependencies)).toEqual({ metas: [] });
  });
});

describe('search handler', () => {
  it('normalizes the query and paginates the rows', async () => {
    const payload = await search('chart', 'vela nova', { limit: 1 }, dependencies);
    expect(payload.metas).toHaveLength(1);
    expect(payload.pagination.limit).toBe(1);
    expect(payload.metas[0].description).toContain('key');
  });

  it('returns an empty list when nothing matches', async () => {
    const payload = await search('chart', 'nothing-matches-here', {}, dependencies);
    expect(payload.metas).toEqual([]);
  });
});

describe('text handler', () => {
  it('publishes the content links of one chart', async () => {
    const payload = await text('chart', 'harbor-light', {}, dependencies);
    expect(payload.texts).toHaveLength(1);
    expect(payload.texts[0].url).toBe(`${BASE}/text/chart/harbor-light/content.txt`);
    expect(payload.texts[0].contentJsonUrl).toBe(`${BASE}/text/chart/harbor-light/content.json`);
  });

  it('fails with a 404 for an unknown chart', async () => {
    await expect(text('chart', 'missing', {}, dependencies)).rejects.toMatchObject({ status: 404, code: 'CHART_NOT_FOUND' });
  });
});

describe('content handler', () => {
  it('returns the chart text with its section markers', async () => {
    const body = await content('chart', 'harbor-light', {}, dependencies);
    expect(body.startsWith('[Intro]')).toBe(true);
    expect(body).toContain('Harbor light is everywhere');
  });
});

describe('contentJson handler', () => {
  it('returns the structured payload with the chart record', async () => {
    const payload = await contentJson('chart', 'harbor-light', {}, dependencies);
    const body = payload.body;
    expect(body.id).toBe('harbor-light');
    expect(body.musicalWork.artistName).toBe('Mare Alta');
    expect(body.playableVersion.key).toBe('G');
    expect(body.sections[0]).toEqual({ title: 'Intro', line: 0 });
    expect(body.chords.some((chord) => chord.symbol === 'D/F#')).toBe(true);
    expect(body.chordChart.rawTextChecksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(body.chordChart.playableVersionId).toBe('harbor-light-original');
    expect(body.content.charCount).toBeGreaterThan(0);
    expect(body.source.license).toBe('MIT');
    expect(body.observability.requestId).toBe('req-1');
  });

  it('publishes shapes only for the chords of the chart', async () => {
    const payload = await contentJson('chart', 'copper-kettle-road', {}, dependencies);
    const symbols = payload.body.chords.map((chord) => chord.symbol);
    expect(symbols).toContain('Bb7M');
    expect(symbols.every((symbol) => payload.body.content.text.includes(symbol))).toBe(true);
  });
});

describe('chartContentUrl', () => {
  it('builds an absolute URL for one chart', () => {
    expect(chartContentUrl(BASE, 'harbor-light')).toBe(`${BASE}/text/chart/harbor-light/content.txt`);
    expect(chartContentUrl(`${BASE}/`, 'harbor-light', 'json')).toBe(`${BASE}/text/chart/harbor-light/content.json`);
  });
});