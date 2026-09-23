// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import { extractChordLineMarkers } from "./parser/extractor/extractChordLineMarkers";
import { alignLines } from "./parser/pairer/lineAligner";
import type { BarLine } from "./parser/types";
import { generateBarList } from "./renderer/generateBarList";
import type { PreparedSong, ViewMode } from "./preparedTypes";
import type { ParsedTab, ParsedTabSection } from "./types";

const DEFAULT_BEAT = 4;

function sectionToBarLines(section: ParsedTabSection, beat: number): BarLine[] {
  const bars: BarLine[] = [];

  for (let lineIndex = 0; lineIndex < section.lines.length; lineIndex += 1) {
    const line = section.lines[lineIndex];
    if (line.kind === "section-header" || line.kind === "blank") {
      continue;
    }

    if (line.kind === "chords") {
      const nextLine = section.lines[lineIndex + 1];
      const lyricText = nextLine?.kind === "lyrics" ? nextLine.text : "";
      const aligned = alignLines({
        chordsText: line.text,
        liricsText: lyricText,
      });

      bars.push({
        ...aligned,
        chordLineMarkers: extractChordLineMarkers(line, beat),
      });

      if (nextLine?.kind === "lyrics") {
        lineIndex += 1;
      }
      continue;
    }

    if (line.kind === "lyrics") {
      bars.push(
        alignLines({
          chordsText: "",
          liricsText: line.text,
        }),
      );
    }
  }

  return bars;
}

export function prepareSongFromParsedTab(
  parsed: ParsedTab,
  options: { viewMode?: ViewMode; beat?: number } = {},
): PreparedSong {
  const viewMode = options.viewMode ?? "e";
  const beat = options.beat ?? DEFAULT_BEAT;
  const barSuffix = viewMode === "o" ? "\n" : ". . ";

  const sectionTexts = parsed.sections.map((section) => ({
    title: section.title,
    content: null,
    lines: sectionToBarLines(section, beat),
  }));

  const sectionsBarList = generateBarList({
    sectionTexts,
    barSuffix,
  });

  return {
    body: parsed.body,
    sections: sectionsBarList.map((section) => ({
      title: section.title,
      barList: section.barList,
    })),
  };
}
