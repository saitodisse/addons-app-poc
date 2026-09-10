import { createWikipediaApi } from './api.js';

/** Instância única do cliente externo (com fetch nativo). */
const api = createWikipediaApi();

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
  const summary = await apiOverride.summary(id);
  if (!summary?.extract) {
    throw new Error(`Artigo não encontrado: ${id}`);
  }
  return {
    texts: [
      {
        id: summary.title ?? id,
        url: `/text/${type}/${encodeURIComponent(summary.title ?? id)}/content.txt`,
        lang: summary.lang ?? 'pt',
        name: summary.title ?? id,
        description: summary.description,
      },
    ],
  };
}

export async function content(type, id, apiOverride = api) {
  const summary = await apiOverride.summary(id);
  if (!summary?.extract) {
    throw new Error(`Artigo não encontrado: ${id}`);
  }
  return `${summary.title}\n\n${summary.extract}`;
}
