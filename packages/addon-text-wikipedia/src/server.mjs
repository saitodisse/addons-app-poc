import { createAddonServer, createTrafficRecorder } from '@addons/addon-server';
import { manifest } from './manifest.js';
import { catalog, search, text, content, contentJson } from './handlers.js';
import { createWikipediaApi } from './api.js';

const port = Number(process.env.PORT ?? 5294);
const traffic = createTrafficRecorder({
  maxEntries: 100,
  onRecord: (event) => console.log(`[${manifest.id}:http] ${JSON.stringify(event)}`),
});
const api = createWikipediaApi({ onTraffic: (event) => traffic.record(event) });

const server = await createAddonServer({
  manifest,
  port,
  name: manifest.id,
  onTraffic: (event) => traffic.record(event),
  handlers: {
    catalog: (type, catalogId, page) => catalog(type, catalogId, page, api),
    search: (type, query, page) => search(type, query, page, api),
    text: (type, id) => text(type, id, api),
    content: (type, id) => content(type, id, api),
    contentJson: (type, id) => contentJson(type, id, api),
    debugTraffic: () => ({
      addon: manifest.id,
      generatedAt: new Date().toISOString(),
      retainedEntries: traffic.snapshot().length,
      maxEntries: traffic.maxEntries,
      entries: traffic.snapshot(),
    }),
  },
});

console.log(`[${manifest.name}] ouvindo em ${server.url}`);
console.log(`[${manifest.name}] manifesto: ${server.manifestUrl}`);
console.log(`[${manifest.name}] tráfego: ${server.url}/debug/traffic.json`);
