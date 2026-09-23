// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { ParseDiagnostic } from "./diagnostics";
import type { ParsedChordSymbol } from "./chord-symbol";

export type ParsedTabTokenKind =
  | "ChordToken"
  | "LyricToken"
  | "DecorationToken"
  | "SpaceToken";

export type ParsedTabToken = {
  kind: ParsedTabTokenKind;
  text: string;
  startColumn: number;
  endColumn: number;
  chord?: ParsedChordSymbol;
};

/**
 * Strict line classification for chord-chart authoring.
 *
 * - `section-header` — line contains only `[Title]` markup; may appear in
 *   `section.lines` for traceability with empty chord tokens.
 * - `chords` — chord symbols dominate the line; may include `DecorationToken`
 *   (e.g. parentheses around chord groups) but not lyric words.
 * - `lyrics` — lyric tokens only.
 * - `blank` — empty or whitespace-only line.
 */
export type ParsedTabLineKind =
  | "section-header"
  | "chords"
  | "lyrics"
  | "blank";

export type ParsedTabLine = {
  id: string;
  order: number;
  text: string;
  kind: ParsedTabLineKind;
  tokens: ParsedTabToken[];
};

export type ParsedTabSection = {
  id: string;
  order: number;
  title: string | null;
  originalTitle: string | null;
  lines: ParsedTabLine[];
};

/**
 * Canonical chart AST produced by strict parsers (e.g. `tab-renderer`).
 *
 * Prefer this type over the legacy segment-based `ChordChartAst` model.
 */
export type ParsedTab = {
  body: string;
  sections: ParsedTabSection[];
  diagnostics: ParseDiagnostic[];
  parserVersion: string;
  astVersion: string;
  /**
   * De-duplicated diagrammable chord symbols (`ParsedChordSymbol.kind === "chord"`).
   * Repeat markers (`/`) are never included.
   */
  chordsFound: ReadonlyArray<string>;
};