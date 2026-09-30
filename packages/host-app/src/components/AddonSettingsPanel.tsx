import type { AddonInstance } from '@addons-poc/protocol';
import { useAddonTab } from './useAddonTab';
import { AddonControlPanel } from './AddonControlPanel';

/** Settings is a declared control group, rendered without add-on domain knowledge. */
export function AddonSettingsPanel({ addon, onResourcesChanged }: { addon: AddonInstance; onResourcesChanged?: () => void }) {
  const controller = useAddonTab(addon, { onResponse: onResourcesChanged });
  const settings = { ...controller, sections: controller.sections.filter((section) => section.title === 'Settings') };
  return <div className="host-addon-settings" style={{ marginTop: 12 }}>
    {controller.ready ? <AddonControlPanel addon={addon} controller={settings} title={`Settings for ${addon.manifest.name}`} /> : <p role="status">Loading settings…</p>}
    {controller.response && <pre role={controller.response.status === 'error' ? 'alert' : 'status'} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{controller.response.body}{controller.response.items?.map((item) => `\n${item.label}: ${item.value}`).join('')}</pre>}
  </div>;
}
