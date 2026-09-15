import { createWikipediaApi, normalizeWikipediaLanguage } from './api.js';

/** Single external client instance (using native fetch). */
const api = createWikipediaApi();

function articleNotFound(id) {
  const error = new Error(`Article not found: ${id}`);
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

function localizedContentPath(type, title, language, extension) {
  const path = `/text/${type}/${encodeURIComponent(title)}/content.${extension}`;
  return language ? `${path}?lang=${encodeURIComponent(language)}` : path;
}

function selectedLanguage(page, apiOverride) {
  const value = page?.lang ?? apiOverride?.language;
  return value ? normalizeWikipediaLanguage(value) : undefined;
}

function articleMetadata(type, id, summary, language) {
  const title = summary.title ?? id;
  const selected = language ? normalizeWikipediaLanguage(language) : undefined;
  return optionalFields({
    id: title,
    url: localizedContentPath(type, title, selected, 'txt'),
    contentJsonUrl: localizedContentPath(type, title, selected, 'json'),
    lang: summary.lang ?? language ?? 'pt',
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

function toMeta(title, description = '', language) {
  return optionalFields({
    id: title,
    type: 'page',
    name: title,
    description: description || undefined,
    url: localizedContentPath('page', title, language, 'txt'),
  });
}

export async function catalog(type, catalogId, page, apiOverride = api) {
  if (page && typeof page.random === 'function') {
    apiOverride = page;
    page = undefined;
  }
  if (catalogId === 'random') {
    const result = await apiOverride.random(page?.limit ?? 10, page?.cursor);
    const titles = Array.isArray(result) ? result : result.titles;
    const pagination = Array.isArray(result) ? undefined : result.pagination;
    const language = selectedLanguage(page, apiOverride);
    return { metas: titles.map((t) => toMeta(t, '', language)), ...(pagination ? { pagination } : {}) };
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
  const language = selectedLanguage(page, apiOverride);
  return { metas: results.map((r) => toMeta(r.title, r.description, language)), ...(pagination ? { pagination } : {}) };
}

export async function text(type, id, apiOverride = api) {
  const summary = await loadSummary(id, apiOverride);
  return {
    texts: [articleMetadata(type, id, summary, apiOverride.language)],
  };
}

export async function content(type, id, apiOverride = api) {
  const summary = await loadSummary(id, apiOverride);
  return `${summary.title ?? id}\n\n${summary.extract}`;
}

/** Returns the summary, metadata, media, and collection provenance. */
export async function contentJson(type, id, apiOverride = api) {
  const details = await loadSummaryDetails(id, apiOverride);
  const summary = details.body;
  const title = summary.title ?? id;
  const text = `${title}\n\n${summary.extract}`;
  const upstreamHeaders = details.response?.headers ?? {};
  const language = normalizeWikipediaLanguage(apiOverride.language ?? summary.lang ?? 'pt');
  const sourceUrl = details.request?.url
    ?? `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(id)}`;
  const sourceHeaders = optionalFields({
    ETag: headerValue(upstreamHeaders, 'etag') ?? (summary.revision ? `W/\"${summary.revision}\"` : undefined),
    'Last-Modified': headerValue(upstreamHeaders, 'last-modified') ?? timestampHeader(summary.timestamp),
    'Content-Language': headerValue(upstreamHeaders, 'content-language') ?? summary.lang ?? language,
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
    lang: summary.lang ?? sourceHeaders['Content-Language'] ?? language,
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
      name: 'Wikipedia REST API',
      provider: 'Wikipedia',
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
