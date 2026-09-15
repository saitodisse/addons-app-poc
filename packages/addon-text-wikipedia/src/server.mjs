import { createAddonServer, createTrafficRecorder } from '@addons/addon-server';
import { manifest } from './manifest.js';
import { catalog, search, text, content, contentJson } from './handlers.js';
import { createWikipediaApi, normalizeWikipediaLanguage } from './api.js';

const port = Number(process.env.PORT ?? 5294);
const traffic = createTrafficRecorder({
  maxEntries: 100,
});
const apis = new Map();

function apiForLanguage(value) {
  const language = normalizeWikipediaLanguage(value);
  const cached = apis.get(language);
  if (cached) return cached;
  const created = createWikipediaApi({ lang: language, onTraffic: (event) => traffic.record(event) });
  apis.set(language, created);
  return created;
}

const server = await createAddonServer({
  manifest,
  port,
  name: manifest.id,
  onTraffic: (event) => traffic.record(event),
  handlers: {
    catalog: (type, catalogId, page) => catalog(type, catalogId, page, apiForLanguage(page?.lang)),
    search: (type, query, page) => search(type, query, page, apiForLanguage(page?.lang)),
    text: (type, id, options) => text(type, id, apiForLanguage(options?.lang)),
    content: (type, id, options) => content(type, id, apiForLanguage(options?.lang)),
    contentJson: (type, id, options) => contentJson(type, id, apiForLanguage(options?.lang)),
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
