import { describe, expect, it } from 'vitest';
import { inferKey, simplifyChartText, simplifyChordSymbol } from './chart-transform';
import {
  DEFAULT_SETTINGS,
  VIEWER_PRESETS,
  applyPreset,
  describeSettings,
  globalPart,
  normalizeSettings,
  normalizeSongSettings,
  songPart,
  stepSetting,
  withSongSettings,
} from './settings';

describe('simplifyChordSymbol', () => {
  it('reduces extended symbols to a playable shape', () => {
    expect(simplifyChordSymbol('G7M')).toBe('G');
    expect(simplifyChordSymbol('Cadd9')).toBe('C');
    expect(simplifyChordSymbol('Dm7(b5)')).toBe('Dm');
    expect(simplifyChordSymbol('Am7')).toBe('Am');
    expect(simplifyChordSymbol('CMaj7')).toBe('C');
    expect(simplifyChordSymbol('Cmmaj7')).toBe('Cm');
  });

  it('keeps the qualities that carry the harmony', () => {
    expect(simplifyChordSymbol('Gsus4')).toBe('Gsus4');
    expect(simplifyChordSymbol('Cdim')).toBe('Cdim');
    expect(simplifyChordSymbol('D/F#')).toBe('D/F#');
    expect(simplifyChordSymbol('not-a-chord')).toBe('not-a-chord');
  });
});

describe('simplifyChartText', () => {
  it('rewrites only the chord lines', () => {
    const text = '[Verse]\nG7M        Cadd9\nHello      world';
    expect(simplifyChartText(text)).toBe('[Verse]\nG        C\nHello      world');
  });

  it('keeps the annotation lines readable', () => {
    expect(simplifyChartText('(G7M / D/F# / Em7 / Cadd9) - 2x')).toBe('(G / D/F# / Em / C) - 2x');
  });

  it('leaves a chart without extended chords untouched', () => {
    const text = '[Verse]\nG   D\nHello world';
    expect(simplifyChartText(text)).toBe(text);
  });
});

describe('inferKey', () => {
  it('reads the tonic from the first chord', () => {
    expect(inferKey(['G', 'D/F#'])).toBe('G');
    expect(inferKey(['Am', 'F', 'C'])).toBe('Am');
    expect(inferKey(['Cm7', 'Fm'])).toBe('Cm');
  });

  it('returns nothing without a chord', () => {
    expect(inferKey([])).toBeUndefined();
    expect(inferKey(['/', 'hello'])).toBeUndefined();
  });
});

describe('settings', () => {
  it('fills and clamps every control', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ fontSize: 99 }).fontSize).toBe(40);
    expect(normalizeSettings({ displayMode: 'nonsense' as never }).displayMode).toBe('both');
    expect(normalizeSettings({ backgroundColor: 'red' }).backgroundColor).toBe(DEFAULT_SETTINGS.backgroundColor);
  });

  it('steps a numeric control inside its limits', () => {
    expect(stepSetting(DEFAULT_SETTINGS, 'transposeNumber', 1).transposeNumber).toBe(1);
    expect(stepSetting(DEFAULT_SETTINGS, 'fontSize', -1).fontSize).toBe(DEFAULT_SETTINGS.fontSize - 1);
    expect(stepSetting({ ...DEFAULT_SETTINGS, transposeNumber: 11 }, 'transposeNumber', 1).transposeNumber).toBe(11);
  });

  it('applies the literal presets of the AC viewer', () => {
    const light = applyPreset(DEFAULT_SETTINGS, 'default-light');
    expect(light).toMatchObject({
      displayMode: 'both',
      backgroundColor: '#ffffff',
      chordColor: '#e67428',
      lyricColor: '#000000',
      lineHeight: 0.17,
    });

    const lyricsDark = applyPreset(DEFAULT_SETTINGS, 'only-lyrics-dark');
    expect(lyricsDark).toMatchObject({ displayMode: 'lyrics', backgroundColor: '#000000', lyricColor: '#e3e1de' });

    // A preset never changes the key or the font size chosen by the person.
    expect(applyPreset({ ...DEFAULT_SETTINGS, transposeNumber: 3, fontSize: 30 }, 'default-dark'))
      .toMatchObject({ transposeNumber: 3, fontSize: 30 });
    expect(Object.keys(VIEWER_PRESETS)).toHaveLength(4);
  });

  it('splits the controls into the chart and the global preferences', () => {
    const settings = { ...DEFAULT_SETTINGS, fontSize: 24, transposeNumber: 3, chordColor: '#123456' };
    expect(songPart(settings)).toEqual({ fontSize: 24, transposeNumber: 3 });
    expect(globalPart(settings)).not.toHaveProperty('fontSize');
    expect(globalPart(settings)).not.toHaveProperty('transposeNumber');
    expect(globalPart(settings).chordColor).toBe('#123456');
  });

  it('opens a chart with no transposition and the global font size', () => {
    const global = { ...DEFAULT_SETTINGS, fontSize: 24, transposeNumber: 3 };
    expect(withSongSettings(global, {})).toMatchObject({ transposeNumber: 0, fontSize: 24 });
    expect(withSongSettings(global, { transposeNumber: -2, fontSize: 30 })).toMatchObject({ transposeNumber: -2, fontSize: 30 });
  });

  it('reads only what a record of one chart may carry', () => {
    expect(normalizeSongSettings({ fontSize: 'nonsense', transposeNumber: 99, chordColor: '#ffffff' }))
      .toEqual({ fontSize: DEFAULT_SETTINGS.fontSize, transposeNumber: 11 });
    expect(normalizeSongSettings({ transposeNumber: 2 })).toEqual({ transposeNumber: 2 });
    expect(normalizeSongSettings(null)).toEqual({});
    expect(normalizeSongSettings([1, 2])).toEqual({});
  });

  it('describes the controls for the response items', () => {
    const rows = describeSettings({ ...DEFAULT_SETTINGS, transposeNumber: 3 }, 'A');
    expect(rows.find((row) => row.label === 'Transpose')?.value).toBe('+3 semitones');
    expect(rows.find((row) => row.label === 'Keys')?.value).toBe('A played');
  });
});