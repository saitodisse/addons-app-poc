// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { SimpleChord } from "../parser/types";

export function chordToText(simpleChord: SimpleChord | null): string {
  if (!simpleChord) {
    return "";
  }

  if (!simpleChord.rootNote) {
    return simpleChord.original;
  }

  return `${simpleChord.rootNote}${simpleChord.quality || ""}${
    (simpleChord.bassNote && `/${simpleChord.bassNote}`) || ""
  }`;
}
