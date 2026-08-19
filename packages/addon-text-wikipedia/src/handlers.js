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

export async function catalog(type, catalogId, apiOverride = api) {
  if (catalogId === 'aleatorios') {
    const titles = await apiOverride.random(10);
    return { metas: titles.map((t) => toMeta(t)) };
  }
  return { metas: [] };
}

export async function search(type, query, apiOverride = api) {
  const results = await apiOverride.search(query, 10);
  return { metas: results.map((r) => toMeta(r.title, r.description)) };
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
