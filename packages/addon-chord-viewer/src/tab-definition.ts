/**
 * Single definition of the tab contract: the controls of the panel and the
 * buttons beside them. The manifest and the executable tab both read this
 * table, so the labels of the contract and of the interface cannot drift apart.
 *
 * The control ids and their headings follow the AC viewer: `Current chart` is
 * its `cifraAtual`, `Reading` its `leituraGlobal`, and the four sub-groups are
 * its chord, lyric, section, and page folders.
 */

export interface TabFieldDefinition {
  id: string;
  label: string;
  description: string;
  type?: 'text' | 'textarea' | 'url' | 'range' | 'toggle' | 'color';
  placeholder?: string;
  required?: boolean;
  /** Classification of the value, declared for every field. */
  classification?: 'public' | 'personal';
  /** Heading of the control panel where the field is shown. */
  group?: string;
  /** Chooses which content to read; a result page that already has it hides these. */
  source?: boolean;
  /** Bounds of a `range` control. */
  min?: number;
  max?: number;
  step?: number;
}

export interface TabActionDefinition {
  id: string;
  label: string;
  description: string;
  /** Field identifiers the action accepts. */
  receives?: string[];
  variant?: 'primary' | 'secondary' | 'danger';
  /** Heading of the control panel where the action is shown. */
  group?: string;
  /** Chooses which content to read; a result page that already has it hides these. */
  source?: boolean;
  /** Runs again whenever a field it receives changes. */
  live?: boolean;
}

export const CATALOG_FIELD = 'catalog';
export const CHART_FIELD = 'chart';
export const TEXT_FIELD = 'text';

/** Controls the live action follows, in declaration order. */
export const STYLE_FIELDS = [
  'fontSize',
  'transposeNumber',
  'extendedLayout',
  'showChords',
  'lineHeight',
  'chordColor',
  'chordHeight',
  'blockMarginRight',
  'lyricColor',
  'sectionGap',
  'sectionTitleColor',
  'sectionTitleFontSize',
  'backgroundColor',
  'simplifyChords',
  'summaryOpen',
];

