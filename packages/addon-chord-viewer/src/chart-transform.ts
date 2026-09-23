/**
 * Transformations applied to the chart before the tab renderer reads it.
 *
 * Both rules reuse the ported tokenizer and chord grammar, so there is exactly
 * one definition of what a chord is.
 */
import { parseChordSymbol } from './tab-renderer/core/parser/parseChordSymbol';
import { tokenizeRawLine } from './tab-renderer/core/parser/tokenizeRawLine';
import type { ParsedChordSymbol } from './tab-renderer/core/types';

const SIMPLIFY_RULES: Array<[RegExp, string]> = [
  [/^6\/9/u, '6'],
  // A minor-major chord keeps its minor third.
  [/^mmaj\d*/u, 'm'],
  [/^mMaj\d*/u, 'm'],
  [/^(?:major|Major|maj|Maj)\d*/u, ''],
  [/^7M/u, ''],
  [/^M7/u, ''],
  [/^M(?![a-z])/u, ''],
  [/^add9/u, ''],
  [/^m7\(?b5\)?/u, 'm'],
  [/^m7/u, 'm'],
  [/^m6/u, 'm'],
  [/^m9/u, 'm'],
  [/^m11/u, 'm'],
  [/^m13/u, 'm'],
  [/^sus2/u, 'sus4'],
  [/^7\([^)]*\)/u, ''],
  [/^7/u, ''],
  [/^9/u, ''],
  [/^11/u, ''],
  [/^13/u, ''],
  [/^6/u, ''],
  [/^\([^)]*\)/u, ''],
];

/** Reduces one symbol to its simplest playable shape; unknown text is kept. */
export function simplifyChordSymbol(symbol: string): string {
  const parsed = parseChordSymbol(symbol);
  if (!parsed || parsed.kind !== 'chord') return symbol;

  let suffix = parsed.suffix;
  for (const [pattern, replacement] of SIMPLIFY_RULES) {
    if (pattern.test(suffix)) {
      suffix = suffix.replace(pattern, replacement);
      break;
    }
  }
  suffix = suffix.replace(/^\([^)]*\)/u, '');

  return `${parsed.root}${suffix}${parsed.bass ? `/${parsed.bass}` : ''}`;
}

/** Rewrites every chord token of the chart, leaving the lyrics untouched. */
export function simplifyChartText(text: string): string {
  return String(text ?? '')
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => {
      let changed = false;
      const rewritten = tokenizeRawLine(line)
        .map((token) => {
          if (token.kind !== 'ChordToken') return token.text;
          const next = simplifyChordSymbol(token.text);
          if (next !== token.text) changed = true;
          return next;
        })
        .join('');
      return changed ? rewritten : line;
    })
    .join('\n');
}

const MINOR_SUFFIX = /^m(?![a-z])/u;

/**
 * Key of a chart without metadata, inferred from its first chord. It is the
 * tonic in almost every published chart and it is only used for the summary.
 */
export function inferKey(chordsFound: readonly string[]): string | undefined {
  for (const symbol of chordsFound) {
    const parsed: ParsedChordSymbol | null = parseChordSymbol(symbol);
    if (!parsed || parsed.kind !== 'chord') continue;
    return `${parsed.root}${MINOR_SUFFIX.test(parsed.suffix) ? 'm' : ''}`;
  }
  return undefined;
}