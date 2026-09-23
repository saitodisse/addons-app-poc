// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
export type ParseDiagnosticSeverity = "info" | "warning" | "error";

export type ParseDiagnostic = {
  code: string;
  message: string;
  severity: ParseDiagnosticSeverity;
  line?: number;
  column?: number;
  sourceRange?: {
    startColumn: number;
    endColumn: number;
  };
};