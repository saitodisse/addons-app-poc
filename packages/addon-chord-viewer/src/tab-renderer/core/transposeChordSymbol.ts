// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import { parseChordSymbol } from "./parser/parseChordSymbol";
import type { ParsedChordSymbol } from "./types";

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "B#": 0,
  Db: 1,
  "C#": 1,
  D: 2,
  Eb: 3,
  "D#": 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  Gb: 6,
  "F#": 6,
  G: 7,
  Ab: 8,
  "G#": 8,
  A: 9,
  Bb: 10,
  "A#": 10,
  B: 11,
  Cb: 11,
};

const SEMITONES_TO_FLAT_NOTE = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

function normalizeNoteName(note: string): string {
  return note.replace("♯", "#").replace("♭", "b");
}

function noteToSemitone(note: string): number | null {
  const normalized = normalizeNoteName(note);
  return NOTE_TO_SEMITONE[normalized] ?? null;
}

function transposeNote(note: string, semitones: number): string | null {
  const semitone = noteToSemitone(note);
  if (semitone === null) {
    return null;
  }

  const shifted = (semitone + semitones) % 12;
  const normalizedShift = shifted < 0 ? shifted + 12 : shifted;
  return SEMITONES_TO_FLAT_NOTE[normalizedShift] ?? null;
}

function transposeParsedChordSymbol(
  symbol: ParsedChordSymbol,
  semitones: number,
): string {
  if (symbol.kind === "repeat") {
    return symbol.text;
  }

  const root = transposeNote(symbol.root, semitones);
  if (root === null) {
    return symbol.text;
  }

  const bass =
    symbol.bass === undefined
      ? undefined
      : transposeNote(symbol.bass, semitones);
  if (symbol.bass !== undefined && bass === null) {
    return symbol.text;
  }

  return `${root}${symbol.suffix}${bass === undefined ? "" : `/${bass}`}`;
}

export function transposeChordSymbol(
  symbol: string,
  semitones: number,
): string {
  const parsed = parseChordSymbol(symbol);
  if (!parsed) {
    return symbol;
  }

  return transposeParsedChordSymbol(parsed, semitones);
}
