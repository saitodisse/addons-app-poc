// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import { collectDiagrammableChords } from "./collectDiagrammableChords";
import {
  logParseDiagnostics,
  logTabRenderer,
  measureTabRenderer,
  summarizeParsedTab,
} from "./observe";
import { parseChordSymbol } from "./parser/parseChordSymbol";
import { tokenizeRawLine } from "./parser/tokenizeRawLine";
import type {
  ParseDiagnostic,
  ParsedTab,
  ParsedTabLine,
  ParsedTabLineKind,
  ParsedTabSection,
  ParsedTabToken,
} from "./types";

export const TAB_RENDERER_PARSER_VERSION = "2.2.2";
export const TAB_RENDERER_AST_VERSION = "2.2.2";

const SECTION_LABEL_RE = /^\s*\[([^\]]+)\](.*)$/;
const COMMENT_LINE_RE = /^\s*(#|\/\/)/;
const COMMENT_PAREN_RE = /^\s*\([^)]*\)\s*$/;
const TAB_LINE_RE = /^\s*[EADGBe]\|/;
/** Lyric word that looks like a failed chord spelling (C/D/E), not a plain word (Eu). */
function lyricTokenLooksLikeInvalidChord(text: string): boolean {
  if (parseChordSymbol(text) !== null) {
    return false;
  }

  const rootMatch = text.match(/^([A-G])([#b♯♭]?)(.+)$/);
  if (!rootMatch) {
    return false;
  }

  const suffix = rootMatch[3] ?? "";
  if (suffix.length === 0) {
    return false;
  }

  return (
    /[0-9/()+#°º-]/.test(suffix) ||
    /^(?:m|M|maj|min|dim|aug|sus|add)(?![a-z])/i.test(suffix)
  );
}

export const STRICT_LINE_DIAGNOSTIC_CODES = {
  invalidLine: "invalid-line",
  invalidChordToken: "invalid-chord-token",
  chordsAndLyricsOnSameLine: "chords-and-lyrics-on-same-line",
  sectionHeaderWithContent: "section-header-with-content",
} as const;

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function createSectionId(order: number): string {
  return `section-${order + 1}`;
}

function createLineId(sectionOrder: number, lineOrder: number): string {
  return `section-${sectionOrder + 1}-line-${lineOrder + 1}`;
}

function classifyLine(
  raw: string,
  tokens: ParsedTabToken[],
): ParsedTabLineKind {
  if (raw.trim().length === 0) {
    return "blank";
  }

  const contentTokens = tokens.filter((token) => token.kind !== "SpaceToken");
  const chordCount = contentTokens.filter(
    (token) => token.kind === "ChordToken",
  ).length;
  const lyricCount = contentTokens.filter(
    (token) => token.kind === "LyricToken",
  ).length;

  if (chordCount === 0) {
    return "lyrics";
  }

  if (chordCount > lyricCount) {
    return "chords";
  }

  return "lyrics";
}

function isPureSectionHeaderLine(raw: string): boolean {
  const match = raw.match(SECTION_LABEL_RE);
  if (!match) {
    return false;
  }

  return (match[2] ?? "").replace(/^\s+/, "").length === 0;
}

function sectionHeaderRemainder(raw: string): string {
  const match = raw.match(SECTION_LABEL_RE);
  return (match?.[2] ?? "").replace(/^\s+/, "");
}

function buildLineDiagnostic(
  raw: string,
  tokens: ParsedTabToken[],
  lineNumber: number,
): ParseDiagnostic | null {
  const contentTokens = tokens.filter((token) => token.kind !== "SpaceToken");

  if (raw.trim().length === 0) {
    return null;
  }

  if (isPureSectionHeaderLine(raw)) {
    return null;
  }

  const sectionRemainder = sectionHeaderRemainder(raw);
  if (SECTION_LABEL_RE.test(raw) && sectionRemainder.length > 0) {
    return {
      code: STRICT_LINE_DIAGNOSTIC_CODES.sectionHeaderWithContent,
      message: `Line ${lineNumber} mixes a section header with other content.`,
      severity: "error",
      line: lineNumber,
      sourceRange: {
        startColumn: 0,
        endColumn: raw.length,
      },
    };
  }

  if (
    COMMENT_LINE_RE.test(raw) ||
    COMMENT_PAREN_RE.test(raw) ||
    TAB_LINE_RE.test(raw)
  ) {
    return {
      code: STRICT_LINE_DIAGNOSTIC_CODES.invalidLine,
      message: `Line ${lineNumber} is not a valid strict chord-chart line.`,
      severity: "error",
      line: lineNumber,
      sourceRange: {
        startColumn: 0,
        endColumn: raw.length,
      },
    };
  }

  if (contentTokens.length === 0) {
    return {
      code: STRICT_LINE_DIAGNOSTIC_CODES.invalidLine,
      message: `Line ${lineNumber} is not a valid strict chord-chart line.`,
      severity: "error",
      line: lineNumber,
      sourceRange: {
        startColumn: 0,
        endColumn: raw.length,
      },
    };
  }

  const lyricTokens = contentTokens.filter(
    (token) => token.kind === "LyricToken",
  );

  if (
    lyricTokens.length > 0 &&
    contentTokens.some(
      (token) =>
        token.kind === "LyricToken" &&
        lyricTokenLooksLikeInvalidChord(token.text),
    )
  ) {
    return {
      code: STRICT_LINE_DIAGNOSTIC_CODES.invalidChordToken,
      message: `Line ${lineNumber} contains an invalid chord token.`,
      severity: "error",
      line: lineNumber,
      sourceRange: {
        startColumn: 0,
        endColumn: raw.length,
      },
    };
  }

  return null;
}

function resolveKindForError(
  diagnostic: ParseDiagnostic,
  raw: string,
  tokens: ParsedTabToken[],
): ParsedTabLineKind {
  switch (diagnostic.code) {
    case STRICT_LINE_DIAGNOSTIC_CODES.sectionHeaderWithContent: {
      const remainder = sectionHeaderRemainder(raw);
      const remainderTokens = tokenizeRawLine(remainder);
      return classifyLine(remainder, remainderTokens);
    }
    case STRICT_LINE_DIAGNOSTIC_CODES.invalidChordToken:
      return "chords";
    case STRICT_LINE_DIAGNOSTIC_CODES.invalidLine:
      return "lyrics";
    default:
      return classifyLine(raw, tokens);
  }
}

function resolveLineKind(
  raw: string,
  tokens: ParsedTabToken[],
  diagnostic: ParseDiagnostic | null,
): ParsedTabLineKind {
  if (isPureSectionHeaderLine(raw)) {
    return "section-header";
  }

  if (diagnostic) {
    return resolveKindForError(diagnostic, raw, tokens);
  }

  return classifyLine(raw, tokens);
}

function pushLine(
  section: ParsedTabSection,
  rawLine: string,
  lineNumber: number,
  diagnostics: ParseDiagnostic[],
): void {
  const lineOrder = section.lines.length;
  const tokens = isPureSectionHeaderLine(rawLine)
    ? []
    : tokenizeRawLine(rawLine);
  const diagnostic = buildLineDiagnostic(rawLine, tokens, lineNumber);
  const kind = resolveLineKind(rawLine, tokens, diagnostic);
  const line: ParsedTabLine = {
    id: createLineId(section.order, lineOrder),
    order: lineOrder,
    text: rawLine,
    kind,
    tokens,
  };

  if (diagnostic) {
    diagnostics.push(diagnostic);
  }

  section.lines.push(line);
}

function parseTabInternal(body: string): ParsedTab {
  const diagnostics: ParseDiagnostic[] = [];
  const sections: ParsedTabSection[] = [];
  const rawLines = body.split(/\r?\n/);

  let currentSection: ParsedTabSection | null = null;

  const ensureCurrentSection = (): ParsedTabSection => {
    if (currentSection) {
      return currentSection;
    }

    currentSection = {
      id: createSectionId(sections.length),
      order: sections.length,
      title: null,
      originalTitle: null,
      lines: [],
    };
    return currentSection;
  };

  const finalizeCurrentSection = (): void => {
    if (!currentSection) {
      return;
    }

    if (currentSection.lines.length > 0 || currentSection.title !== null) {
      sections.push(currentSection);
    }

    currentSection = null;
  };

  rawLines.forEach((rawLine, rawIndex) => {
    const labelMatch = rawLine.match(SECTION_LABEL_RE);

    if (labelMatch) {
      const originalTitle = normalizeLabel(labelMatch[1] ?? "");

      finalizeCurrentSection();
      currentSection = {
        id: createSectionId(sections.length),
        order: sections.length,
        title: originalTitle,
        originalTitle,
        lines: [],
      };

      pushLine(currentSection, rawLine, rawIndex + 1, diagnostics);
      return;
    }

    if (currentSection === null && rawLine.trim().length === 0) {
      return;
    }

    const section = ensureCurrentSection();
    pushLine(section, rawLine, rawIndex + 1, diagnostics);
  });

  finalizeCurrentSection();

  const parsed: ParsedTab = {
    body,
    sections,
    diagnostics,
    parserVersion: TAB_RENDERER_PARSER_VERSION,
    astVersion: TAB_RENDERER_AST_VERSION,
    chordsFound: [],
  };

  return {
    ...parsed,
    chordsFound: collectDiagrammableChords(parsed),
  };
}

const shouldObserveParseTab =
  typeof import.meta !== "undefined" &&
  import.meta.env?.DEV === true &&
  import.meta.env?.VITEST !== "true";

export function parseTab(body: string): ParsedTab {
  if (!shouldObserveParseTab) {
    return parseTabInternal(body);
  }

  return measureTabRenderer(
    "parseTab",
    () => {
      const parsed = parseTabInternal(body);
      logTabRenderer("parseTab:summary", summarizeParsedTab(parsed));
      logParseDiagnostics(parsed.diagnostics);
      return parsed;
    },
    { lineCount: body.split(/\r?\n/).length },
  );
}
