/**
 * Viewer controls.
 *
 * The names and ranges follow the viewer settings of the AC viewer, and the
 * style object is passed straight to the rendered tab. The four presets reuse
 * the literal values of that viewer, so the same chart can be compared between
 * the two projects.
 */
import {
  DEFAULT_TAB_STYLE,
  type DisplayMode,
  type TabStyleConfig,
  type ViewMode,
} from './tab-renderer/core/preparedTypes';

export interface ViewerSettings extends TabStyleConfig {
  /** Reduces extended symbols to their simplest playable shape before parsing. */
  simplifyChords: boolean;
  /** Prints the summary block and the control items above the chart. */
  summaryOpen: boolean;
}

export type ViewerPresetKind = 'default-light' | 'default-dark' | 'only-lyrics-light' | 'only-lyrics-dark';

export const DEFAULT_SETTINGS: ViewerSettings = {
  ...DEFAULT_TAB_STYLE,
  simplifyChords: false,
  summaryOpen: true,
};

/** Literal presets of the AC viewer, applied over the current settings. */
export const VIEWER_PRESETS: Record<ViewerPresetKind, Partial<ViewerSettings>> = {
  'default-light': {
    viewMode: 'e',
    displayMode: 'both',
    lineHeight: 0.17,
    chordColor: '#e67428',
    chordHeight: 0.064,
    blockMarginRight: 0.556,
    lyricColor: '#000000',
    sectionGap: 9,
    sectionTitleColor: '#4e8d63',
    sectionTitleFontSize: 14,
    backgroundColor: '#ffffff',
  },
  'default-dark': {
    viewMode: 'e',
    displayMode: 'both',
    lineHeight: 0.17,
    chordColor: '#9e9e9e',
    chordHeight: 0.064,
    blockMarginRight: 0.556,
    lyricColor: '#fff2e0',
    sectionGap: 9,
    sectionTitleColor: '#17542b',
    sectionTitleFontSize: 14,
    backgroundColor: '#181310',
  },
  'only-lyrics-light': {
    displayMode: 'lyrics',
    lineHeight: 0.06,
    chordColor: '#282a2e',
    chordHeight: 0.064,
    blockMarginRight: 0.531,
    lyricColor: '#312411',
    sectionGap: 24,
    sectionTitleColor: '#ff811a',
    sectionTitleFontSize: 14,
    backgroundColor: '#f6efe5',
  },
  'only-lyrics-dark': {
    displayMode: 'lyrics',
    lineHeight: 0.06,
    chordColor: '#f2952c',
    chordHeight: 0.064,
    blockMarginRight: 0.531,
    lyricColor: '#e3e1de',
    sectionGap: 24,
    sectionTitleColor: '#907251',
    sectionTitleFontSize: 14,
    backgroundColor: '#000000',
  },
};

export const NUMERIC_LIMITS = {
  transposeNumber: { min: -11, max: 11, step: 1 },
  fontSize: { min: 10, max: 40, step: 1 },
  lineHeight: { min: 0, max: 0.25, step: 0.01 },
  chordHeight: { min: 0, max: 0.1, step: 0.001 },
  blockMarginRight: { min: 0.4, max: 0.7, step: 0.001 },
  sectionGap: { min: 0, max: 80, step: 1 },
  sectionTitleFontSize: { min: 8, max: 32, step: 1 },
} as const;

export type NumericSetting = keyof typeof NUMERIC_LIMITS;

