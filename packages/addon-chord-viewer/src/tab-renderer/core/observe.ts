// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { ParseDiagnostic, ParsedTab } from "./types";

const LAYER = "tab-renderer";

type ObserveLevel = "info" | "debug" | "warn";

function emit(level: ObserveLevel, event: string, payload?: unknown): void {
  const message = `[${LAYER}] ${event}`;
  if (level === "warn") {
    if (payload === undefined) console.warn(message);
    else console.warn(message, payload);
    return;
  }
  if (level === "debug") {
    if (payload === undefined) console.debug(message);
    else console.debug(message, payload);
    return;
  }
  if (payload === undefined) console.info(message);
  else console.info(message, payload);
}

export function logTabRenderer(
  event: string,
  payload?: Record<string, unknown>,
  level: ObserveLevel = "info",
): void {
  emit(level, event, payload);
}

export function logTabRendererGroup(
  event: string,
  payload: Record<string, unknown>,
  details?: unknown,
): void {
  console.groupCollapsed(`[${LAYER}] ${event}`, payload);
  if (details !== undefined) {
    console.info(details);
  }
  console.groupEnd();
}

export type ParsedTabSummary = {
  parserVersion: string;
  astVersion: string;
  sections: number;
  lines: number;
  linesByKind: Record<string, number>;
  tokens: number;
  chordTokens: number;
  diagnostics: number;
  diagnosticErrors: number;
  diagnosticCodes: string[];
  chordsFound: string[];
  sectionTitles: string[];
};

export function summarizeParsedTab(parsed: ParsedTab): ParsedTabSummary {
  const lines = parsed.sections.flatMap((section) => section.lines);
  const linesByKind = lines.reduce<Record<string, number>>((counts, line) => {
    counts[line.kind] = (counts[line.kind] ?? 0) + 1;
    return counts;
  }, {});

  const tokens = lines.flatMap((line) => line.tokens);
  const chordTokens = tokens.filter(
    (token) => token.kind === "ChordToken",
  ).length;
  const diagnosticErrors = parsed.diagnostics.filter(
    (diagnostic) => diagnostic.severity === "error",
  );

  return {
    parserVersion: parsed.parserVersion,
    astVersion: parsed.astVersion,
    sections: parsed.sections.length,
    lines: lines.length,
    linesByKind,
    tokens: tokens.length,
    chordTokens,
    diagnostics: parsed.diagnostics.length,
    diagnosticErrors: diagnosticErrors.length,
    diagnosticCodes: [...new Set(parsed.diagnostics.map((d) => d.code))],
    chordsFound: [...parsed.chordsFound],
    sectionTitles: parsed.sections.map((s) => s.title ?? "(untitled)"),
  };
}

export function logParseDiagnostics(
  diagnostics: ReadonlyArray<ParseDiagnostic>,
): void {
  if (diagnostics.length === 0) {
    return;
  }

  logTabRendererGroup(
    "parseTab:diagnostics",
    {
      count: diagnostics.length,
      errors: diagnostics.filter((d) => d.severity === "error").length,
    },
    diagnostics,
  );
}

export function measureTabRenderer<T>(
  event: string,
  run: () => T,
  extra?: Record<string, unknown>,
): T {
  const startedAt = performance.now();
  logTabRenderer(`${event}:start`, extra, "debug");
  const result = run();
  logTabRenderer(`${event}:done`, {
    ...extra,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return result;
}
