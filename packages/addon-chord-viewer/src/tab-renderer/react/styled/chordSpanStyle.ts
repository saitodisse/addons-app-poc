// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { CSSProperties } from "react";
import type { TabStyleConfig } from "../../core/preparedTypes";

export function getChordSpanStyle({
  chordText,
  isNoLyricsLine,
  style,
}: {
  chordText: string;
  isNoLyricsLine?: boolean;
  style: TabStyleConfig;
}): CSSProperties {
  const marginRight = chordText.length * style.blockMarginRight;
  const offsetBottomRem = isNoLyricsLine
    ? style.fontSize * style.chordHeight - 1
    : style.fontSize * style.chordHeight;

  return {
    fontWeight: "bold",
    color: style.chordColor,
    opacity: 0.85,
    backgroundColor: "transparent",
    position: "relative",
    bottom: `${offsetBottomRem}rem`,
    marginRight: `-${marginRight}em`,
  };
}