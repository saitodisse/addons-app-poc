import type { AddonInstance } from '@addons-poc/protocol';
import { AddonControlPanel } from './AddonControlPanel';
import { AddonResponseView } from './AddonResponseView';
import { useAddonTab } from './useAddonTab';

interface AddonTabViewProps {
  addon: AddonInstance;
}

/**
 * The add-on interface: a fixed control panel beside the response.
 *
 * Controls stay visible while the response scrolls, the way the viewer of the
 * AC application keeps its dial panel next to the chart.
 */
export function AddonTabView({ addon }: AddonTabViewProps) {
  const tab = addon.ui;
  const controller = useAddonTab(addon);

  if (!tab) return null;

  return (
    <div className="host-tab-layout">
      <section className="host-tab-content" aria-label={tab.title}>
        <h3 className="host-tab-title">{tab.title}</h3>
        <p className="host-tab-body">{tab.body}</p>
        <AddonResponseView addon={addon} response={controller.response} />
      </section>

      <AddonControlPanel addon={addon} controller={controller} />
    </div>
  );
}
