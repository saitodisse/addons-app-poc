// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { ParsedChordSymbol } from "../types";

const CHORD_ROOT_RE = /^([A-G])([#b♯♭]?)(.*)$/;
const CHORD_BASS_RE = /^([A-G])([#b♯♭]?)$/;
/** Slash followed by an alteration figure (e.g. D7/9), not a bass note. */
const CHORD_SLASH_EXTENSION_RE = /^[#b♯♭]?\d[\w+°º♭♯#()-]*$/;

/**
 * Conventional chord suffix after the root (m7, maj7, 7/9, (13-)).
 * Rejects lyric tails such as the "u" in "Eu" or "e" in "De".
 */
const CHORD_SUFFIX_RE =
  /^(?:\([^)]*\))*(?:\/[#b♯♭]?\d[\w+°º♭♯#()-]*)?(?:mmaj|m(?![a-z])|M(?![a-z])|Maj|Min|maj|min|major|minor|dim|aug|sus|add|[#b°º+-]|\d)[\w+°º♭♯#)/(-]*$/;

function isValidChordSuffix(suffix: string): boolean {
  if (suffix.length === 0) {
    return true;
  }

  return CHORD_SUFFIX_RE.test(suffix);
}

function normalizeNoteName(note: string): string {
  return note.replace("♯", "#").replace("♭", "b");
}

function noteLooksValid(note: string): boolean {
  return /^[A-G][#b]?$/.test(note);
}

function isSlashExtension(segment: string): boolean {
  return CHORD_SLASH_EXTENSION_RE.test(segment);
}

export function parseChordSymbol(token: string): ParsedChordSymbol | null {
  if (token === "/") {
    return { kind: "repeat", text: token };
  }

  const parts = token.split("/");
  if (parts.length > 2) {
    return null;
  }

  const left = parts[0] ?? "";
  const rootMatch = left.match(CHORD_ROOT_RE);
  if (!rootMatch) {
    return null;
  }

  const root = normalizeNoteName(`${rootMatch[1]}${rootMatch[2] ?? ""}`);
  if (!noteLooksValid(root)) {
    return null;
  }

  let suffix = rootMatch[3] ?? "";
  let bass: string | undefined;

  if (parts.length === 2) {
    const right = parts[1] ?? "";
    const bassMatch = right.match(CHORD_BASS_RE);

    if (bassMatch) {
      bass = normalizeNoteName(`${bassMatch[1]}${bassMatch[2] ?? ""}`);
      if (!noteLooksValid(bass)) {
        return null;
      }
    } else if (isSlashExtension(right)) {
      suffix = `${suffix}/${right}`;
    } else {
      return null;
    }
  }

  if (!isValidChordSuffix(suffix)) {
    return null;
  }

  return bass === undefined
    ? {
        kind: "chord",
        text: token,
        root,
        suffix,
      }
    : {
        kind: "chord",
        text: token,
        root,
        suffix,
        bass,
      };
}
