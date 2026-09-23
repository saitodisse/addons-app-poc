// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
/* eslint-disable react-refresh/only-export-components */
import { useMemo } from "react";
import { parseTab } from "../core/parseTab";
import { prepareSongFromParsedTab } from "../core/prepareSongFromParsedTab";
import { transposeParsedTab } from "../core/transposeParsedTab";
import { DEFAULT_TAB_STYLE, type TabStyleConfig } from "../core/preparedTypes";
import { TabRoot } from "./TabRoot";
import { TabSection } from "./TabSection";
import type { TabProps } from "./types";
import { buildTabNodes } from "./styled/buildTabNodes";
import { TabStyledContainer } from "./styled/TabStyledContainer";
import { TabStyledSection } from "./styled/TabStyledSection";

function mergeStyle(partial?: Partial<TabStyleConfig>): TabStyleConfig {
  return { ...DEFAULT_TAB_STYLE, ...partial };
}

function TabComponent({ body, className, style: stylePartial }: TabProps) {
  const style = mergeStyle(stylePartial);

  const sectionNodes = useMemo(() => {
    const parsed = parseTab(body);
    const transposed =
      style.transposeNumber === 0
        ? parsed
        : transposeParsedTab(parsed, style.transposeNumber);
    const prepared = prepareSongFromParsedTab(transposed, {
      viewMode: style.viewMode,
    });
    return buildTabNodes(prepared.sections, style);
  }, [body, style]);

  return (
    <TabStyledContainer className={className} style={style}>
      {sectionNodes.map((section, index) => (
        <TabStyledSection
          key={index}
          title={section.title}
          nodes={section.nodes}
          index={index}
          fontSize={style.fontSize}
          lineHeight={style.lineHeight}
          sectionGap={style.sectionGap}
          sectionTitleColor={style.sectionTitleColor}
          sectionTitleFontSize={style.sectionTitleFontSize}
        />
      ))}
    </TabStyledContainer>
  );
}

export const Tab = Object.assign(TabComponent, {
  Root: TabRoot,
  Section: TabSection,
});