// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type {
  BarsList,
  ChordItem,
  ChordLineMarker,
  SectionBarList,
  SectionText,
} from "../parser/types";
import { markerToChordItem } from "../parser/extractor/extractChordLineMarkers";

function chordItemFromMarker(
  marker: Extract<ChordLineMarker, { kind: "chord" }>,
): ChordItem {
  return markerToChordItem(marker);
}

function appendBarSuffix(
  prev: BarsList,
  barLine: { liricsTextBar?: string },
  barSuffix: string,
  isNoLyricsLine: boolean,
): void {
  const finalBarSuffix = isNoLyricsLine
    ? barSuffix.replace(/\./g, " ")
    : barSuffix;
  prev.push({
    liricPart: finalBarSuffix,
    isSpace: true,
    isNoLyricsLine,
  });
}

function interleaveMarkers({
  markers,
  liricsText,
  isNoLyricsLine,
  barSuffix,
}: {
  markers: ChordLineMarker[];
  liricsText?: string;
  isNoLyricsLine: boolean;
  barSuffix: string;
}): BarsList {
  const parts: BarsList = [];
  let lastIndex = 0;

  markers.forEach((marker, markerIndex) => {
    parts.push({
      liricPart: liricsText?.substring(lastIndex, marker.position),
      isNoLyricsLine,
    });

    if (marker.kind === "decoration") {
      parts.push({
        decorationText: marker.text,
        isChordLineDecoration: true,
        isNoLyricsLine,
      });
    } else {
      parts.push({
        chordItem: chordItemFromMarker(marker),
        isNoLyricsLine,
      });
    }

    lastIndex = marker.position;

    const isLastMarker = markerIndex === markers.length - 1;
    if (isLastMarker) {
      parts.push({
        liricPart: liricsText?.substring(
          lastIndex,
          (liricsText?.length ?? 0) + barSuffix.length,
        ),
        isNoLyricsLine,
      });
      appendBarSuffix(
        parts,
        { liricsTextBar: liricsText },
        barSuffix,
        isNoLyricsLine,
      );
    }
  });

  return parts;
}

function interleaveLegacyChords({
  chordsList,
  liricsText,
  isNoLyricsLine,
  barSuffix,
}: {
  chordsList: ChordItem[];
  liricsText?: string;
  isNoLyricsLine: boolean;
  barSuffix: string;
}): BarsList {
  let lastIndex = 0;

  return chordsList.reduce<BarsList>((prev, currentChordItem, chordIndex) => {
    prev.push({
      liricPart: liricsText?.substring(
        chordIndex === 0 ? 0 : lastIndex,
        currentChordItem.chordPosition,
      ),
      isNoLyricsLine,
    });

    if (currentChordItem.chordLinePrefix) {
      prev.push({
        liricPart: currentChordItem.chordLinePrefix,
        isChordLinePrefix: true,
        isNoLyricsLine,
      });
    }

    prev.push({
      chordItem: currentChordItem,
      isNoLyricsLine,
    });

    lastIndex = currentChordItem.chordPosition ?? 0;

    const isLastChord = chordIndex === chordsList.length - 1;
    if (isLastChord) {
      prev.push({
        liricPart: liricsText?.substring(
          lastIndex,
          (liricsText?.length ?? 0) + barSuffix.length,
        ),
        isNoLyricsLine,
      });
      appendBarSuffix(
        prev,
        { liricsTextBar: liricsText },
        barSuffix,
        isNoLyricsLine,
      );
    }

    return prev;
  }, []);
}

export function generateBarList({
  sectionTexts,
  barSuffix = "",
}: {
  sectionTexts: SectionText[];
  barSuffix?: string;
}): SectionBarList[] {
  return sectionTexts.map((sectionText) => {
    const lines = sectionText?.lines?.reduce<BarsList>(
      (finalArray, barLine) => {
        if (!barLine.chordsList && !barLine.chordLineMarkers) {
          finalArray.push({ isSpace: true });
          return finalArray;
        }

        const isNoLyricsLine =
          !barLine.liricsTextBar || !barLine.liricsTextBar.trim();

        const markers = barLine.chordLineMarkers;
        const chordsList = barLine.chordsList ?? [];

        if (markers && markers.length > 0) {
          finalArray.push(
            ...interleaveMarkers({
              markers,
              liricsText: barLine.liricsTextBar,
              isNoLyricsLine,
              barSuffix,
            }),
          );
          return finalArray;
        }

        if (chordsList.length === 0) {
          finalArray.push({
            liricPart: barLine.liricsTextBar,
            isNoLyricsLine,
          });
          appendBarSuffix(finalArray, barLine, barSuffix, isNoLyricsLine);
          return finalArray;
        }

        finalArray.push(
          ...interleaveLegacyChords({
            chordsList,
            liricsText: barLine.liricsTextBar,
            isNoLyricsLine,
            barSuffix,
          }),
        );
        return finalArray;
      },
      [],
    );

    return {
      content: sectionText.content,
      title: sectionText.title,
      barList: lines?.flat() ?? [],
    };
  });
}
