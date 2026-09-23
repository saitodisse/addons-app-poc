// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import { collectDiagrammableChords } from "./collectDiagrammableChords";
import { parseChordSymbol } from "./parser/parseChordSymbol";
import type { ParsedTab, ParsedTabToken } from "./types";
import { transposeChordSymbol } from "./transposeChordSymbol";

function transposeToken(
  token: ParsedTabToken,
  semitones: number,
): ParsedTabToken {
  if (
    token.kind !== "ChordToken" ||
    !token.chord ||
    token.chord.kind !== "chord"
  ) {
    return { ...token };
  }

  const text = transposeChordSymbol(token.text, semitones);
  const chord = parseChordSymbol(text);

  return {
    ...token,
    text,
    ...(chord ? { chord } : {}),
  };
}

export function transposeParsedTab(
  parsed: ParsedTab,
  semitones: number,
): ParsedTab {
  if (semitones === 0) {
    return parsed;
  }

  const sections = parsed.sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => ({
      ...line,
      tokens: line.tokens.map((token) => transposeToken(token, semitones)),
    })),
  }));

  const transposed: ParsedTab = {
    ...parsed,
    sections,
    chordsFound: [],
  };

  return {
    ...transposed,
    chordsFound: collectDiagrammableChords(transposed),
  };
}
