import { describe, expect, it, vi } from 'vitest';
import { CatalogClient, chartFromPayload, chartFromText } from './catalog-client';

const BASE = 'http://localhost:5295';

const PAYLOAD = {
  id: 'harbor-light',
  type: 'chart',
  title: 'Harbor Light',
  description: 'Mare Alta · key G',
  musicalWork: { title: 'Harbor Light', artistSlug: 'mare-alta', artistName: 'Mare Alta', composers: ['Ana Reis'] },
  playableVersion: { id: 'harbor-light-original', key: 'G', capo: 2, tempo: 96, time: '4/4', difficulty: 1 },
  content: { text: '[Verse]\nG   D\nHello world', charCount: 24, lineCount: 3, contentType: 'text/plain', encoding: 'utf-8' },
  chords: [
    { symbol: 'G', frets: '320003', fingers: '210003', position: 1 },
    { symbol: 'D' },
  ],
  source: { license: 'MIT', notice: 'Synthetic demo catalogue.', url: `${BASE}/text/chart/harbor-light/content.json` },
};

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function textResponse(body: string) {
  return { ok: true, status: 200, json: async () => ({}), text: async () => body };
}

describe('chartFromPayload', () => {
  it('reads the chart text, metadata, and shapes', () => {
    const chart = chartFromPayload(PAYLOAD);
    expect(chart?.id).toBe('harbor-light');
    expect(chart?.title).toBe('Harbor Light');
    expect(chart?.artist).toBe('Mare Alta');
    expect(chart?.key).toBe('G');
    expect(chart?.capo).toBe(2);
    expect(chart?.chords).toHaveLength(2);
    expect(chart?.contentJsonUrl).toBe(`${BASE}/text/chart/harbor-light/content.json`);
  });

  it('refuses a payload without chart text', () => {
    expect(chartFromPayload({ id: 'x', content: {} })).toBeUndefined();
    expect(chartFromPayload(undefined)).toBeUndefined();
    expect(chartFromPayload('nope')).toBeUndefined();
  });
});

describe('chartFromText', () => {
  it('accepts a structured payload', () => {
    expect(chartFromText(JSON.stringify(PAYLOAD))?.title).toBe('Harbor Light');
  });

  it('accepts a pasted chart', () => {
    const chart = chartFromText('[Verse]\nG   D\nHello world');
    expect(chart?.title).toBe('Pasted chart');
    expect(chart?.text).toContain('Hello world');
    expect(chart?.chords).toEqual([]);
  });

  it('returns nothing for empty or broken content', () => {
    expect(chartFromText('   ')).toBeUndefined();
    expect(chartFromText('{ broken')).toBeUndefined();
  });
});

describe('CatalogClient', () => {
  it('lists a catalogue view with pagination', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({
      metas: [{ id: 'harbor-light', name: 'Harbor Light', description: 'Mare Alta · key G', url: `${BASE}/text/chart/harbor-light/content.txt` }],
      pagination: { limit: 1, total: 8, next: '1' },
    }));
    const page = await new CatalogClient(fetchFn).list(`${BASE}/manifest.json`, 'popular', { limit: 1 });
    expect(fetchFn).toHaveBeenCalledWith(`${BASE}/catalog/chart/popular.json?limit=1`);
    expect(page.rows[0].id).toBe('harbor-light');
    expect(page.pagination?.next).toBe('1');
  });

  it('follows the text route and then the content route', async () => {
    const fetchFn = vi.fn(async (url: string) => (url.endsWith('/content.json')
      ? jsonResponse(PAYLOAD)
      : jsonResponse({ texts: [{ id: 'harbor-light', url: `${BASE}/text/chart/harbor-light/content.txt`, contentJsonUrl: `${BASE}/text/chart/harbor-light/content.json` }] })));

    const chart = await new CatalogClient(fetchFn).chart(`${BASE}/manifest.json`, 'harbor-light');
    expect(fetchFn.mock.calls.map((call) => call[0])).toEqual([
      `${BASE}/text/chart/harbor-light.json`,
      `${BASE}/text/chart/harbor-light/content.json`,
    ]);
    expect(chart.text).toContain('Hello world');
  });

  it('derives the structured URL from a plain content URL', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(PAYLOAD));
    const chart = await new CatalogClient(fetchFn).chartFromUrl(`${BASE}/text/chart/harbor-light/content.txt`);
    expect(fetchFn).toHaveBeenCalledWith(`${BASE}/text/chart/harbor-light/content.json`);
    expect(chart.contentJsonUrl).toBe(`${BASE}/text/chart/harbor-light/content.json`);
  });

  it('reads a plain text content URL', async () => {
    const fetchFn = vi.fn(async () => textResponse('[Verse]\nG   D\nHello world'));
    const chart = await new CatalogClient(fetchFn).chartFromUrl(`${BASE}/notes.txt`);
    expect(chart.text).toContain('Hello world');
  });

  it('reports a failing server', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({}, 503));
    await expect(new CatalogClient(fetchFn).list(BASE)).rejects.toThrow(/HTTP 503/u);
    await expect(new CatalogClient(fetchFn).chart(BASE, 'nope')).rejects.toThrow(/HTTP 503/u);
  });

  it('reports a chart that the catalogue does not publish', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ texts: [] }));
    await expect(new CatalogClient(fetchFn).chart(BASE, 'nope')).rejects.toThrow(/did not publish/u);
  });
});