function clampNumber(value: unknown, fallback: number, limits: { min: number; max: number }): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(limits.max, Math.max(limits.min, number));
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{3,8}$/iu.test(value) ? value : fallback;
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Reads any stored value into a complete, safe settings object. */
export function normalizeSettings(value: unknown): ViewerSettings {
  const source = value && typeof value === 'object' ? value as Partial<ViewerSettings> : {};
  const base = DEFAULT_SETTINGS;
  return {
    transposeNumber: clampNumber(source.transposeNumber, base.transposeNumber, NUMERIC_LIMITS.transposeNumber),
    fontSize: clampNumber(source.fontSize, base.fontSize, NUMERIC_LIMITS.fontSize),
    lineHeight: clampNumber(source.lineHeight, base.lineHeight, NUMERIC_LIMITS.lineHeight),
    chordHeight: clampNumber(source.chordHeight, base.chordHeight, NUMERIC_LIMITS.chordHeight),
    blockMarginRight: clampNumber(source.blockMarginRight, base.blockMarginRight, NUMERIC_LIMITS.blockMarginRight),
    contentMarginRightPx: clampNumber(source.contentMarginRightPx, base.contentMarginRightPx, { min: 0, max: 1000 }),
    viewMode: pick(source.viewMode, ['e', 'o'] as const, base.viewMode),
    displayMode: pick(source.displayMode, ['both', 'chords', 'lyrics'] as const, base.displayMode),
    chordColor: color(source.chordColor, base.chordColor),
    lyricColor: color(source.lyricColor, base.lyricColor),
    backgroundColor: color(source.backgroundColor, base.backgroundColor),
    sectionGap: clampNumber(source.sectionGap, base.sectionGap, NUMERIC_LIMITS.sectionGap),
    sectionTitleColor: color(source.sectionTitleColor, base.sectionTitleColor),
    sectionTitleFontSize: clampNumber(source.sectionTitleFontSize, base.sectionTitleFontSize, NUMERIC_LIMITS.sectionTitleFontSize),
    simplifyChords: flag(source.simplifyChords, base.simplifyChords),
    summaryOpen: flag(source.summaryOpen, base.summaryOpen),
  };
}

/** Adds one step to a numeric control, respecting its limits and precision. */
export function stepSetting(settings: ViewerSettings, key: NumericSetting, direction: number): ViewerSettings {
  const limits = NUMERIC_LIMITS[key];
  const rounded = Math.round((settings[key] + direction * limits.step) * 1000) / 1000;
  return { ...settings, [key]: Math.min(limits.max, Math.max(limits.min, rounded)) };
}

/** Applies the literal preset of the AC viewer over the current settings. */
export function applyPreset(settings: ViewerSettings, kind: ViewerPresetKind): ViewerSettings {
  return normalizeSettings({ ...settings, ...VIEWER_PRESETS[kind] });
}

export function cycleValue<T extends string>(current: T, values: readonly T[]): T {
  const index = values.indexOf(current);
  return values[(index + 1) % values.length];
}

/**
 * Controls kept for each chart, the group the AC viewer calls the current chart.
 *
 * The font size and the transposition belong to the song a person is reading:
 * moving them does not follow into the next chart. Everything else — layout,
 * colours, sections, page — is a reading preference and stays global.
 */
export const SONG_FIELDS = ['fontSize', 'transposeNumber'] as const;

export type SongSetting = (typeof SONG_FIELDS)[number];

/**
 * Transposition a chart starts from when its record does not say otherwise.
 *
 * A song opens as written. Only a deliberate transposition of that song — which
 * the record then keeps — changes it.
 */
export const SONG_TRANSPOSE_DEFAULT = 0;

/** The part of the settings that belongs to one chart. */
export function songPart(settings: ViewerSettings): Partial<ViewerSettings> {
  return { fontSize: settings.fontSize, transposeNumber: settings.transposeNumber };
}

/** The part of the settings shared by every chart. */
export function globalPart(settings: ViewerSettings): ViewerSettings {
  const global = { ...settings } as Record<string, unknown>;
  for (const field of SONG_FIELDS) delete global[field];
  return global as unknown as ViewerSettings;
}

/**
 * Reads one stored record of a chart, keeping only what it may carry.
 *
 * A missing record is a chart nobody has adjusted yet, so the transposition
 * starts from zero while the font size falls back to the global preference.
 */
export function normalizeSongSettings(value: unknown): Partial<ViewerSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const song: Partial<ViewerSettings> = {};
  if (source.fontSize !== undefined) {
    song.fontSize = clampNumber(source.fontSize, DEFAULT_SETTINGS.fontSize, NUMERIC_LIMITS.fontSize);
  }
  if (source.transposeNumber !== undefined) {
    song.transposeNumber = clampNumber(source.transposeNumber, SONG_TRANSPOSE_DEFAULT, NUMERIC_LIMITS.transposeNumber);
  }
  return song;
}

