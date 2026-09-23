// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import { parseChordSymbol } from "./parseChordSymbol";
import type { ParsedTabToken } from "../types";

/** True when `)` closes an in-chord extension such as `(13)` or `(9-)`. */
function closingParenIsChordExtension(token: string): boolean {
  if (!token.endsWith(")")) {
    return false;
  }
  return /\([^()]*$/.test(token.slice(0, -1));
}

/** True when a trailing `)` is spacing decoration, not part of the chord spelling. */
function trailingParenIsDecoration(token: string): boolean {
  if (!token.endsWith(")")) {
    return false;
  }
  if (closingParenIsChordExtension(token)) {
    return false;
  }
  return parseChordSymbol(token.slice(0, -1)) !== null;
}

function decorationToken(text: string, startColumn: number): ParsedTabToken {
  return {
    kind: "DecorationToken",
    text,
    startColumn,
    endColumn: startColumn + text.length,
  };
}

function chordToken(
  text: string,
  startColumn: number,
  chord: NonNullable<ReturnType<typeof parseChordSymbol>>,
): ParsedTabToken {
  return {
    kind: "ChordToken",
    text,
    startColumn,
    endColumn: startColumn + text.length,
    chord,
  };
}

function lyricToken(text: string, startColumn: number): ParsedTabToken {
  return {
    kind: "LyricToken",
    text,
    startColumn,
    endColumn: startColumn + text.length,
  };
}

function peelDecorationTokens(
  text: string,
  startColumn: number,
): ParsedTabToken[] | null {
  let column = startColumn;
  const tokens: ParsedTabToken[] = [];
  let rest = text;

  while (rest.startsWith("(")) {
    tokens.push(decorationToken("(", column));
    column += 1;
    rest = rest.slice(1);
  }

  let trailingParens = 0;
  let core = rest;
  while (core.endsWith(")") && trailingParenIsDecoration(core)) {
    trailingParens += 1;
    core = core.slice(0, -1);
  }

  const wrappedChord = parseChordSymbol(core);
  if (!wrappedChord || tokens.length + trailingParens === 0) {
    return null;
  }

  tokens.push(chordToken(core, column, wrappedChord));
  column += core.length;
  for (let index = 0; index < trailingParens; index += 1) {
    tokens.push(decorationToken(")", column));
    column += 1;
  }

  return tokens;
}

/**
 * Expands one whitespace-delimited word into chord, lyric, and decoration tokens.
 * Parentheses that are not part of a chord symbol become DecorationToken.
 */
export function tokenizeContentWord(
  text: string,
  startColumn: number,
): ParsedTabToken[] {
  if (text === "(" || text === ")") {
    return [decorationToken(text, startColumn)];
  }

  const directChord = parseChordSymbol(text);
  if (directChord && !trailingParenIsDecoration(text)) {
    return [chordToken(text, startColumn, directChord)];
  }

  if (text.startsWith("(") || text.endsWith(")")) {
    const peeled = peelDecorationTokens(text, startColumn);
    if (peeled) {
      return peeled;
    }
  }

  return [lyricToken(text, startColumn)];
}
