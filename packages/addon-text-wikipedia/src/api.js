/**
 * Public Wikipedia API client (paginated search + extracts + REST v1 summary).
 * Fetch is injectable for tests, following the same pattern used by the protocol.
 */
export const MAX_SEARCH_RESULTS = 500;
export const MAX_SEARCH_PAGE_SIZE = 20;
export const WIKIPEDIA_LANGUAGES = ['pt', 'en'];

export function normalizeWikipediaLanguage(value) {
  return WIKIPEDIA_LANGUAGES.includes(value) ? value : 'pt';
}
const EXTRACT_BATCH_SIZE = MAX_SEARCH_PAGE_SIZE;
const MAX_API_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 5000;
const SEARCH_CACHE_TTL_MS = 60_000;
const WIKIPEDIA_USER_AGENT = 'addons-app-poc (https://github.com/saitodisse/addons-app-poc)';
const WIKIPEDIA_REQUEST_HEADERS = {
  'User-Agent': WIKIPEDIA_USER_AGENT,
  Accept: 'application/json',
};
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'x-client-ip',
  'x-forwarded-for',
  'x-real-ip',
  'forwarded',
  'cf-connecting-ip',
  'true-client-ip',
]);

export class WikipediaApiError extends Error {
  constructor(status, message = `External API responded with HTTP ${status}`) {
    super(message);
    this.name = 'WikipediaApiError';
    this.status = status;
  }
}

