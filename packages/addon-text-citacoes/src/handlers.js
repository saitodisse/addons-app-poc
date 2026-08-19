import { createQuotesApi } from './api.js';

/** Instância única do cliente externo (com fetch nativo). */
const api = createQuotesApi();

function toMeta(quote) {
  return {
    id: String(quote.id),
    type: 'quote',
    name: quote.quote,
    description: quote.author,
  };
}

/** Filtro local sobre o lote baixado da API externa (a API não tem busca). */
function matches(query, quote) {
  const q = query.toLowerCase();
  return (
    quote.quote.toLowerCase().includes(q) ||
    (quote.author ?? '').toLowerCase().includes(q)
  );
}

export async function catalog(type, catalogId, apiOverride = api) {
  const quotes = await apiOverride.popular();
  return { metas: quotes.map(toMeta) };
}

export async function search(type, query, apiOverride = api) {
  const quotes = await apiOverride.popular(100);
  return { metas: quotes.filter((q) => matches(query, q)).map(toMeta) };
}

export async function text(type, id, apiOverride = api) {
  const quote = await apiOverride.byId(id);
  if (!quote || !quote.quote) {
    throw new Error(`Citação não encontrada: ${id}`);
  }
  return {
    texts: [
      {
        id: String(quote.id),
        url: `/text/${type}/${quote.id}/content.txt`,
        lang: 'en',
        name: quote.quote,
        description: quote.author,
      },
    ],
  };
}

export async function content(type, id, apiOverride = api) {
  const quote = await apiOverride.byId(id);
  if (!quote || !quote.quote) {
    throw new Error(`Citação não encontrada: ${id}`);
  }
  return `“${quote.quote}”\n\n— ${quote.author}`;
}