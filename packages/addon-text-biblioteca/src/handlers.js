import { TEXTS, TEXT_BY_ID } from './texts.js';

function toMeta(text) {
  return {
    id: text.id,
    type: text.type,
    name: text.name,
    description: text.description,
  };
}

/** Mapea id de catálogo a un filtro de categoría (o null para todos). */
const CATALOG_FILTERS = {
  destaques: null,
  natureza: ['natureza'],
  memoria: ['memoria'],
};

export async function catalog(type, catalogId) {
  const categories = CATALOG_FILTERS[catalogId];
  const found = TEXTS.filter((t) => {
    if (!categories) return true;
    return categories.some((c) => t.categories.includes(c));
  });
  return { metas: found.map(toMeta) };
}

export async function search(type, query) {
  const q = query.toLowerCase();
  const found = TEXTS.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q),
  );
  return { metas: found.map(toMeta) };
}

export async function text(type, id) {
  const found = TEXT_BY_ID.get(id);
  if (!found) {
    throw new Error(`Texto no encontrado: ${id}`);
  }
  return {
    texts: [
      {
        id: found.id,
        url: `/text/${type}/${found.id}/content.txt`,
        lang: found.lang,
        name: found.name,
        description: found.description,
      },
    ],
  };
}

export async function content(type, id) {
  const found = TEXT_BY_ID.get(id);
  if (!found) {
    throw new Error(`Texto no encontrado: ${id}`);
  }
  return `${found.name}\n\n${found.content}`;
}