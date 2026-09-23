// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { CSSProperties, ReactNode } from "react";
import {
  clampContentMarginRightPx,
  type TabStyleConfig,
} from "../../core/preparedTypes";

export type TabStyledContainerProps = {
  children: ReactNode;
  className?: string;
  style: TabStyleConfig;
};

export function TabStyledContainer({
  children,
  className,
  style,
}: TabStyledContainerProps) {
  const marginRightPx = clampContentMarginRightPx(style.contentMarginRightPx);

  const containerStyle: CSSProperties = {
    fontSize: `${style.fontSize}px`,
    paddingTop: `${style.fontSize - style.fontSize * style.lineHeight}px`,
    color: style.lyricColor,
    backgroundColor: style.backgroundColor,
    marginRight: marginRightPx > 0 ? `${marginRightPx}px` : undefined,
    whiteSpace: "pre-wrap",
    fontFamily:
      'var(--tab-mono, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace)',
  };

  return (
    <pre className={className} data-tab-root style={containerStyle}>
      {children}
    </pre>
  );
}