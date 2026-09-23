// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import { isValidElement, type ReactNode } from "react";
import { chordToText } from "../../core/transposer/chordToText";
import type { BarsListItem, PreparedSection } from "../../core/preparedTypes";
import type { TabStyleConfig } from "../../core/preparedTypes";
import { getChordSpanStyle } from "./chordSpanStyle";

export type TabSectionNodes = {
  title: string | null;
  nodes: ReactNode[];
};

export function buildTabNodes(
  sections: PreparedSection[],
  style: TabStyleConfig,
): TabSectionNodes[] {
  return sections.map((section) => {
    const nodes = section.barList.reduce<ReactNode[]>((prev, curr, index) => {
      appendBarItem(prev, curr, index, style);
      return prev;
    }, []);

    return { title: section.title, nodes };
  });
}

function appendBarItem(
  prev: ReactNode[],
  curr: BarsListItem,
  index: number,
  style: TabStyleConfig,
) {
  if (curr.isChordLineDecoration && curr.decorationText) {
    if (style.displayMode === "lyrics") {
      return;
    }

    const decorationStyles = getChordSpanStyle({
      chordText: curr.decorationText,
      isNoLyricsLine: curr.isNoLyricsLine,
      style,
    });

    prev.push(
      <span
        key={`chord_decoration_${index}`}
        data-nolyricsline={curr.isNoLyricsLine || undefined}
        data-chord-line-decoration=""
      >
        <span
          style={{
            ...decorationStyles,
            fontWeight: "normal",
            color: style.lyricColor,
            opacity: 0.75,
          }}
        >
          {curr.decorationText}
        </span>
      </span>,
    );
    return;
  }

  if (curr.liricPart && !curr.isSpace && curr.isChordLinePrefix) {
    if (style.displayMode === "lyrics") {
      return;
    }

    for (const [charIndex, character] of [...curr.liricPart].entries()) {
      const prefixStyles = getChordSpanStyle({
        chordText: character,
        isNoLyricsLine: curr.isNoLyricsLine,
        style,
      });

      prev.push(
        <span
          key={`chord_prefix_${index}_${charIndex}`}
          data-nolyricsline={curr.isNoLyricsLine || undefined}
          data-chord-line-prefix=""
        >
          <span
            style={{
              ...prefixStyles,
              fontWeight: "normal",
              color: style.lyricColor,
              opacity: 0.75,
            }}
          >
            {character}
          </span>
        </span>,
      );
    }
    return;
  }

  if (curr.liricPart && !curr.isSpace) {
    if (style.displayMode === "chords") {
      return;
    }
    prev.push(
      <span
        key={`lyric_${index}`}
        data-nolyricsline={curr.isNoLyricsLine || undefined}
      >
        {curr.liricPart}
      </span>,
    );
    return;
  }

  if (curr.liricPart && curr.isSpace) {
    if (style.displayMode === "chords") {
      return;
    }
    prev.push(
      <span
        key={`space_${index}`}
        style={{ opacity: 0.2 }}
        data-nolyricsline={curr.isNoLyricsLine || undefined}
      >
        {curr.liricPart}
      </span>,
    );
    return;
  }

  if (curr.chordItem) {
    const chordText = chordToText(curr.chordItem.simpleChord);
    if (style.displayMode === "lyrics" || chordText === "/") {
      return;
    }

    const chordStyles = getChordSpanStyle({
      chordText,
      isNoLyricsLine: curr.isNoLyricsLine,
      style,
    });

    prev.push(
      <span
        key={`chord_wrapper_${index}`}
        data-nolyricsline={curr.isNoLyricsLine || undefined}
      >
        <span style={chordStyles}>{chordText}</span>
      </span>,
    );
  }
}

export function nodeIsNoLyricsLine(item: ReactNode): boolean {
  if (!isValidElement(item)) {
    return false;
  }
  return Boolean((item.props as Record<string, unknown>)["data-nolyricsline"]);
}