// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { SimpleChord } from "../types";

export const REGEX_IS_REAL_CHORD =
  /(([A-G][b♭♯#]?|[\\/])((m|M|maj|min|major|minor|aug|dim|sus|add|b|#)|[A-G0-9(),/\-+°º♭♯#Majmsu]+)*)/g;

const REGEX_BASS_NOTE = /[/]([A-G][b♭♯#]?)/g;

const REGEX_CHORD_AND_COMPLEMENT = /\b([A-G][b♭♯#]?)(\S+)?/g;

export function parseChord({ chordText }: { chordText: string }): SimpleChord {
  if (!chordText) {
    return {
      original: chordText,
      rootNote: null,
      quality: null,
      bassNote: null,
    };
  }

  if (chordText === "/") {
    return {
      original: chordText,
      rootNote: "/",
      quality: null,
      bassNote: null,
    };
  }

  const matchBassNote = new RegExp(
    REGEX_BASS_NOTE.source,
    REGEX_BASS_NOTE.flags,
  ).exec(chordText);

  let chordWithoutBassText = chordText;
  let chordBass: string | null = null;
  if (matchBassNote && matchBassNote.length === 2) {
    chordBass = matchBassNote[1];
    chordWithoutBassText = chordText.replace(
      new RegExp(REGEX_BASS_NOTE.source, REGEX_BASS_NOTE.flags),
      "",
    );
  }

  const matchChordAndComplement = new RegExp(
    REGEX_CHORD_AND_COMPLEMENT.source,
    REGEX_CHORD_AND_COMPLEMENT.flags,
  ).exec(chordWithoutBassText);

  if (!matchChordAndComplement) {
    return {
      original: chordText,
      rootNote: null,
      quality: null,
      bassNote: null,
    };
  }

  return {
    original: chordText,
    rootNote: matchChordAndComplement[1],
    quality: matchChordAndComplement[2] || null,
    bassNote: chordBass,
  };
}
