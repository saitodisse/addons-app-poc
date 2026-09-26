import { describe, expect, it, vi } from 'vitest';
import { editableChartFromPayload, loadEditableChart, structuredChartUrl } from './catalog';

const url = 'http://localhost:5295/text/chart/harbor-light/content.json';
const payload = {
  id: 'harbor-light', title: 'Harbor Light',
  musicalWork: { artistName: 'Mare Alta' }, playableVersion: { key: 'G' },
  notation: { format: 'chord-over-lyrics' },
  content: { text: '[Verse]\nG D\nHello' },
  chordChart: { rawTextChecksum: 'sha256-source' },
};

describe('catalogue content for editing', () => {
  it('normalizes the public text URL to the structured payload', () => {
    expect(structuredChartUrl(url.replace('content.json', 'content.txt'))).toBe(url);
    expect(structuredChartUrl('https://example.com/article')).toBeUndefined();
  });

  it('requires chart notation and a source checksum', () => {
    expect(editableChartFromPayload(payload, url)).toMatchObject({ title: 'Harbor Light', sourceChecksum: 'sha256-source' });
    expect(editableChartFromPayload({ ...payload, chordChart: {} }, url)).toBeUndefined();
    expect(editableChartFromPayload({ ...payload, notation: { format: 'prose' } }, url)).toBeUndefined();
  });

  it('loads the chart from its content URL', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => payload })) as unknown as typeof fetch;
    const chart = await loadEditableChart(url.replace('content.json', 'content.txt'), fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(url);
    expect(chart.originalText).toContain('Hello');
  });
});
