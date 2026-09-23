import { CHARTS } from './data/charts.js';
import { findChart, listCatalog, paginate, searchCharts } from './catalog.js';
import { CHART_TYPE, contentPath, toContentJson, toMeta, toTextOption } from './payloads.js';

/** Default dependencies; tests replace them without touching the network. */
const DEFAULT_DEPENDENCIES = {
  charts: CHARTS,
  baseUrl: 'http://localhost:5295',
  now: () => new Date(),
  requestId: () => undefined,
};

function withDefaults(dependencies) {
  return { ...DEFAULT_DEPENDENCIES, ...(dependencies ?? {}) };
}

function chartNotFound(id) {
  const error = new Error(`Chart not found: ${id}`);
  error.status = 404;
  error.code = 'CHART_NOT_FOUND';
  return error;
}

function assertChart(charts, id) {
  const chart = findChart(charts, id);
  if (!chart) throw chartNotFound(id);
  return chart;
}

/** `GET /catalog/chart/<catalogId>.json` */
export async function catalog(type, catalogId, page, dependencies) {
  const { charts, baseUrl } = withDefaults(dependencies);
  if (type !== CHART_TYPE) return { metas: [] };
  const { items, pagination } = paginate(listCatalog(charts, catalogId), page);
  return { metas: items.map((chart) => toMeta(chart, baseUrl)), pagination };
}

/** `GET /search/chart/<query>.json` */
export async function search(type, query, page, dependencies) {
  const { charts, baseUrl } = withDefaults(dependencies);
  if (type !== CHART_TYPE) return { metas: [] };
  const { items, pagination } = paginate(searchCharts(charts, query), page);
  return { metas: items.map((chart) => toMeta(chart, baseUrl)), pagination };
}

/** `GET /text/chart/<id>.json` */
export async function text(type, id, options, dependencies) {
  const { charts, baseUrl } = withDefaults(dependencies);
  if (type !== CHART_TYPE) throw chartNotFound(id);
  const chart = assertChart(charts, id);
  return { texts: [toTextOption(chart, baseUrl)] };
}

/** `GET /text/chart/<id>/content.txt` */
export async function content(type, id, options, dependencies) {
  const { charts } = withDefaults(dependencies);
  if (type !== CHART_TYPE) throw chartNotFound(id);
  return assertChart(charts, id).text;
}

/** `GET /text/chart/<id>/content.json` */
export async function contentJson(type, id, options, dependencies) {
  const { charts, baseUrl, now, requestId } = withDefaults(dependencies);
  if (type !== CHART_TYPE) throw chartNotFound(id);
  const chart = assertChart(charts, id);
  return {
    body: toContentJson(chart, {
      baseUrl,
      requestId: requestId(),
      durationMs: 0,
      generatedAt: now().toISOString(),
    }),
  };
}

/** Absolute content URL of one chart, used by the traffic panel and the tests. */
export function chartContentUrl(baseUrl, id, extension = 'txt') {
  return new URL(contentPath({ id }, extension), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).href;
}