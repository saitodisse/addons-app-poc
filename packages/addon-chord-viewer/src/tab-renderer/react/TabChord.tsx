// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { TabTokenProps } from "./types";

export function TabChord({ token, className }: TabTokenProps) {
	return <span className={className}>{token.text}</span>;
}