/** Settings of one chart: the global preferences with the chart's own on top. */
export function withSongSettings(global: ViewerSettings, song: Partial<ViewerSettings>): ViewerSettings {
  return normalizeSettings({
    ...global,
    fontSize: song.fontSize ?? global.fontSize,
    transposeNumber: song.transposeNumber ?? SONG_TRANSPOSE_DEFAULT,
  });
}

export interface ControlRow {
  label: string;
  value: string;
}

/** Human-readable rows describing the current controls. */
export function describeSettings(settings: ViewerSettings, shapeKey?: string): ControlRow[] {
  const semitones = settings.transposeNumber;
  return [
    { label: 'Output', value: `${settings.displayMode} · ${settings.viewMode === 'e' ? 'extended' : 'original'} layout` },
    { label: 'Transpose', value: semitones === 0 ? 'original' : `${semitones > 0 ? '+' : ''}${semitones} semitone${Math.abs(semitones) === 1 ? '' : 's'}` },
    { label: 'Keys', value: `${shapeKey ?? '?'} played` },
    { label: 'Colors', value: `chord ${settings.chordColor} · lyric ${settings.lyricColor} · page ${settings.backgroundColor}` },
    { label: 'Simplify', value: settings.simplifyChords ? 'on' : 'off' },
  ];
}

export type { DisplayMode, ViewMode, TabStyleConfig };
/**
 * Control values of the panel, as the host stores them.
 *
 * The ids match the controls declared in `tab-definition.ts`, and the names
 * follow the AC viewer: `extendedLayout` is its `visualizacaoEstendida`,
 * `showChords` its `mostrarCifras`, and so on.
 */
export function settingsToValues(settings: ViewerSettings): Record<string, string> {
  return {
    fontSize: String(settings.fontSize),
    transposeNumber: String(settings.transposeNumber),
    extendedLayout: settings.viewMode === 'e' ? 'true' : 'false',
    showChords: settings.displayMode !== 'lyrics' ? 'true' : 'false',
    lineHeight: String(settings.lineHeight),
    chordColor: settings.chordColor,
    chordHeight: String(settings.chordHeight),
    blockMarginRight: String(settings.blockMarginRight),
    lyricColor: settings.lyricColor,
    sectionGap: String(settings.sectionGap),
    sectionTitleColor: settings.sectionTitleColor,
    sectionTitleFontSize: String(settings.sectionTitleFontSize),
    backgroundColor: settings.backgroundColor,
    simplifyChords: settings.simplifyChords ? 'true' : 'false',
    summaryOpen: settings.summaryOpen ? 'true' : 'false',
  };
}

/** Reads the control values back into settings, ignoring what cannot be read. */
export function valuesToSettings(values: Record<string, string>, base: ViewerSettings = DEFAULT_SETTINGS): ViewerSettings {
  const number = (id: NumericSetting, fallback: number): number => {
    const raw = values[id];
    const parsed = raw === undefined || raw === '' ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const flag = (id: string, fallback: boolean): boolean => (values[id] === undefined ? fallback : values[id] === 'true');
  const text = (id: string, fallback: string): string => {
    const raw = values[id];
    return typeof raw === 'string' && raw.trim() ? raw.trim() : fallback;
  };

  return normalizeSettings({
    ...base,
    fontSize: number('fontSize', base.fontSize),
    transposeNumber: number('transposeNumber', base.transposeNumber),
    viewMode: flag('extendedLayout', base.viewMode === 'e') ? 'e' : 'o',
    displayMode: flag('showChords', base.displayMode !== 'lyrics') ? 'both' : 'lyrics',
    lineHeight: number('lineHeight', base.lineHeight),
    chordColor: text('chordColor', base.chordColor),
    chordHeight: number('chordHeight', base.chordHeight),
    blockMarginRight: number('blockMarginRight', base.blockMarginRight),
    lyricColor: text('lyricColor', base.lyricColor),
    sectionGap: number('sectionGap', base.sectionGap),
    sectionTitleColor: text('sectionTitleColor', base.sectionTitleColor),
    sectionTitleFontSize: number('sectionTitleFontSize', base.sectionTitleFontSize),
    backgroundColor: text('backgroundColor', base.backgroundColor),
    simplifyChords: flag('simplifyChords', base.simplifyChords),
    summaryOpen: flag('summaryOpen', base.summaryOpen),
  });
}