function headersToObject(headers) {
  if (!headers) return {};
  if (typeof headers.forEach === 'function') {
    const result = {};
    headers.forEach((value, name) => {
      result[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[redacted]' : value;
    });
    return result;
  }
  if (typeof headers.entries === 'function') {
    return Object.fromEntries([...headers.entries()].map(([name, value]) => [
      name,
      SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[redacted]' : value,
    ]));
  }
  return Object.fromEntries(Object.entries(headers).map(([name, value]) => [
    name,
    SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[redacted]' : value,
  ]));
}

function errorDetails(error) {
  return {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
  };
}

function requestDetails(url, operation) {
  const parsedUrl = new URL(url);
  const request = {
    method: 'GET',
    url,
    path: parsedUrl.pathname,
    queryString: parsedUrl.search,
    query: Object.fromEntries(parsedUrl.searchParams.entries()),
    headers: { ...WIKIPEDIA_REQUEST_HEADERS },
    body: null,
  };
  if (operation === 'summary') {
    const encodedTitle = parsedUrl.pathname.split('/').at(-1) ?? '';
    request.pathParameters = { title: decodeURIComponent(encodedTitle) };
  }
  return request;
}

export function createWikipediaApi({
  fetchFn = (url) => fetch(url, { headers: WIKIPEDIA_REQUEST_HEADERS }),
  lang = 'pt',
  sleepFn = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  nowFn = () => Date.now(),
  onTraffic = () => {},
} = {}) {
  const language = normalizeWikipediaLanguage(lang);
  const api = `https://${language}.wikipedia.org`;
  const searchCache = new Map();
  const searchInFlight = new Map();
  let requestSequence = 0;

  function recordTraffic(event) {
    try {
      onTraffic({
        source: 'wikipedia-api',
        direction: 'outgoing',
        phase: 'exchange',
        ...event,
      });
    } catch (error) {
      console.error('[wikipedia-api] traffic observer failed', error);
    }
  }

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

  async function readJsonResponse(response) {
    if (typeof response.text === 'function') {
      const bodyText = await response.text();
      return { body: JSON.parse(bodyText), bodyText };
    }
    if (typeof response.json === 'function') {
      const body = await response.json();
      return { body, bodyText: JSON.stringify(body) };
    }
    throw new Error('External API response does not provide a readable JSON body');
  }

  async function readResponseBody(response) {
    if (typeof response.text === 'function') {
      try {
        const bodyText = await response.text();
        try {
          return { body: JSON.parse(bodyText), bodyText };
        } catch {
          return { body: bodyText, bodyText };
        }
      } catch {
        return { body: undefined };
      }
    }
    if (typeof response.json === 'function') {
      try {
        const body = await response.json();
        return { body, bodyText: JSON.stringify(body) };
      } catch {
        return { body: undefined };
      }
    }
    return { body: undefined };
  }

  async function getJson(url, operation, { includeDetails = false } = {}) {
    const requestId = `wikipedia-api-${++requestSequence}`;
    for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt += 1) {
      const startedAt = nowFn();
      const request = requestDetails(url, operation);
      let res;
      try {
        res = await fetchFn(url);
      } catch (error) {
        const retry = attempt < MAX_API_RETRIES;
        const retryDelayMs = retry ? Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** attempt)) : undefined;
        recordTraffic({
          requestId,
          operation,
          attempt: attempt + 1,
          request,
          response: null,
          error: errorDetails(error),
          ...(retryDelayMs === undefined ? {} : { retry: { scheduled: true, delayMs: retryDelayMs } }),
          durationMs: nowFn() - startedAt,
        });
        if (attempt === MAX_API_RETRIES) throw error;
        await sleepFn(retryDelayMs);
        continue;
      }
      if (res.ok) {
        try {
          const { body, bodyText } = await readJsonResponse(res);
          const response = {
            status: res.status,
            ok: res.ok,
            headers: headersToObject(res.headers),
            body,
            bodyText,
          };
          const durationMs = nowFn() - startedAt;
          const collectedAt = new Date().toISOString();
          recordTraffic({
            requestId,
            operation,
            attempt: attempt + 1,
            request,
            response,
            durationMs,
          });
          return includeDetails ? { body, requestId, request, response, durationMs, collectedAt } : body;
        } catch (error) {
          recordTraffic({
            requestId,
            operation,
            attempt: attempt + 1,
            request,
            response: {
              status: res.status,
              ok: res.ok,
              headers: headersToObject(res.headers),
              body: null,
            },
            error: errorDetails(error),
            durationMs: nowFn() - startedAt,
          });
          throw error;
        }
      }
      const retryable = res.status === 429 || res.status >= 500;
      const retryDelayMs = retryable && attempt < MAX_API_RETRIES ? retryDelay(res, attempt) : undefined;
      const { body, bodyText } = await readResponseBody(res);
      recordTraffic({
        requestId,
        operation,
        attempt: attempt + 1,
        request,
        response: {
          status: res.status,
          ok: res.ok,
          headers: headersToObject(res.headers),
          body,
          ...(bodyText === undefined ? {} : { bodyText }),
        },
        ...(retryDelayMs === undefined ? {} : { retry: { scheduled: true, delayMs: retryDelayMs } }),
        durationMs: nowFn() - startedAt,
      });
      if (!retryable || attempt === MAX_API_RETRIES) {
        throw new WikipediaApiError(res.status);
      }
      await sleepFn(retryDelayMs);
    }
    throw new Error('Unable to query the external API');
  }

  function titleKey(title) {
    return title.trim().replaceAll('_', ' ').toLocaleLowerCase();
  }

  async function fetchExtracts(titles) {
    const url =
      `${api}/w/api.php?action=query&titles=${encodeURIComponent(titles.join('|'))}` +
      `&prop=extracts&exlimit=${MAX_SEARCH_PAGE_SIZE}&explaintext=1&exintro=1&redirects=1&format=json&origin=*`;
    const data = await getJson(url, 'extracts');
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
        // An external failure must not discard results already found.
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
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid search cursor');
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
      const data = await getJson(url, 'search');

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
    /** Language currently selected for this client instance. */
    language,

    /** Searches pages of up to 20 items, with at most 500 total results. */
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

    /** Random articles (list=random), also with a continuation cursor. */
    async random(count = 10, cursor) {
      const limit = Math.min(MAX_SEARCH_RESULTS, Math.max(1, Math.round(count)));
      const url =
        `${api}/w/api.php?action=query&list=random&rnnamespace=0` +
        `&rnlimit=${limit}${cursor ? `&rncontinue=${encodeURIComponent(cursor)}` : ''}&format=json&origin=*`;
      const data = await getJson(url, 'random');
      return {
        titles: (data?.query?.random ?? []).map((r) => r.title).filter(Boolean),
        pagination: { limit, ...(data?.continue?.rncontinue ? { next: data.continue.rncontinue } : {}) },
      };
    },

    /** Article summary (REST v1 page-summary). */
    async summary(title) {
      const url = `${api}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      return getJson(url, 'summary');
    },

    /** Summary and HTTP exchange metadata from the REST summary endpoint. */
    async summaryDetails(title) {
      const url = `${api}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      return getJson(url, 'summary', { includeDetails: true });
    },
  };
}
