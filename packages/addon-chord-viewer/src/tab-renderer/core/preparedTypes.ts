// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { BarsList, BarsListItem } from "./parser/types";

export type { BarsListItem, ChordItem, SimpleChord } from "./parser/types";

/** Alias for interleaved render segments (Achordex bar list items). */
export type BarSegment = BarsListItem;

export type PreparedSection = {
  title: string | null;
  barList: BarsList;
};

export type PreparedSong = {
  body: string;
  sections: PreparedSection[];
};

export type ViewMode = "o" | "e";

export type DisplayMode = "chords" | "lyrics" | "both";

export type TabStyleConfig = {
  transposeNumber: number;
  fontSize: number;
  lineHeight: number;
  blockMarginRight: number;
  chordHeight: number;
  contentMarginRightPx: number;
  viewMode: ViewMode;
  displayMode: DisplayMode;
  chordColor: string;
  lyricColor: string;
  backgroundColor: string;
  sectionGap: number;
  sectionTitleColor: string;
  sectionTitleFontSize: number;
};

export type PrepareSongOptions = {
  body: string;
  transposeNumber?: number;
  viewMode?: ViewMode;
  beat?: number;
};

export const DEFAULT_TAB_STYLE: TabStyleConfig = {
  fontSize: 16,
  transposeNumber: 0,
  lineHeight: 0.18,
  blockMarginRight: 0.582,
  chordHeight: 0.07,
  chordColor: "#5884fe",
  lyricColor: "#d1dff5",
  backgroundColor: "#292623",
  viewMode: "e",
  displayMode: "both",
  contentMarginRightPx: 0,
  sectionGap: 24,
  sectionTitleColor: "#8899aa",
  sectionTitleFontSize: 14,
};

export function clampContentMarginRightPx(px: number): number {
  if (px <= 0) return 0;
  return Math.min(1000, Math.max(200, px));
}
