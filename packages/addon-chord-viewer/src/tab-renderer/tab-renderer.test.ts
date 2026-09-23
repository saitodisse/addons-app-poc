import { describe, expect, it } from 'vitest';
import { parseTab, prepareSongFromParsedTab, summarizeParsedTab, transposeChordSymbol, transposeParsedTab } from './core';

/**
 * Parity checks of the ported engine.
 *
 * The cases come from the behaviour documented in the source project, so a
 * future re-port can be compared against them.
 */
const CHART = [
  '[Intro]',
  '(G / D/F# / Em / C) - 2x',
  '',
  '[Verse 1]',
  'G                 D/F#',
  'Rows of lanterns on the pier',
  'Em                    C',
  'Salt and diesel in the air',
].join('\n');

describe('transposeChordSymbol', () => {
  it('moves root and bass and keeps the quality untouched', () => {
    expect(transposeChordSymbol('C#m7/G#', 1)).toBe('Dm7/A');
    expect(transposeChordSymbol('Bbmaj7', 2)).toBe('Cmaj7');
    expect(transposeChordSymbol('C7M', 2)).toBe('D7M');
    expect(transposeChordSymbol('F#m7(b5)', 1)).toBe('Gm7(b5)');
  });

  it('keeps repeats and unknown text', () => {
    expect(transposeChordSymbol('/', 5)).toBe('/');
    expect(transposeChordSymbol('not-a-chord', 2)).toBe('not-a-chord');
  });

  it('wraps around the octave in both directions', () => {
    expect(transposeChordSymbol('B', 1)).toBe('C');
    expect(transposeChordSymbol('C', -1)).toBe('B');
  });
});

describe('parseTab', () => {
  it('classifies the lines and collects the chords of the chart', () => {
    const summary = summarizeParsedTab(parseTab(CHART));
    expect(summary.parserVersion).toBe('2.2.2');
    expect(summary.sections).toBe(2);
    expect(summary.sectionTitles).toEqual(['Intro', 'Verse 1']);
    expect(summary.chordsFound).toEqual(['G', 'D/F#', 'Em', 'C']);
    expect(summary.diagnostics).toBe(0);
    expect(summary.linesByKind).toMatchObject({ 'section-header': 2, chords: 3, lyrics: 2 });
  });

  it('keeps lyric words that only start like a chord out of the grammar', () => {
    const summary = summarizeParsedTab(parseTab('Am7 word\nEu quero ver o sol'));
    expect(summary.chordsFound).toEqual(['Am7']);
  });

  it('normalizes windows line endings', () => {
    expect(summarizeParsedTab(parseTab('G   D\r\nHello world\r\n')).lines).toBeGreaterThan(0);
  });

  it('handles an empty text', () => {
    const summary = summarizeParsedTab(parseTab(''));
    expect(summary.sections).toBe(0);
    expect(summary.chordsFound).toEqual([]);
  });
});

describe('transposeParsedTab', () => {
  it('transposes every chord token of the parsed chart', () => {
    const transposed = transposeParsedTab(parseTab(CHART), 2);
    // The ported engine always spells the result with flats, as its source does.
    expect(transposed.chordsFound).toEqual(['A', 'E/Ab', 'Gbm', 'D']);
  });

  it('returns the same chart when nothing is asked', () => {
    const parsed = parseTab(CHART);
    expect(transposeParsedTab(parsed, 0).chordsFound).toEqual(parsed.chordsFound);
  });
});

describe('prepareSongFromParsedTab', () => {
  it('builds the bar list the renderer consumes', () => {
    const prepared = prepareSongFromParsedTab(parseTab(CHART), { viewMode: 'e' });
    expect(prepared.sections).toHaveLength(2);
    const verse = prepared.sections[1];
    expect(verse.title).toBe('Verse 1');
    expect(verse.barList.length).toBeGreaterThan(0);

    const chords = verse.barList
      .filter((entry) => entry.chordItem)
      .map((entry) => entry.chordItem?.simpleChord?.original);
    expect(chords).toEqual(['G', 'D/F#', 'Em', 'C']);
    expect(verse.barList.some((entry) => entry.liricPart?.trim())).toBe(true);
  });
});