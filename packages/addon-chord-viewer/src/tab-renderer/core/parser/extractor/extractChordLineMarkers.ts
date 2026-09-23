// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { ParsedTabLine } from "../../types";
import type { ChordLineMarker } from "../types";
import { tokenizeRawLine } from "../tokenizeRawLine";
import { parseChord } from "./parseChord";

function markersFromChordLine(
  tokens: Array<{
    kind: "ChordToken" | "DecorationToken";
    text: string;
    startColumn: number;
    endColumn: number;
  }>,
  beat: number,
): ChordLineMarker[] {
  if (tokens.length === 0) {
    return [
      {
        kind: "chord",
        position: 0,
        textLength: 0,
        beatType: "week",
        simpleChord: null,
      },
    ];
  }

  let chordIndex = 0;
  const markers: ChordLineMarker[] = [];

  for (const token of tokens) {
    if (token.kind === "DecorationToken") {
      markers.push({
        kind: "decoration",
        position: token.startColumn,
        text: token.text,
      });
      continue;
    }

    markers.push({
      kind: "chord",
      position: token.startColumn,
      textLength: token.endColumn - token.startColumn,
      beatType: chordIndex % beat === 0 ? "strong" : "week",
      simpleChord: parseChord({ chordText: token.text }),
    });
    chordIndex += 1;
  }

  return markers.sort((left, right) => left.position - right.position);
}

/** Column-ordered chord and decoration markers from a strict-parser chord line. */
export function extractChordLineMarkers(
  chordLine: ParsedTabLine,
  beat: number,
): ChordLineMarker[] {
  const tokens = chordLine.tokens
    .filter(
      (token) =>
        token.kind === "ChordToken" || token.kind === "DecorationToken",
    )
    .map((token) => ({
      kind: token.kind as "ChordToken" | "DecorationToken",
      text: token.text,
      startColumn: token.startColumn,
      endColumn: token.endColumn,
    }));

  return markersFromChordLine(tokens, beat);
}

export function extractChordLineMarkersFromText(
  chordsText: string,
  beat: number,
): ChordLineMarker[] {
  if (!chordsText.trim()) {
    return [
      {
        kind: "chord",
        position: 0,
        textLength: 0,
        beatType: "week",
        simpleChord: null,
      },
    ];
  }

  const tokens = tokenizeRawLine(chordsText)
    .filter(
      (token) =>
        token.kind === "ChordToken" || token.kind === "DecorationToken",
    )
    .map((token) => ({
      kind: token.kind as "ChordToken" | "DecorationToken",
      text: token.text,
      startColumn: token.startColumn,
      endColumn: token.endColumn,
    }));

  return markersFromChordLine(tokens, beat);
}

export function markerToChordItem(
  marker: Extract<ChordLineMarker, { kind: "chord" }>,
) {
  return {
    chordPosition: marker.position,
    chordTextLength: marker.textLength,
    beatType: marker.beatType,
    simpleChord: marker.simpleChord,
  };
}
