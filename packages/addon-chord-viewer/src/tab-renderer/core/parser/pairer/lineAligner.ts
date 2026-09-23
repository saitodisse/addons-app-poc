// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { BarLine } from "../types";

export function alignLines({
  chordsText: chordsTextBar,
  liricsText: liricsTextBar,
}: {
  chordsText: string;
  liricsText: string;
}): BarLine {
  const chordsTextSpacesOnStart = chordsTextBar?.match(/^(\s+)/)?.[0] || "";
  const liricsTextSpacesOnStart = liricsTextBar?.match(/^(\s+)/)?.[0] || "";
  const spacesOnStartToRemove = Math.min(
    chordsTextSpacesOnStart.length,
    liricsTextSpacesOnStart.length,
  );
  chordsTextBar = chordsTextBar?.substring(spacesOnStartToRemove);
  liricsTextBar = liricsTextBar?.substring(spacesOnStartToRemove);

  if (chordsTextBar.length < liricsTextBar?.length) {
    chordsTextBar = chordsTextBar.padEnd(liricsTextBar?.length);
  } else if (chordsTextBar.length > liricsTextBar?.length) {
    liricsTextBar = liricsTextBar.padEnd(chordsTextBar.length);
  }

  const chordsTextSpacesOnEnd = chordsTextBar?.match(/(\s+)$/)?.[0] || "";
  const liricsTextSpacesOnEnd = liricsTextBar?.match(/(\s+)$/)?.[0] || "";
  const spacesOnEndToRemove = Math.min(
    chordsTextSpacesOnEnd.length,
    liricsTextSpacesOnEnd.length,
  );
  if (spacesOnEndToRemove > 0) {
    const shorter = Math.min(chordsTextBar.length, liricsTextBar?.length);
    chordsTextBar = chordsTextBar?.substring(0, shorter - spacesOnEndToRemove);
    liricsTextBar = liricsTextBar?.substring(0, shorter - spacesOnEndToRemove);
  }

  return {
    chordsTextBar,
    liricsTextBar,
  };
}
