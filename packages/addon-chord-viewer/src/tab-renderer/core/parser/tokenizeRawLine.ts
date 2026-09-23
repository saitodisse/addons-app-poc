// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import { tokenizeContentWord } from "./tokenizeContentWord";
import type { ParsedTabToken } from "../types";

export function tokenizeRawLine(raw: string): ParsedTabToken[] {
  if (raw.trim().length === 0) {
    return [];
  }

  const tokens: ParsedTabToken[] = [];
  const pattern = /\s+|[^\s]+/g;

  for (const match of raw.matchAll(pattern)) {
    const text = match[0] ?? "";
    const startColumn = match.index ?? 0;
    const endColumn = startColumn + text.length;

    if (/^\s+$/.test(text)) {
      tokens.push({
        kind: "SpaceToken",
        text,
        startColumn,
        endColumn,
      });
      continue;
    }

    tokens.push(...tokenizeContentWord(text, startColumn));
  }

  return tokens;
}
