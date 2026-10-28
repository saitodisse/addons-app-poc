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
  it('splits untitled blocks on whitespace-only lines without creating empty sections', () => {
    const parsed = parseTab('\r\nG\r\nFirst verse\r\n  \t\r\n\r\nD\r\nSecond verse\r\n\r\n');
    expect(parsed.sections.map((section) => section.title)).toEqual([null, null]);
    expect(parsed.sections.map((section) => section.lines.map((line) => line.text))).toEqual([
      ['G', 'First verse'], ['D', 'Second verse'],
    ]);
    expect(parsed.sections.map((section) => section.id)).toEqual(['section-1', 'section-2']);
    expect(prepareSongFromParsedTab(parsed).sections).toHaveLength(2);
  });

  it('keeps a title attached to its content across blank lines', () => {
    const parsed = parseTab('[Verse]\n\nG\nFirst verse\n\n[Chorus]\n\nD\nSecond verse');
    expect(parsed.sections.map((section) => section.title)).toEqual(['Verse', 'Chorus']);
    expect(parsed.sections.map((section) => section.lines.at(-1)?.text)).toEqual(['First verse', 'Second verse']);
  });

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
  it('preserves standalone lyrics between chorded blocks', () => {
    const text = 'A7      Dm\nNo babado da saia eu vejo\n\nA morena girando a renda\n                       Bb\nÉ prenda pro seu orixá.';
    const parsed = parseTab(text);
    expect(parsed.sections[1].lines[0].kind).toBe('lyrics');
    const prepared = prepareSongFromParsedTab(parsed);
    const lyrics = prepared.sections.flatMap((section) => section.barList).map((item) => item.liricPart ?? '').join('');
    expect(lyrics).toContain('A morena girando a renda');
    expect(lyrics).toContain('É prenda pro seu orixá.');
  });

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
