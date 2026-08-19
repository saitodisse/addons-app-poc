import { createPoetryApi } from './api.js';

/** Instância única do cliente externo (com fetch nativo). */
const api = createPoetryApi();

function toMeta(poem) {
  return {
    id: poem.title,
    type: 'poem',
    name: poem.title,
    author: poem.author,
    description: `${poem.author} · ${poem.linecount ?? '?'} versos`,
  };
}

export async function catalog(type, catalogId, apiOverride = api) {
  if (catalogId === 'shakespeare') {
    const poems = await apiOverride.byAuthor('Shakespeare');
    return { metas: poems.map(toMeta) };
  }
  // catálogo padrão: aleatórios
  const poems = await apiOverride.random(20);
  return { metas: poems.map(toMeta) };
}

export async function search(type, query, apiOverride = api) {
  // Busca externa real: primeiro por título, depois por autor.
  let poems = await apiOverride.byTitle(query);
  if (poems.length === 0) {
    poems = await apiOverride.byAuthor(query);
  }
  return { metas: poems.map(toMeta) };
}

export async function text(type, id, apiOverride = api) {
  const poem = await findPoem(id, apiOverride);
  return {
    texts: [
      {
        id: poem.title,
        url: `/text/${type}/${encodeURIComponent(poem.title)}/content.txt`,
        lang: 'en',
        name: poem.title,
        description: poem.author,
      },
    ],
  };
}

export async function content(type, id, apiOverride = api) {
  const poem = await findPoem(id, apiOverride);
  return `${poem.title}\n${poem.author}\n\n${poem.lines.join('\n')}`;
}

async function findPoem(id, apiOverride) {
  const poems = await apiOverride.byTitle(id);
  const poem = poems[0];
  if (!poem) {
    throw new Error(`Poema não encontrado: ${id}`);
  }
  return poem;
}