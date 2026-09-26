import { readFile } from 'node:fs/promises';
import { createAddonServer, createTrafficRecorder } from '@addons/addon-server';
import { manifest } from './manifest.js';
import { catalog, content, contentJson, search, text } from './handlers.js';

const port = Number(process.env.PORT ?? 5295);
const traffic = createTrafficRecorder({ maxEntries: 100 });
const artistSlugs = ['clara-fonseca', 'mare-alta', 'the-ridge-line', 'vela-nova'];
const assets = Object.fromEntries(await Promise.all(artistSlugs.map(async (slug) => [
  `/artists/${slug}.png`,
  { body: await readFile(new URL(`../assets/artists/${slug}.png`, import.meta.url)), contentType: 'image/png' },
])));

const server = await createAddonServer({
  manifest,
  port,
  name: manifest.id,
  assets,
  onTraffic: (event) => traffic.record(event),
  handlers: {
    catalog: (type, catalogId, page) => catalog(type, catalogId, page, { baseUrl: server.url }),
    search: (type, query, page) => search(type, query, page, { baseUrl: server.url }),
    text: (type, id, options) => text(type, id, options, { baseUrl: server.url }),
    content: (type, id, options) => content(type, id, options),
    contentJson: (type, id, options) => contentJson(type, id, options, {
      baseUrl: server.url,
      requestId: () => `${manifest.id}-${Date.now()}`,
    }),
    debugTraffic: () => ({
      addon: manifest.id,
      generatedAt: new Date().toISOString(),
      retainedEntries: traffic.snapshot().length,
      maxEntries: traffic.maxEntries,
      entries: traffic.snapshot(),
    }),
  },
});

console.log(`[${manifest.name}] listening at ${server.url}`);
console.log(`[${manifest.name}] manifest: ${server.manifestUrl}`);
console.log(`[${manifest.name}] traffic: ${server.url}/debug/traffic.json`);
