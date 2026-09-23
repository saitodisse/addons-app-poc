// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.
import type { TabRootProps } from "./types";

export function TabRoot({ children, className }: TabRootProps) {
	return (
		<div className={className} data-tab-root>
			{children}
		</div>
	);
}