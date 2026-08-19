import { describe, expect, it } from 'vitest';
import { SearchAggregator, DEFAULT_BASE_URLS } from './index';

/** Cliente falso: simula dois add-ons, um deles com falha (degradação). */
function fakeClient() {
  return {
    async search(baseUrl: string, _type: string, query: string) {
      if (baseUrl.includes('5293')) throw new Error('add-on fora do ar');
      const prefix = baseUrl.includes('5291') ? 'bib' : 'poe';
      return {
        metas: [
          { id: prefix + '-1', type: 'text', name: prefix + ':' + query, description: 'desc' },
          { id: prefix + '-2', type: 'text', name: prefix + ':' + query + ' 2' },
        ],
      };
    },
  };
}

describe('SearchAggregator', () => {
  it('mescla resultados de vários add-ons, sem duplicatas', async () => {
    const agg = new SearchAggregator(fakeClient(), ['http://localhost:5291', 'http://localhost:5292']);
    const results = await agg.search('sol');
    expect(results.length).toBe(4);
    const titles = results.map((r) => r.title);
    expect(titles).toContain('bib:sol');
    expect(titles).toContain('poe:sol');
    expect(new Set(titles).size).toBe(4);
  });

  it('degrada quando um add-on falha (tolerância a falhas)', async () => {
    const agg = new SearchAggregator(fakeClient(), DEFAULT_BASE_URLS); // inclui o 5293 com falha
    const results = await agg.search('sol');
    // 2 add-ons OK x 2 metas = 4 (el 5293 falha e é ignorado)
    expect(results.length).toBe(4);
  });

  it('respeita o limite', async () => {
    const agg = new SearchAggregator(fakeClient(), ['http://localhost:5291', 'http://localhost:5292']);
    const results = await agg.search('sol', 3);
    expect(results.length).toBe(3);
  });
});
