const INSTALLATIONS_KEY = 'addons:host-installations:v1';

/** Offline caches contain only installed add-on manifests and executable bundles. */
export async function retainInstalledAddons(urls: string[]): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    const worker = registration.active ?? registration.installing ?? registration.waiting;
    if (!worker) throw new Error('Service worker is unavailable.');
    if (worker.state !== 'activated') {
      await new Promise<void>((resolve, reject) => {
        const onStateChange = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') {
            worker.removeEventListener('statechange', onStateChange);
            worker.state === 'activated' ? resolve() : reject(new Error('Service worker activation failed.'));
          }
        };
        worker.addEventListener('statechange', onStateChange);
        onStateChange();
      });
    }
    worker.postMessage({ type: 'installed-addons', urls });
  } catch (error) { console.warn('Offline application preparation failed', error); }
}

export async function registerOfflineApplication(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  try {
    const settings = JSON.parse(localStorage.getItem(INSTALLATIONS_KEY) ?? '{}');
    await retainInstalledAddons(Array.isArray(settings.manifestUrls) ? settings.manifestUrls : []);
  } catch (error) { console.warn('Offline application preparation failed', error); }
}
