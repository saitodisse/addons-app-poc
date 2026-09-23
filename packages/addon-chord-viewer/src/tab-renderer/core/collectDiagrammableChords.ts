// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { ParsedTab, ParsedTabSection } from "./types";

function collectFromSections(
  sections: ReadonlyArray<ParsedTabSection>,
): ReadonlyArray<string> {
  const seen = new Set<string>();
  const chordsFound: string[] = [];

  for (const section of sections) {
    for (const line of section.lines) {
      for (const token of line.tokens) {
        if (
          token.kind !== "ChordToken" ||
          !token.chord ||
          token.chord.kind !== "chord"
        ) {
          continue;
        }

        if (seen.has(token.chord.text)) {
          continue;
        }

        seen.add(token.chord.text);
        chordsFound.push(token.chord.text);
      }
    }
  }

  return chordsFound;
}

export function collectDiagrammableChords(
  parsed: ParsedTab,
): ReadonlyArray<string> {
  return collectFromSections(parsed.sections);
}
