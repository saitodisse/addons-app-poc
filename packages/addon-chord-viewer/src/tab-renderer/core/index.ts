// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
export * from "./types";
export {
  parseTab,
  TAB_RENDERER_PARSER_VERSION,
  TAB_RENDERER_AST_VERSION,
  STRICT_LINE_DIAGNOSTIC_CODES,
} from "./parseTab";
export { parseChordSymbol } from "./parser/parseChordSymbol";
export { collectDiagrammableChords } from "./collectDiagrammableChords";
export { transposeChordSymbol } from "./transposeChordSymbol";
export { transposeParsedTab } from "./transposeParsedTab";
export {
  logTabRenderer,
  logTabRendererGroup,
  summarizeParsedTab,
  type ParsedTabSummary,
} from "./observe";
export * from "./preparedTypes";
export { chordToText } from "./transposer/chordToText";
export { generateBarList } from "./renderer/generateBarList";
export { prepareSongFromParsedTab } from "./prepareSongFromParsedTab";
export type {
  ChordItem,
  SimpleChord,
  BarLine,
  ChordLineMarker,
  BarsList,
  BarsListItem,
} from "./parser/types";
