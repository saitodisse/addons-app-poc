const INSTALLATIONS_KEY = 'addons:host-installations:v1';

/** Offline caches contain only installed add-on manifests and executable bundles. */
export async function retainInstalledAddons(urls: string[]): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'installed-addons', urls });
}

export async function registerOfflineApplication(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
    const settings = JSON.parse(localStorage.getItem(INSTALLATIONS_KEY) ?? '{}');
    await retainInstalledAddons(Array.isArray(settings.manifestUrls) ? settings.manifestUrls : []);
  } catch (error) { console.warn('Offline application preparation failed', error); }
}
