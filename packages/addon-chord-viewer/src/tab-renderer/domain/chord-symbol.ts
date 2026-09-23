// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
export type ParsedChordSymbol =
  | {
      kind: "repeat";
      text: "/";
    }
  | {
      kind: "chord";
      text: string;
      root: string;
      suffix: string;
      bass?: string;
    };