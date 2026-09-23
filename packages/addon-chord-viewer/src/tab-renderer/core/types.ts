// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
export type {
  ParseDiagnostic,
  ParseDiagnosticSeverity,
} from "../domain/diagnostics";
export type { ParsedChordSymbol } from "../domain/chord-symbol";
export type {
  ParsedTabLine,
  ParsedTabLineKind,
  ParsedTabSection,
  ParsedTabToken,
  ParsedTabTokenKind,
} from "../domain/tab-ast";

import type { ParsedTab as DomainParsedTab } from "../domain/tab-ast";

export type ParsedTab = DomainParsedTab & {
  chordsFound: ReadonlyArray<string>;
};