/**
 * Cliente da API pública da Wikipédia (busca paginada + extratos + resumo REST v1).
 * O fetch é injetável para testes — o mesmo padrão usado no protocolo.
 */
export const MAX_SEARCH_RESULTS = 500;
export const MAX_SEARCH_PAGE_SIZE = 20;
const EXTRACT_BATCH_SIZE = MAX_SEARCH_PAGE_SIZE;
const MAX_API_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 5000;
const SEARCH_CACHE_TTL_MS = 60_000;
const WIKIPEDIA_USER_AGENT = 'addons-app-poc (https://github.com/saitodisse/addons-app-poc)';

export function createWikipediaApi({
  fetchFn = (url) => fetch(url, { headers: { 'User-Agent': WIKIPEDIA_USER_AGENT } }),
  lang = 'pt',
  sleepFn = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  nowFn = () => Date.now(),
} = {}) {
  const api = `https://${lang}.wikipedia.org`;
  const searchCache = new Map();
  const searchInFlight = new Map();

  function retryDelay(response, attempt) {
    const retryAfter = response.headers?.get?.('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(MAX_RETRY_DELAY_MS, seconds * 1000);
      }
      const retryAt = Date.parse(retryAfter);
      if (Number.isFinite(retryAt)) {
        return Math.max(0, Math.min(MAX_RETRY_DELAY_MS, retryAt - nowFn()));
      }
    }
    return Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** attempt));
  }

  async function getJson(url) {
    for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt += 1) {
      let res;
      try {
        res = await fetchFn(url);
      } catch (error) {
        if (attempt === MAX_API_RETRIES) throw error;
        await sleepFn(Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** attempt)));
        continue;
      }
      if (res.ok) return res.json();
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_API_RETRIES) {
        throw new Error(`API externa respondeu HTTP ${res.status}`);
      }
      await sleepFn(retryDelay(res, attempt));
    }
    throw new Error('Não foi possível consultar a API externa');
  }

  function titleKey(title) {
    return title.trim().replaceAll('_', ' ').toLocaleLowerCase();
  }

  async function fetchExtracts(titles) {
    const url =
      `${api}/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}` +
      `&prop=extracts&exlimit=${MAX_SEARCH_PAGE_SIZE}&explaintext=1&exintro=1&redirects=1&format=json&origin=*`;
    const data = await getJson(url);
    return Object.values(data?.query?.pages ?? {})
      .filter((page) => typeof page?.title === 'string' && typeof page?.extract === 'string')
      .map((page) => ({ title: page.title, extract: page.extract }));
  }

  async function addExtracts(results) {
    const extracts = new Map();
    for (let start = 0; start < results.length; start += EXTRACT_BATCH_SIZE) {
      const batch = results.slice(start, start + EXTRACT_BATCH_SIZE);
      try {
        for (const page of await fetchExtracts(batch.map((result) => result.title))) {
          extracts.set(titleKey(page.title), page.extract);
        }
      } catch {
        // A falha externa não deve apagar os resultados já encontrados.
      }
    }
    return results.map((result) => {
      const extract = extracts.get(titleKey(result.title));
      return {
        ...result,
        description: extract ? `${result.title}\n\n${extract}` : '',
      };
    });
  }

  function parseCursor(cursor) {
    if (cursor === undefined) return 0;
    const offset = Number(cursor);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Cursor de busca inválido');
    return offset;
  }

  function pageResult(results, limit, total, next) {
    return {
      results,
      pagination: {
        limit,
        total,
        ...(next === undefined ? {} : { next: String(next) }),
      },
    };
  }

  function searchCacheKey(query, limit, offset) {
    return `${query}\u0000${limit}\u0000${offset}`;
  }

  async function searchPage(query, pageLimit, offset) {
    const url =
      `${api}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
      `&srnamespace=0&srlimit=${pageLimit}&sroffset=${offset}&srinfo=totalhits&srprop=snippet&format=json&origin=*`;
    const data = await getJson(url);
    const entries = Array.isArray(data?.query?.search) ? data.query.search : [];
    const results = await addExtracts(entries
      .filter((entry) => typeof entry?.title === 'string')
      .map((entry) => ({ title: entry.title, description: '', url: '' })));
    const rawTotal = Number(data?.query?.searchinfo?.totalhits);
    const total = Number.isSafeInteger(rawTotal) && rawTotal >= 0
      ? Math.min(MAX_SEARCH_RESULTS, rawTotal)
      : Math.min(MAX_SEARCH_RESULTS, offset + results.length);
    const nextOffset = data?.continue?.sroffset;
    const next = Number.isSafeInteger(nextOffset) && nextOffset < MAX_SEARCH_RESULTS && results.length > 0
      ? nextOffset
      : undefined;
    return pageResult(results, pageLimit, total, next);
  }

  return {
    /** Busca em páginas de até 20 itens, com no máximo 500 resultados totais. */
    async search(query, { limit = MAX_SEARCH_PAGE_SIZE, cursor } = {}) {
      const offset = parseCursor(cursor);
      const pageLimit = Math.min(MAX_SEARCH_PAGE_SIZE, Math.max(1, Math.round(limit)));
      if (offset >= MAX_SEARCH_RESULTS) return pageResult([], pageLimit, MAX_SEARCH_RESULTS);
      const key = searchCacheKey(query, pageLimit, offset);
      const cached = searchCache.get(key);
      if (cached) {
        if (cached.expiresAt > nowFn()) return cached.value;
        searchCache.delete(key);
      }
      const running = searchInFlight.get(key);
      if (running) return running;

      const request = searchPage(query, pageLimit, offset).then((result) => {
        searchCache.set(key, { value: result, expiresAt: nowFn() + SEARCH_CACHE_TTL_MS });
        return result;
      });
      searchInFlight.set(key, request);
      try {
        return await request;
      } finally {
        if (searchInFlight.get(key) === request) searchInFlight.delete(key);
      }
    },

    /** Artigos aleatórios (list=random), também com cursor de continuação. */
    async random(count = 10, cursor) {
      const limit = Math.min(MAX_SEARCH_RESULTS, Math.max(1, Math.round(count)));
      const url =
        `${api}/w/api.php?action=query&list=random&rnnamespace=0` +
        `&rnlimit=${limit}${cursor ? `&rncontinue=${encodeURIComponent(cursor)}` : ''}&format=json&origin=*`;
      const data = await getJson(url);
      return {
        titles: (data?.query?.random ?? []).map((r) => r.title).filter(Boolean),
        pagination: { limit, ...(data?.continue?.rncontinue ? { next: data.continue.rncontinue } : {}) },
      };
    },

    /** Resumo de um artigo (REST v1 page-summary). */
    async summary(title) {
      const url = `${api}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      return getJson(url);
    },
  };
}
