import { createWikipediaApi } from './api.js';

/** Instância única do cliente externo (com fetch nativo). */
const api = createWikipediaApi();

function articleNotFound(id) {
  const error = new Error(`Artigo não encontrado: ${id}`);
  error.status = 404;
  error.code = 'ARTICLE_NOT_FOUND';
  return error;
}

function isNotFoundError(error) {
  return error?.status === 404 || error?.code === 'ARTICLE_NOT_FOUND';
}

async function loadSummary(id, apiOverride) {
  try {
    const summary = await apiOverride.summary(id);
    if (!summary?.extract) throw articleNotFound(id);
    return summary;
  } catch (error) {
    if (isNotFoundError(error)) throw articleNotFound(id);
    throw error;
  }
}

async function loadSummaryDetails(id, apiOverride) {
  try {
    if (typeof apiOverride.summaryDetails === 'function') {
      const details = await apiOverride.summaryDetails(id);
      const summary = details?.body ?? details;
      if (!summary?.extract) throw articleNotFound(id);
      return details?.body ? details : { body: summary };
    }

    const summary = await apiOverride.summary(id);
    if (!summary?.extract) throw articleNotFound(id);
    return { body: summary };
  } catch (error) {
    if (isNotFoundError(error)) throw articleNotFound(id);
    throw error;
  }
}

function optionalFields(fields) {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function articleMetadata(type, id, summary) {
  const title = summary.title ?? id;
  return optionalFields({
    id: title,
    url: `/text/${type}/${encodeURIComponent(title)}/content.txt`,
    contentJsonUrl: `/text/${type}/${encodeURIComponent(title)}/content.json`,
    lang: summary.lang ?? 'pt',
    name: title,
    displaytitle: summary.displaytitle,
    description: summary.description,
    pageid: summary.pageid,
    wikibase_item: summary.wikibase_item,
    namespace: summary.namespace,
    dir: summary.dir,
    revision: summary.revision,
    timestamp: summary.timestamp,
    tid: summary.tid,
    titles: summary.titles,
    description_source: summary.description_source,
    content_urls: summary.content_urls,
    thumbnail: summary.thumbnail,
    originalimage: summary.originalimage,
  });
}

function headerValue(headers, name) {
  const wanted = name.toLowerCase();
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === wanted);
  return entry?.[1] == null ? undefined : String(entry[1]);
}

function timestampHeader(timestamp) {
  const time = Date.parse(timestamp ?? '');
  return Number.isFinite(time) ? new Date(time).toUTCString() : undefined;
}

function byteLength(value) {
  return Buffer.byteLength(value ?? '', 'utf8');
}

function toMeta(title, description = '') {
  return {
    id: title,
    type: 'page',
    name: title,
    description: description || undefined,
  };
}

export async function catalog(type, catalogId, page, apiOverride = api) {
  if (page && typeof page.random === 'function') {
    apiOverride = page;
    page = undefined;
  }
  if (catalogId === 'aleatorios') {
    const result = await apiOverride.random(page?.limit ?? 10, page?.cursor);
    const titles = Array.isArray(result) ? result : result.titles;
    const pagination = Array.isArray(result) ? undefined : result.pagination;
    return { metas: titles.map((t) => toMeta(t)), ...(pagination ? { pagination } : {}) };
  }
  return { metas: [] };
}

export async function search(type, query, page, apiOverride = api) {
  if (page && typeof page.search === 'function') {
    apiOverride = page;
    page = undefined;
  }
  const result = await apiOverride.search(query, page);
  const results = Array.isArray(result) ? result : result.results;
  const pagination = Array.isArray(result) ? undefined : result.pagination;
  return { metas: results.map((r) => toMeta(r.title, r.description)), ...(pagination ? { pagination } : {}) };
}

export async function text(type, id, apiOverride = api) {
  const summary = await loadSummary(id, apiOverride);
  return {
    texts: [articleMetadata(type, id, summary)],
  };
}

export async function content(type, id, apiOverride = api) {
  const summary = await loadSummary(id, apiOverride);
  return `${summary.title ?? id}\n\n${summary.extract}`;
}

/** Entrega o resumo, metadados, mídia e a proveniência da coleta. */
export async function contentJson(type, id, apiOverride = api) {
  const details = await loadSummaryDetails(id, apiOverride);
  const summary = details.body;
  const title = summary.title ?? id;
  const text = `${title}\n\n${summary.extract}`;
  const upstreamHeaders = details.response?.headers ?? {};
  const sourceUrl = details.request?.url
    ?? `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(id)}`;
  const sourceHeaders = optionalFields({
    ETag: headerValue(upstreamHeaders, 'etag') ?? (summary.revision ? `W/\"${summary.revision}\"` : undefined),
    'Last-Modified': headerValue(upstreamHeaders, 'last-modified') ?? timestampHeader(summary.timestamp),
    'Content-Language': headerValue(upstreamHeaders, 'content-language') ?? summary.lang ?? 'pt',
    'Content-Length': headerValue(upstreamHeaders, 'content-length')
      ?? String(byteLength(details.response?.bodyText ?? JSON.stringify(summary))),
  });

  const body = optionalFields({
    id: title,
    type,
    title,
    displaytitle: summary.displaytitle,
    description: summary.description,
    description_source: summary.description_source,
    extract: summary.extract,
    extract_html: summary.extract_html,
    pageid: summary.pageid,
    wikibase_item: summary.wikibase_item,
    namespace: summary.namespace,
    lang: summary.lang ?? sourceHeaders['Content-Language'],
    dir: summary.dir,
    revision: summary.revision,
    timestamp: summary.timestamp,
    tid: summary.tid,
    titles: summary.titles,
    content_urls: summary.content_urls,
    thumbnail: summary.thumbnail,
    originalimage: summary.originalimage,
    content: {
      text,
      charCount: Array.from(text).length,
      wordCount: text.trim() ? text.trim().split(/\s+/u).length : 0,
      contentType: 'text/plain',
      encoding: 'utf-8',
    },
    source: {
      name: 'Wikipédia REST API',
      provider: 'Wikipédia',
      origin: new URL(sourceUrl).origin,
      url: sourceUrl,
      headers: sourceHeaders,
      responseHeaders: upstreamHeaders,
    },
    observability: {
      requestId: details.requestId ?? 'not-recorded',
      durationMs: Number.isFinite(details.durationMs) ? details.durationMs : 0,
      collectedAt: details.collectedAt ?? new Date().toISOString(),
    },
  });

  return { body, headers: optionalFields({
    ETag: sourceHeaders.ETag,
    'Last-Modified': sourceHeaders['Last-Modified'],
    'Content-Language': sourceHeaders['Content-Language'],
  }) };
}
