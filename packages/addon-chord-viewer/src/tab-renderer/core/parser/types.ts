// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
/** Chord parsed into its component parts. */
export type SimpleChord = {
  original: string;
  rootNote: string | null;
  quality: string | null;
  bassNote: string | null;
};

/** A chord with position and beat information. */
export type ChordItem = {
  chordPosition?: number;
  /** Literal chord-line text before this chord (spaces, DecorationToken parens, etc.). */
  chordLinePrefix?: string;
  chordTextLength?: number;
  beatType?: "strong" | "week";
  simpleChord: SimpleChord | null;
};

/** Elevated chord-line token used for interleaved rendering. */
export type ChordLineMarker =
  | {
      kind: "chord";
      position: number;
      textLength: number;
      beatType: "strong" | "week";
      simpleChord: SimpleChord | null;
    }
  | {
      kind: "decoration";
      position: number;
      text: string;
    };

/** A paired chord line + lyric line within a section. */
export type BarLine = {
  liricsTextBar: string;
  chordsTextBar?: string;
  sufixBar?: string;
  chordsList?: ChordItem[];
  chordLineMarkers?: ChordLineMarker[];
};

/** A section of a tab (e.g. [Verse], [Chorus]) with its lines. */
export type SectionText = {
  title: string | null;
  content: string | null;
  lines?: BarLine[] | null;
};

/** A single renderable item (lyric part, chord, or space). */
export type BarsListItem = {
  liricPart?: string;
  chordItem?: ChordItem;
  isSpace?: boolean;
  isNoLyricsLine?: boolean;
  /** Spacing/decoration from the chord line rendered above lyrics. */
  isChordLinePrefix?: boolean;
  /** Single decoration character/token elevated above lyrics. */
  isChordLineDecoration?: boolean;
  decorationText?: string;
};

export type BarsList = BarsListItem[];

/** A section with its bar list ready for rendering. */
export type SectionBarList = {
  content: string | null;
  title: string | null;
  barList: BarsList;
};
