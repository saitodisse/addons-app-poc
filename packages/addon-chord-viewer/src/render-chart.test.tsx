import { describe, expect, it } from 'vitest';
import { renderChart } from './render-chart';

const CHART = [
  '[Verse]',
  'G        D',
  'Hello    world',
].join('\n');

describe('renderChart', () => {
  it.each(['e', 'o'] as const)('renders standalone and consecutive lyrics in layout %s', (viewMode) => {
    const text = 'A7      Dm\nNo babado da saia eu vejo\n\nA morena girando a renda\nOutra linha sem acordes\n                       Bb\nÉ prenda pro seu orixá.\n\n(Volta ao início)';
    const rendered = renderChart({ text, settings: { viewMode } });
    expect(rendered.html).toContain('A morena girando a renda');
    expect(rendered.html).toContain('Outra linha sem acordes');
    expect(rendered.html).toContain('(Volta ao início)');
  });

  it.each(['e', 'o'] as const)('separates untitled blocks in layout %s', (viewMode) => {
    const rendered = renderChart({
      text: '[Intro]\nA9  A7M(9)\n\nA9\nPrimeiro verso\n\nBm7\nSegundo verso',
      settings: { viewMode },
    });
    expect(rendered.sections).toBe(3);
    expect(rendered.html.match(/data-tab-section=/g)).toHaveLength(3);
    expect(rendered.html.match(/<h2/g)).toHaveLength(1);
    expect(rendered.html).toContain('Primeiro');
    expect(rendered.html).toContain('Segundo');
  });

  it('renders the chart with the ported tab component', () => {
    const rendered = renderChart({ text: CHART });
    expect(rendered.html).toContain('data-tab-root');
    expect(rendered.html).toContain('Hello');
    expect(rendered.html).toContain('world');
    expect(rendered.html).toContain('G');
    expect(rendered.html).toContain('D');
    expect(rendered.playedChords).toEqual(['G', 'D']);
    expect(rendered.sections).toBe(1);
    expect(rendered.parserVersion).toBe('2.2.2');
  });

  it('applies the style controls to the rendered markup', () => {
    const rendered = renderChart({
      text: CHART,
      settings: { fontSize: 28, chordColor: '#e67428', backgroundColor: '#ffffff', lyricColor: '#000000' },
    });
    expect(rendered.html).toContain('font-size:28px');
    expect(rendered.html).toContain('#e67428');
    expect(rendered.html).toContain('#ffffff');
  });

  it('transposes the chords that are printed', () => {
    const rendered = renderChart({ text: CHART, settings: { transposeNumber: 2 }, key: 'G' });
    expect(rendered.playedChords).toEqual(['A', 'E']);
    expect(rendered.shapeKey).toBe('A');
    expect(rendered.html).toContain('A');
    expect(rendered.html).not.toContain('>G<');
  });

  it('hides the chords when only the lyrics are requested', () => {
    const withChords = renderChart({ text: CHART, settings: { displayMode: 'both' } });
    const lyricsOnly = renderChart({ text: CHART, settings: { displayMode: 'lyrics' } });
    expect(withChords.html.length).toBeGreaterThan(lyricsOnly.html.length);
    expect(lyricsOnly.html).toContain('Hello');
  });

  it('infers the key from the first chord when the chart has no metadata', () => {
    const rendered = renderChart({ text: CHART });
    expect(rendered.key).toBe('G');
    expect(rendered.keyInferred).toBe(true);
    expect(renderChart({ text: CHART, key: 'C' }).keyInferred).toBe(false);
  });

  it('renders an empty chart without failing', () => {
    const rendered = renderChart({ text: '' });
    expect(rendered.html).toContain('data-tab-root');
    expect(rendered.playedChords).toEqual([]);
  });
});