export const TAB_FIELDS: TabFieldDefinition[] = [
  {
    id: CATALOG_FIELD,
    label: 'Catalogue URL',
    description: 'Base URL or manifest URL of a chord-chart catalogue that follows the public protocol.',
    type: 'url',
    placeholder: 'http://localhost:5295',
    group: 'Chart',
    source: true,
  },
  {
    id: CHART_FIELD,
    label: 'Chart',
    description: 'Chart identifier published by the catalogue, or a complete content URL.',
    placeholder: 'harbor-light',
    group: 'Chart',
    source: true,
  },
  {
    id: TEXT_FIELD,
    label: 'Chart text or payload',
    description: 'Chart text (or the structured payload) pasted by hand; when filled it wins over the catalogue.',
    type: 'textarea',
    placeholder: '[Intro]\nG   D   Em   C\n\n[Verse]\nG            D\nRows of lanterns on the pier',
    classification: 'personal',
    group: 'Chart',
    source: true,
  },

  {
    id: 'fontSize',
    label: 'Font size',
    description: 'Base size of the chart text.',
    type: 'range',
    min: 10,
    max: 40,
    step: 1,
    group: 'Current chart',
  },
  {
    id: 'transposeNumber',
    label: 'Transpose',
    description: 'Semitones applied to every chord of the chart.',
    type: 'range',
    min: -11,
    max: 11,
    step: 1,
    group: 'Current chart',
  },
  {
    id: 'extendedLayout',
    label: 'Extended layout',
    description: 'Prints the bar marks of the extended layout instead of the original line breaks.',
    type: 'toggle',
    group: 'Reading',
  },
  {
    id: 'showChords',
    label: 'Show chords',
    description: 'Prints the chords; when off, only the lyrics are shown.',
    type: 'toggle',
    group: 'Reading',
  },
  {
    id: 'lineHeight',
    label: 'Line height',
    description: 'Vertical rhythm between the lines of the chart.',
    type: 'range',
    min: 0,
    max: 0.25,
    step: 0.01,
    group: 'Reading',
  },
  {
    id: 'chordColor',
    label: 'Chord colour',
    description: 'Colour of every chord symbol.',
    type: 'color',
    group: 'Chords',
  },
  {
    id: 'chordHeight',
    label: 'Chord height',
    description: 'How far a chord is lifted above its lyric line.',
    type: 'range',
    min: 0,
    max: 0.1,
    step: 0.001,
    group: 'Chords',
  },
  {
    id: 'blockMarginRight',
    label: 'Block margin',
    description: 'Horizontal gap between the blocks of the chart.',
    type: 'range',
    min: 0.4,
    max: 0.7,
    step: 0.001,
    group: 'Chords',
  },

  {
    id: 'lyricColor',
    label: 'Lyric colour',
    description: 'Colour of the lyric text.',
    type: 'color',
    group: 'Lyrics',
  },

  {
    id: 'sectionGap',
    label: 'Section gap',
    description: 'Space between the sections of the chart.',
    type: 'range',
    min: 0,
    max: 80,
    step: 1,
    group: 'Sections',
  },
  {
    id: 'sectionTitleColor',
    label: 'Title colour',
    description: 'Colour of the section titles.',
    type: 'color',
    group: 'Sections',
  },
  {
    id: 'sectionTitleFontSize',
    label: 'Title size',
    description: 'Size of the section titles.',
    type: 'range',
    min: 8,
    max: 32,
    step: 1,
    group: 'Sections',
  },

  {
    id: 'backgroundColor',
    label: 'Page colour',
    description: 'Background colour of the rendered chart.',
    type: 'color',
    group: 'Page',
  },

  {
    id: 'simplifyChords',
    label: 'Simplify chords',
    description: 'Replaces extended symbols with their simplest playable shape before parsing.',
    type: 'toggle',
    group: 'Options',
  },
  {
    id: 'summaryOpen',
    label: 'Summary',
    description: 'Prints the summary block above the chart.',
    type: 'toggle',
    group: 'Options',
  },
];

export const TAB_ACTIONS: TabActionDefinition[] = [
  { id: 'load', label: 'Load chart', description: 'Reads the chart from the catalogue, a content URL, or the pasted text.', receives: [CATALOG_FIELD, CHART_FIELD, TEXT_FIELD], variant: 'primary', group: 'Chart', source: true },
  { id: 'list', label: 'List charts', description: 'Lists the recently updated charts published by the catalogue.', receives: [CATALOG_FIELD], group: 'Chart', source: true },
  // The data format describes whatever chart is open, so it follows the reader.
  { id: 'inspect', label: 'Data format', description: 'Prints the parsed model as JSON: sections, lines, tokens, and chords found.', group: 'Options', source: true },
  {
    id: 'apply',
    label: 'Render chart',
    description: 'Renders the chart again with the controls in use. It also runs by itself while a control changes.',
    receives: STYLE_FIELDS,
    live: true,
    group: 'Options',
  },

  { id: 'preset-light', label: 'Preset light', description: 'Applies the light preset of the AC viewer.', group: 'Presets' },
  { id: 'preset-dark', label: 'Preset dark', description: 'Applies the dark preset of the AC viewer.', group: 'Presets' },
  { id: 'preset-lyrics-light', label: 'Lyrics light', description: 'Applies the light lyrics-only preset of the AC viewer.', group: 'Presets' },
  { id: 'preset-lyrics-dark', label: 'Lyrics dark', description: 'Applies the dark lyrics-only preset of the AC viewer.', group: 'Presets' },

  { id: 'reset', label: 'Restore defaults', description: 'Returns every control to its default value.', variant: 'danger', group: 'Options' },
];
