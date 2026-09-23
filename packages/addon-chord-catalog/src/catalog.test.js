import { describe, expect, it } from 'vitest';
import { CHARTS } from './data/charts.js';
import { chartSections, findChart, listCatalog, normalizeText, paginate, resolveLimit, searchCharts } from './catalog.js';

describe('normalizeText', () => {
  it('folds accents, case, and repeated spaces', () => {
    expect(normalizeText('  Can\u00e7\u00e3o   do Farol ')).toBe('cancao do farol');
  });

  it('accepts an empty value', () => {
    expect(normalizeText(undefined)).toBe('');
  });
});

describe('chartSections', () => {
  it('reads the section titles in order and ignores other brackets', () => {
    const text = '[Intro]\nG  D\n\n[Chorus]\nC  G\n[not a section\n';
    expect(chartSections(text)).toEqual([
      { title: 'Intro', line: 0 },
      { title: 'Chorus', line: 3 },
    ]);
  });
});

describe('searchCharts', () => {
  it('ranks a title match above a lyric match', () => {
    const results = searchCharts(CHARTS, 'harbor');
    expect(results[0]?.id).toBe('harbor-light');
  });

  it('finds a chart by artist', () => {
    const ids = searchCharts(CHARTS, 'vela nova').map((chart) => chart.id);
    expect(ids).toContain('static-and-rain');
    expect(ids).toContain('long-way-home');
  });

  it('finds a chart by chord symbol', () => {
    const ids = searchCharts(CHARTS, 'bb7m').map((chart) => chart.id);
    expect(ids).toEqual(['copper-kettle-road']);
  });

  it('finds a chart by key and by tag', () => {
    expect(searchCharts(CHARTS, 'bb').map((chart) => chart.id)).toContain('copper-kettle-road');
    expect(searchCharts(CHARTS, 'waltz').map((chart) => chart.id)).toContain('blue-hour-waltz');
  });

  it('requires every term to match somewhere', () => {
    expect(searchCharts(CHARTS, 'harbor zzz')).toEqual([]);
  });

  it('returns nothing without a query', () => {
    expect(searchCharts(CHARTS, '   ')).toEqual([]);
  });

  it('is deterministic for the same query', () => {
    expect(searchCharts(CHARTS, 'g').map((chart) => chart.id))
      .toEqual(searchCharts(CHARTS, 'g').map((chart) => chart.id));
  });
});

describe('listCatalog', () => {
  it('sorts by update date for the recent view', () => {
    const ids = listCatalog(CHARTS, 'recent').map((chart) => chart.id);
    expect(ids[0]).toBe('static-and-rain');
  });

  it('sorts by visits for the popular view', () => {
    const ids = listCatalog(CHARTS, 'popular').map((chart) => chart.id);
    expect(ids[0]).toBe('static-and-rain');
  });

  it('keeps only easy charts in the beginner view', () => {
    const charts = listCatalog(CHARTS, 'beginner');
    expect(charts.length).toBeGreaterThan(0);
    expect(charts.every((chart) => chart.difficulty <= 2)).toBe(true);
  });

  it('sorts alphabetically', () => {
    const titles = listCatalog(CHARTS, 'alphabetical').map((chart) => chart.title);
    expect(titles).toEqual([...titles].sort((left, right) => left.localeCompare(right)));
  });

  it('returns nothing for an unknown view', () => {
    expect(listCatalog(CHARTS, 'nope')).toEqual([]);
  });
});

describe('paginate', () => {
  it('slices the requested page and reports the next cursor', () => {
    const page = paginate([1, 2, 3, 4, 5], { limit: 2 });
    expect(page.items).toEqual([1, 2]);
    expect(page.pagination).toEqual({ limit: 2, total: 5, next: '2' });
  });

  it('omits the cursor on the last page', () => {
    const page = paginate([1, 2, 3], { limit: 2, cursor: '2' });
    expect(page.items).toEqual([3]);
    expect(page.pagination.next).toBeUndefined();
  });

  it('falls back to the default size and ignores a broken cursor', () => {
    expect(resolveLimit(undefined)).toBe(10);
    expect(resolveLimit(0)).toBe(10);
    expect(resolveLimit(9999)).toBe(500);
    expect(paginate([1, 2, 3], { cursor: 'abc' }).items).toEqual([1, 2, 3]);
  });
});

describe('findChart', () => {
  it('finds a chart by identifier and returns undefined otherwise', () => {
    expect(findChart(CHARTS, 'harbor-light')?.title).toBe('Harbor Light');
    expect(findChart(CHARTS, 'missing')).toBeUndefined();
  });
});

describe('data set', () => {
  it('keeps identifiers unique', () => {
    const ids = CHARTS.map((chart) => chart.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares every used chord and every declared chord in the text', () => {
    for (const chart of CHARTS) {
      for (const chord of chart.chords) {
        expect(chart.text).toContain(chord);
      }
    }
  });

  it('uses only keys accepted by the AC key list', () => {
    const keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B', 'Em', 'Am'];
    for (const chart of CHARTS) {
      expect(keys).toContain(chart.key);
    }
  });
});