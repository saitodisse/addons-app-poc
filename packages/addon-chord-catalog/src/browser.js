import { manifest } from './manifest.js';
import { CHARTS } from './data/charts.js';
import { listCatalog, searchCharts, paginate } from './catalog.js';
import { toMeta, toContentJson, toTextOption } from './payloads-core.js';
import { createLibraryStore } from './library-store.js';
import { sha256, sourceLines, updateSources } from './source-import.js';

export { manifest };
const SETTINGS_KEY = 'addons:state:chord-catalog:settings:v1';
const FIELDS = [
  { id: 'sources', label: 'Source catalogue URLs (one per line)', type: 'textarea', group: 'Settings', placeholder: 'https://example.com/source-catalog/' },
  { id: 'deleteSource', label: 'Downloaded source to delete (root URL)', type: 'url', group: 'Settings', placeholder: 'https://example.com/source-catalog/' },
];
const ACTIONS = [
  { id: 'update', label: 'Update catalogue', group: 'Settings', receives: ['sources'] },
  { id: 'delete', label: 'Delete downloaded source', variant: 'danger', group: 'Settings', receives: ['deleteSource'] },
];
let library;
let baseUrl;
let hostOrigin;
let demoCharts;

function settings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'); } catch { return {}; }
}

export async function setup(host) {
  library = createLibraryStore();
  await library.list();
  baseUrl = new URL('.', import.meta.url).href;
  hostOrigin = location.origin;
  demoCharts = await Promise.all(CHARTS.map(async (chart) => ({ ...chart, checksum: await sha256(chart.text) })));
  host.registerService('host.resource-client', { request });
}

function contentPayload(chart) {
  const payload = toContentJson(chart, { baseUrl, checksum: chart.checksum });
  if (chart.sourceRoot) {
    payload.source = { name: chart.sourceName, provider: manifest.id, origin: new URL(chart.sourceRoot).origin, url: chart.sourceRoot };
    if (chart.tuningId !== 'guitar-standard') delete payload.notation.tuning;
    payload.playableVersion.label = chart.versionLabel ?? 'Imported version';
    payload.chordChart.instrumentId = chart.instrumentId;
    payload.chordChart.tuningId = chart.tuningId;
  }
  return payload;
}

/** Serves the same resource routes from the device, without consulting HTTP. */
export async function request({ url }) {
  const parsed = new URL(url);
  const base = new URL(baseUrl);
  if (parsed.origin !== base.origin || !parsed.pathname.startsWith(base.pathname)) return undefined;
  const path = parsed.pathname.slice(base.pathname.length);
  const match = /^(text)\/chart\/([^/]+)\/content\.(json|txt)$/.exec(path) ?? /^(catalog|search|text)\/chart\/([^/]+)\.json$/.exec(path);
  if (!match) return undefined;
  const [, resource, encodedId, extension] = match;
  const id = decodeURIComponent(encodedId);
  const charts = [...demoCharts, ...(await library.list()).flatMap((source) => source.charts)];
  let body;
  let contentType = 'application/json';
  if (resource === 'search' || resource === 'catalog') {
    const { items, pagination } = paginate(resource === 'search' ? searchCharts(charts, id) : listCatalog(charts, id), {
      limit: parsed.searchParams.get('limit') ? Number(parsed.searchParams.get('limit')) : undefined,
      cursor: parsed.searchParams.get('cursor') ?? undefined,
    });
    body = JSON.stringify({ metas: items.map((chart) => toMeta(chart, baseUrl)), pagination });
  } else {
    const chart = charts.find((chart) => chart.id === id);
    if (!chart) return { status: 404, contentType, body: JSON.stringify({ error: 'Chart not found' }) };
    if (extension === 'txt') { body = chart.text; contentType = 'text/plain'; }
    else body = JSON.stringify(extension === 'json' ? contentPayload(chart) : { texts: [toTextOption(chart, baseUrl)] });
  }
  return { status: 200, contentType, body };
}

export function createTab() {
  return {
    title: manifest.contract.ui.title, body: manifest.contract.ui.body,
    fields: FIELDS, actions: ACTIONS,
    persistence: {
      load: async () => ({ values: settings() }),
      save: async ({ values }) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(values)),
    },
    getSnapshot: async () => {
      const sources = await library.list();
      return { status: 'info', body: `${sources.reduce((total, source) => total + source.charts.length, 0)} downloaded charts. Removing a URL stops updates and keeps downloaded charts.`,
        items: sources.map((source) => ({ label: source.name, value: `${source.root} · ${source.charts.length} charts · ${source.importedAt}` })) };
    },
    async run(actionId, values) {
      if (actionId === 'delete') {
        const candidates = sourceLines(values.deleteSource ?? '');
        if (candidates.length !== 1 || candidates[0].error) throw new Error('Enter one valid downloaded source root to delete.');
        await library.remove(candidates[0].root);
        return { status: 'success', body: `Downloaded charts deleted: ${candidates[0].root}` };
      }
      if (actionId !== 'update') throw new Error('Unknown catalogue action.');
      // Save the list before downloading, even if every source fails.
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings(), sources: values.sources ?? '' }));
      const results = await updateSources(values.sources ?? '', library);
      const failed = results.filter((result) => result.error);
      let offline = '';
      try {
        const ready = await prepareOffline();
        offline = ready ? '\nOffline application ready on this device.' : '\nOffline application requires a production build; chart data is stored on this device.';
      } catch (error) { offline = `\nCharts saved, but offline application preparation failed: ${error.message}`; }
      return { status: failed.length ? 'error' : 'success', body: (results.length ? results.map((result) => `${result.root}: ${result.error ? `failed (${result.error}); previous charts kept` : `${result.count} charts downloaded`}`).join('\n') : 'No source URLs configured.') + offline };
    },
  };
}

async function prepareOffline() {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration(`${hostOrigin}/`);
  const worker = registration?.active;
  if (!worker) return false;
  // Ask the generic host worker to retain all installed manifests and bundles,
  // including add-ons the person has not opened before going offline.
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error('Offline preparation timed out.')), 30000);
    channel.port1.onmessage = ({ data }) => { clearTimeout(timer); channel.port1.close(); data.error ? reject(new Error(data.error)) : resolve(true); };
    worker.postMessage({ type: 'prepare-installed-addons' }, [channel.port2]);
  });
}
