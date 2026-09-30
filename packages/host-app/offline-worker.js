/* Build replaces the precache list and version with the application's assets. */
const SHELL = 'addons-poc-shell-__VERSION__';
const ADDONS = 'addons-poc-installed-bundles-v1';
const ASSETS = __PRECACHE__;
const META = new URL('/__offline-installed-addons', self.location.origin).href;
let preparation = Promise.resolve();

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('addons-poc-shell-') && key !== SHELL) await caches.delete(key);
    await self.clients.claim();
  })());
});

async function prepare(urls) {
  const cache = await caches.open(ADDONS);
  if (urls) await cache.put(META, new Response(JSON.stringify(urls)));
  else urls = await (await cache.match(META))?.json() ?? [];
  for (const url of urls) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not cache manifest: ${url}`);
    const manifest = await response.clone().json();
    if (manifest.entrypoint) {
      const entrypoint = new URL(manifest.entrypoint, url).href;
      const bundle = await fetch(entrypoint, { cache: 'no-store' });
      if (!bundle.ok) throw new Error(`Could not cache bundle: ${entrypoint}`);
      // Cache the matching executable before publishing its new manifest.
      await cache.put(entrypoint, bundle);
    }
    await cache.put(url, response);
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'installed-addons') {
    preparation = preparation.catch(() => {}).then(() => prepare(event.data.urls));
    event.waitUntil(preparation.catch(() => {}));
  }
  if (event.data?.type === 'prepare-installed-addons') {
    preparation = preparation.catch(() => {}).then(() => prepare());
    event.waitUntil(preparation.then(() => event.ports[0]?.postMessage({ ready: true }), (error) => event.ports[0]?.postMessage({ error: error.message })));
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  event.respondWith((async () => {
    if (url.origin === self.location.origin) {
      const shell = await caches.open(SHELL);
      const cached = await shell.match(event.request.mode === 'navigate' ? '/index.html' : event.request);
      if (cached) return cached;
    }
    const addons = await caches.open(ADDONS);
    const cached = await addons.match(event.request);
    try { return await fetch(event.request); }
    catch (error) { if (cached) return cached; throw error; }
  })());
});
