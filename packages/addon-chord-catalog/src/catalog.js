/**
 * Pure rules of the chord-chart catalogue: listing, searching, and paging.
 *
 * The module holds no HTTP code and no global state, so the handlers and the
 * tests share exactly the same behaviour.
 */

/** Characters per page used when the request does not ask for a size. */
export const DEFAULT_PAGE_SIZE = 10;
/** Hard cap for one page, matching the host's own limit range. */
export const MAX_PAGE_SIZE = 500;

/**
 * Folds text for comparison: lower case, no accents, single spaces.
 * A query typed without accents still finds an accented title.
 */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Section titles declared between brackets, in reading order. */
export function chartSections(text) {
  return String(text ?? '')
    .split('\n')
    .map((line, index) => ({ title: line.trim(), index }))
    .filter(({ title }) => /^\[[^\]]{1,40}\]$/.test(title))
    .map(({ title, index }) => ({ title: title.slice(1, -1).trim(), line: index }));
}

/** Text fields a query can match, with the weight each one carries. */
function fieldsOf(chart) {
  return {
    title: normalizeText(chart.title),
    artist: normalizeText(chart.artist?.name),
    artistSlug: normalizeText(chart.artist?.slug),
    composers: normalizeText((chart.composers ?? []).join(' ')),
    key: normalizeText(chart.key),
    tags: normalizeText((chart.tags ?? []).join(' ')),
    chords: (chart.chords ?? []).map((chord) => normalizeText(chord)),
    lyrics: normalizeText(String(chart.text ?? '').replace(/\[[^\]]*\]/g, ' ')),
  };
}

function scoreField(value, term, exactScore, partialScore) {
  if (!value) return 0;
  if (value === term) return exactScore;
  if (value.startsWith(term)) return Math.round(exactScore * 0.8);
  if (value.includes(term)) return partialScore;
  return 0;
}

/**
 * Scores one chart against the query terms.
 *
 * Every term must match somewhere; a chart that misses one term is discarded.
 * The order of the weights is the order a musician would expect: title, artist,
 * chord symbols, tags, and finally the lyrics.
 */
export function scoreChart(chart, terms) {
  const fields = fieldsOf(chart);
  let total = 0;

  for (const term of terms) {
    let best = 0;
    best = Math.max(best, scoreField(fields.title, term, 100, 60));
    best = Math.max(best, scoreField(fields.artist, term, 50, 35), scoreField(fields.artistSlug, term, 50, 35));
    best = Math.max(best, scoreField(fields.composers, term, 30, 20));
    best = Math.max(best, scoreField(fields.key, term, 25, 15));
    best = Math.max(best, scoreField(fields.tags, term, 20, 12));
    best = Math.max(best, scoreField(fields.lyrics, term, 14, 8));
    if (fields.chords.includes(term)) best = Math.max(best, 40);
    if (best === 0) return 0;
    total += best;
  }

  return total;
}

/**
 * Searches charts by title, artist, composer, key, tag, chord, or lyric word.
 * The result is deterministic: score first, then visits, then title.
 */
export function searchCharts(charts, query) {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [];

  return charts
    .map((chart) => ({ chart, score: scoreChart(chart, terms) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score - left.score ||
      (right.chart.visits ?? 0) - (left.chart.visits ?? 0) ||
      left.chart.title.localeCompare(right.chart.title))
    .map((entry) => entry.chart);
}

/** Named views over the same data set. An unknown identifier returns nothing. */
export function listCatalog(charts, catalogId) {
  const ordered = [...charts];
  switch (catalogId) {
    case 'recent':
      return ordered.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
    case 'popular':
      return ordered.sort((left, right) => (right.visits ?? 0) - (left.visits ?? 0));
    case 'beginner':
      return ordered
        .filter((chart) => (chart.difficulty ?? 5) <= 2)
        .sort((left, right) => (left.difficulty ?? 5) - (right.difficulty ?? 5) || left.title.localeCompare(right.title));
    case 'alphabetical':
      return ordered.sort((left, right) => left.title.localeCompare(right.title));
    default:
      return [];
  }
}

function parseCursor(cursor) {
  if (cursor === undefined || cursor === null || cursor === '') return 0;
  const value = Number(cursor);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function resolveLimit(limit) {
  if (typeof limit !== 'number' || !Number.isSafeInteger(limit) || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, limit);
}

/**
 * Slices one page and reports an opaque cursor for the next one.
 * The cursor is the offset itself, which keeps the server stateless.
 */
export function paginate(items, page = {}) {
  const limit = resolveLimit(page.limit);
  const offset = parseCursor(page.cursor);
  const slice = items.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  return {
    items: slice,
    pagination: {
      limit,
      total: items.length,
      ...(nextOffset < items.length ? { next: String(nextOffset) } : {}),
    },
  };
}

export function findChart(charts, id) {
  return charts.find((chart) => chart.id === id);
}