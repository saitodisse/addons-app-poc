// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { ParsedTab, ParsedTabLine, ParsedTabSection, ParsedTabToken } from "../core";
import type { TabStyleConfig } from "../core/preparedTypes";
import type { ReactNode } from "react";

export type {
  TabStyleConfig,
  ViewMode,
  DisplayMode,
} from "../core/preparedTypes";

export type TabRootProps = {
  song: ParsedTab;
  children?: ReactNode;
  className?: string;
};

export type TabSectionProps = {
  section: ParsedTabSection;
  index: number;
  children?: ReactNode;
  className?: string;
};

export type TabLineProps = {
  line: ParsedTabLine;
  index: number;
  children?: ReactNode;
  className?: string;
};

export type TabTokenProps = {
  token: ParsedTabToken;
  className?: string;
};

export type TabProps = {
  body: string;
  className?: string;
  style?: Partial<TabStyleConfig>;
};