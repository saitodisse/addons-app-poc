import { defineAddonManifest } from '@addons-poc/protocol';

/**
 * Wikipedia add-on manifest, in Stremio-style format.
 *
 * The schemas are deliberately detailed: the contract shows the fields sent
 * to the external API and the fields the add-on reads from each response.
 */
const stringSchema = (description, classification = 'public', format) => ({
  type: 'string',
  description,
  classification,
  ...(format ? { format } : {}),
});

const integerSchema = (description, classification = 'public') => ({
  type: 'integer',
  description,
  classification,
});

const booleanSchema = (description, classification = 'public') => ({
  type: 'boolean',
  description,
  classification,
});

const objectSchema = (description, classification, properties, required = []) => ({
  type: 'object',
  description,
  classification,
  properties,
  ...(required.length ? { required } : {}),
});

const arraySchema = (description, classification, items) => ({
  type: 'array',
  description,
  classification,
  items,
});

const payload = (description, schema) => ({ description, schema });

const requestHeadersSchema = objectSchema('HTTP headers sent by the add-on client.', 'public', {
  'User-Agent': stringSchema('Identifies this project to Wikipedia.'),
  Accept: stringSchema('Requested response format.'),
}, ['User-Agent', 'Accept']);

const searchRequestSchema = objectSchema('Complete GET request sent to the MediaWiki API.', 'personal', {
  method: { type: 'string', description: 'HTTP method actually used.', classification: 'public', enum: ['GET'] },
  url: stringSchema('Final URL, including all already-encoded parameters.', 'personal', 'uri'),
  path: stringSchema('HTTP path sent to the API.', 'public'),
  queryString: stringSchema('Query string sent unchanged.', 'personal'),
  headers: requestHeadersSchema,
  body: { type: 'null', description: 'This API is queried without an HTTP body.', classification: 'public' },
  query: objectSchema('Semantic parameters sent in the URL.', 'personal', {
    action: stringSchema('Executed MediaWiki action.'),
    list: stringSchema('Queried list.', 'public'),
    srsearch: stringSchema('Search term entered by the person.', 'personal'),
    srnamespace: stringSchema('Namespace searched as a text value; 0 represents articles.'),
    srlimit: stringSchema('Amount requested for this page, as it appears in the URL.'),
    sroffset: stringSchema('Offset used for the current page, as it appears in the URL.'),
    srinfo: stringSchema('Additional information requested about the total.'),
    srprop: stringSchema('Additional fields requested for each result.'),
    format: stringSchema('Response format.', 'public'),
    origin: stringSchema('API CORS parameter.', 'public'),
  }, ['action', 'list', 'srsearch', 'srnamespace', 'srlimit', 'sroffset', 'format', 'origin']),
}, ['method', 'url', 'path', 'queryString', 'headers', 'body', 'query']);

const extractsRequestSchema = objectSchema('Complete GET request used to complete extracts.', 'public', {
  method: { type: 'string', description: 'HTTP method actually used.', classification: 'public', enum: ['GET'] },
  url: stringSchema('Final URL with the encoded title batch.', 'public', 'uri'),
  path: stringSchema('HTTP path sent to the API.', 'public'),
  queryString: stringSchema('Query string sent unchanged.', 'public'),
  headers: requestHeadersSchema,
  body: { type: 'null', description: 'This API is queried without an HTTP body.', classification: 'public' },
  query: objectSchema('Extract batch parameters.', 'public', {
    action: stringSchema('Executed MediaWiki action.'),
    titles: stringSchema('Public titles separated by |.'),
    prop: stringSchema('Requested property.'),
    exlimit: stringSchema('Batch page limit, as it appears in the URL.'),
    explaintext: stringSchema('Requests text without HTML.'),
    exintro: stringSchema('Requests only the introduction.'),
    redirects: stringSchema('Allows redirects to be followed.'),
    format: stringSchema('Response format.'),
    origin: stringSchema('API CORS parameter.'),
  }, ['action', 'titles', 'prop', 'exlimit', 'explaintext', 'exintro', 'redirects', 'format', 'origin']),
}, ['method', 'url', 'path', 'queryString', 'headers', 'body', 'query']);

const randomRequestSchema = objectSchema('Complete GET request for random titles.', 'public', {
  method: { type: 'string', description: 'HTTP method actually used.', classification: 'public', enum: ['GET'] },
  url: stringSchema('Final URL, including rncontinue when pagination is present.', 'public', 'uri'),
  path: stringSchema('HTTP path sent to the API.', 'public'),
  queryString: stringSchema('Query string sent unchanged.', 'public'),
  headers: requestHeadersSchema,
  body: { type: 'null', description: 'This API is queried without an HTTP body.', classification: 'public' },
  query: objectSchema('Random query parameters.', 'public', {
    action: stringSchema('Executed MediaWiki action.'),
    list: stringSchema('Queried list.'),
    rnnamespace: stringSchema('Queried namespace, as it appears in the URL.'),
    rnlimit: stringSchema('Requested amount, as it appears in the URL.'),
    rncontinue: stringSchema('Opaque cursor received from the previous page.'),
    format: stringSchema('Response format.'),
    origin: stringSchema('API CORS parameter.'),
  }, ['action', 'list', 'rnnamespace', 'rnlimit', 'format', 'origin']),
}, ['method', 'url', 'path', 'queryString', 'headers', 'body', 'query']);

const summaryRequestSchema = objectSchema('Complete GET request for an article summary.', 'personal', {
  method: { type: 'string', description: 'HTTP method actually used.', classification: 'public', enum: ['GET'] },
  url: stringSchema('Final URL with the title encoded in the path.', 'personal', 'uri'),
  path: stringSchema('HTTP path sent to the API.', 'public'),
  queryString: stringSchema('Query string sent unchanged; empty for this endpoint.', 'public'),
  headers: requestHeadersSchema,
  body: { type: 'null', description: 'This API is queried without an HTTP body.', classification: 'public' },
  query: objectSchema('Parameters sent in the URL; this endpoint sends no query parameters.', 'public', {}),
  pathParameters: objectSchema('REST path parameters.', 'personal', {
    title: stringSchema('Title requested from the summary endpoint.', 'personal'),
  }, ['title']),
}, ['method', 'url', 'path', 'queryString', 'headers', 'body', 'query', 'pathParameters']);

const searchMetaSchema = objectSchema('A result item normalized by the add-on.', 'public', {
  id: stringSchema('Title used as the identifier.'),
  type: stringSchema('Fixed page type.'),
  name: stringSchema('Displayed title.'),
  description: stringSchema('Title and introductory extract, when available.'),
  url: stringSchema('Content URL in the selected language.', 'public', 'uri'),
});

const paginationSchema = objectSchema('Continuation of the listing.', 'public', {
  limit: integerSchema('Effective page size.'),
  total: integerSchema('Known total, limited to 500.'),
  next: stringSchema('Offset for the next page.'),
}, ['limit']);

const incomingRequestSchema = (description, properties, required) => payload(
  description,
  objectSchema(description, 'personal', properties, required),
);

const incomingSearchRequest = incomingRequestSchema('Parameters the host sends to the add-on to search for articles.', {
  type: stringSchema('Type requested by the host.'),
  query: stringSchema('Term entered by the person.', 'personal'),
  limit: integerSchema('Maximum requested for this page.'),
  cursor: stringSchema('Opaque cursor received from the previous page.', 'personal'),
  lang: { type: 'string', description: 'Wikipedia language selected by the person.', classification: 'public', enum: ['pt', 'en'] },
}, ['type', 'query']);

const incomingCatalogRequest = incomingRequestSchema('Parameters the host sends to the add-on to obtain random articles.', {
  type: stringSchema('Type requested by the host.'),
  catalogId: stringSchema('Catalog identifier.'),
  limit: integerSchema('Maximum requested for this page.'),
  cursor: stringSchema('Opaque cursor received from the previous page.'),
  lang: { type: 'string', description: 'Wikipedia language selected by the person.', classification: 'public', enum: ['pt', 'en'] },
}, ['type', 'catalogId']);

const incomingTextRequest = incomingRequestSchema('Parameters the host sends to the add-on to obtain the text option.', {
  type: stringSchema('Type requested by the host.'),
  id: stringSchema('Article identifier or title.', 'personal'),
  lang: { type: 'string', description: 'Wikipedia language selected by the person.', classification: 'public', enum: ['pt', 'en'] },
}, ['type', 'id']);

const incomingContentRequest = incomingRequestSchema('Parameters the host sends to the add-on to obtain text content.', {
  type: stringSchema('Type requested by the host.'),
  id: stringSchema('Article identifier or title.', 'personal'),
  lang: { type: 'string', description: 'Wikipedia language selected by the person.', classification: 'public', enum: ['pt', 'en'] },
}, ['type', 'id']);

const searchResponseSchema = objectSchema('Complete response from the MediaWiki search.', 'public', {
  batchcomplete: booleanSchema('Indicates whether the query completed.'),
  continue: objectSchema('API continuation cursor.', 'public', {
    sroffset: integerSchema('Next offset.'),
    continue: stringSchema('Internal API cursor.'),
  }),
  query: objectSchema('Results and approximate total.', 'public', {
    searchinfo: objectSchema('Information about the total.', 'public', {
      totalhits: integerSchema('Approximate number of results.'),
    }),
    search: arraySchema('Raw search results.', 'public', objectSchema('Raw Wikipedia result.', 'public', {
      ns: integerSchema('Result namespace.'),
      title: stringSchema('Result title.'),
      pageid: integerSchema('Numeric page ID.'),
      size: integerSchema('Approximate page size.'),
      wordcount: integerSchema('Approximate word count.'),
      snippet: stringSchema('HTML snippet returned by the API.'),
      timestamp: stringSchema('Date of the last revision.', 'public', 'date-time'),
    }, ['ns', 'title', 'pageid'])),
  }),
});

const extractsResponseSchema = objectSchema('Complete response from the extracts query.', 'public', {
  batchcomplete: booleanSchema('Indicates whether the query completed.'),
  query: objectSchema('Page map returned by the API.', 'public', {
    pages: objectSchema('Dynamic keys by pageid; each value contains a title and extract.', 'public', {
      pageid: integerSchema('Numeric page ID when the key is materialized.'),
      ns: integerSchema('Page namespace.'),
      title: stringSchema('Effective title after a redirect.'),
      extract: stringSchema('Plain-text introduction.'),
      missing: booleanSchema('Indicates a missing page.'),
    }),
  }),
});

const randomResponseSchema = objectSchema('Complete response from the random-pages query.', 'public', {
  batchcomplete: booleanSchema('Indicates whether the query completed.'),
  continue: objectSchema('API continuation cursor.', 'public', {
    rncontinue: stringSchema('Opaque cursor for the next query.'),
    continue: stringSchema('Internal API cursor.'),
  }),
  query: objectSchema('List of random pages.', 'public', {
    random: arraySchema('Returned titles.', 'public', objectSchema('Random page.', 'public', {
      id: integerSchema('Numeric page ID.'),
      ns: integerSchema('Page namespace.'),
      title: stringSchema('Public title.'),
    }, ['id', 'ns', 'title'])),
  }),
});

const namespaceSchema = objectSchema('Article namespace.', 'public', {
  id: integerSchema('Namespace ID.'),
  text: stringSchema('Namespace name.'),
});

const titlesSchema = objectSchema('Title variants provided by Wikipedia.', 'public', {
  canonical: stringSchema('Canonical title.'),
  normalized: stringSchema('Normalized title.'),
  display: stringSchema('Title ready for display.'),
});

const contentUrlsSchema = objectSchema('Public links to the article.', 'public', {
  desktop: objectSchema('Links to the desktop version.', 'public', {
    page: stringSchema('Page URL.', 'public', 'uri'),
    revisions: stringSchema('Revisions URL.', 'public', 'uri'),
    edit: stringSchema('Edit URL.', 'public', 'uri'),
    talk: stringSchema('Talk-page URL.', 'public', 'uri'),
  }),
  mobile: objectSchema('Links to the mobile version.', 'public', {
    page: stringSchema('Page URL.', 'public', 'uri'),
    revisions: stringSchema('Revisions URL.', 'public', 'uri'),
    edit: stringSchema('Edit URL.', 'public', 'uri'),
    talk: stringSchema('Talk-page URL.', 'public', 'uri'),
  }),
});

const imageSchema = (description) => objectSchema(description, 'public', {
  source: stringSchema('Image URL.', 'public', 'uri'),
  width: integerSchema('Width in pixels.'),
  height: integerSchema('Height in pixels.'),
});

const summaryResponseSchema = objectSchema('Complete response from the REST summary endpoint.', 'public', {
  type: stringSchema('REST response type.'),
  title: stringSchema('Effective article title.'),
  displaytitle: stringSchema('Title formatted for presentation.'),
  namespace: namespaceSchema,
  wikibase_item: stringSchema('Related Wikidata ID.'),
  pageid: integerSchema('Numeric page ID.'),
  lang: stringSchema('Article language.'),
  dir: stringSchema('Text direction.'),
  revision: stringSchema('Revision ID.'),
  tid: stringSchema('REST response identifier.'),
  timestamp: stringSchema('Revision date.', 'public', 'date-time'),
  description: stringSchema('Short article description.'),
  description_source: stringSchema('Source of the short description.'),
  titles: titlesSchema,
  content_urls: contentUrlsSchema,
  extract: stringSchema('Plain-text summary.'),
  extract_html: stringSchema('HTML summary.'),
  thumbnail: imageSchema('Thumbnail, when available.'),
  originalimage: imageSchema('Original image, when available.'),
});

const contentJsonResponseSchema = objectSchema('Structured content with metadata and collection provenance.', 'public', {
  id: stringSchema('Effective article identifier.'),
  type: stringSchema('Resource type.'),
  title: stringSchema('Effective article title.'),
  displaytitle: stringSchema('Title formatted for presentation.'),
  description: stringSchema('Short article description.'),
  description_source: stringSchema('Source of the short description.'),
  extract: stringSchema('Plain-text summary.'),
  extract_html: stringSchema('HTML summary.'),
  pageid: integerSchema('Numeric page ID.'),
  wikibase_item: stringSchema('Related Wikidata ID.'),
  namespace: namespaceSchema,
  lang: stringSchema('Article language.'),
  dir: stringSchema('Text direction.'),
  revision: stringSchema('Revision ID.'),
  timestamp: stringSchema('Revision date.', 'public', 'date-time'),
  tid: stringSchema('REST response identifier.'),
  titles: titlesSchema,
  content_urls: contentUrlsSchema,
  thumbnail: imageSchema('Thumbnail, when available.'),
  originalimage: imageSchema('Original image, when available.'),
  content: objectSchema('Text content and its metrics.', 'public', {
    text: stringSchema('Title followed by the plain-text extract.'),
    charCount: integerSchema('Number of Unicode characters in the content.'),
    wordCount: integerSchema('Number of words separated by spaces.'),
    contentType: stringSchema('MIME type of the text content.'),
    encoding: stringSchema('Text content encoding.'),
  }, ['text', 'charCount', 'wordCount', 'contentType', 'encoding']),
  source: objectSchema('Queried source and headers received from Wikipedia.', 'public', {
    name: stringSchema('Name of the queried endpoint.'),
    provider: stringSchema('Information provider.'),
    origin: stringSchema('HTTP origin of the source.', 'public', 'uri'),
    url: stringSchema('Exact URL queried.', 'public', 'uri'),
    headers: objectSchema('Relevant headers from the source response.', 'public', {
      ETag: stringSchema('ETag from the external response.'),
      'Last-Modified': stringSchema('Modification date of the external response.'),
      'Content-Language': stringSchema('Language reported by the source.'),
      'Content-Length': stringSchema('External response size in bytes.'),
    }, ['ETag', 'Last-Modified', 'Content-Language', 'Content-Length']),
    responseHeaders: objectSchema('All non-sensitive headers received from the source.', 'public', {}),
  }, ['provider', 'origin', 'url', 'headers']),
  observability: objectSchema('Collection identifiers and timings.', 'public', {
    requestId: stringSchema('ID correlating the request with debug data.'),
    durationMs: integerSchema('Query duration in milliseconds.'),
    collectedAt: stringSchema('Time when collection completed.', 'public', 'date-time'),
  }, ['requestId', 'durationMs', 'collectedAt']),
}, ['id', 'type', 'title', 'extract', 'content', 'source', 'observability']);

const trafficEntrySchema = objectSchema('An HTTP exchange observed by the server.', 'public', {
  sequence: integerSchema('Sequence number within the process.'),
  recordedAt: stringSchema('Time when the entry was recorded.', 'public', 'date-time'),
  source: stringSchema('Component that observed the exchange.'),
  requestId: stringSchema('Identifier correlating attempt and response.'),
  direction: stringSchema('Direction relative to the add-on.'),
  phase: stringSchema('Request or response phase.'),
  operation: stringSchema('External API operation.'),
  attempt: integerSchema('Attempt number, including retries.'),
  method: stringSchema('HTTP method.'),
  url: stringSchema('Observed URL.', 'public', 'uri'),
  path: stringSchema('Observed local route.'),
  request: objectSchema('Everything sent in the request.', 'public', {
    method: stringSchema('Sent method.'),
    url: stringSchema('Sent URL.', 'public', 'uri'),
    path: stringSchema('Local route.'),
    queryString: stringSchema('Unchanged query string.'),
    query: objectSchema('Separated parameters.', 'personal', {}),
    headers: objectSchema('Sent headers.', 'public', {}),
    body: { type: 'null', description: 'Sent body; currently observed operations are GET and send no payload.', classification: 'public' },
  }),
  status: integerSchema('Returned HTTP status.'),
  ok: booleanSchema('Indicates a successful HTTP response.'),
  response: objectSchema('Everything returned in the response.', 'public', {
    status: integerSchema('HTTP status.'),
    ok: booleanSchema('Indicates success.'),
    headers: objectSchema('Returned headers.', 'public', {}),
    body: objectSchema('Returned body, preserved in full.', 'public', {}),
    bodyText: stringSchema('Text representation sent over HTTP.'),
  }),
  retry: objectSchema('Retry scheduled after a transient failure.', 'public', {
    scheduled: booleanSchema('Indicates that another attempt will occur.'),
    delayMs: integerSchema('Delay before the next attempt.'),
  }),
  durationMs: integerSchema('Operation duration in milliseconds.'),
  error: objectSchema('Local error when the response could not be obtained.', 'public', {
    name: stringSchema('Error type.'),
    message: stringSchema('Error message.'),
  }),
});

const trafficResponseSchema = objectSchema('Local history of the latest HTTP exchanges.', 'public', {
  addon: stringSchema('Add-on identifier.'),
  generatedAt: stringSchema('Time when the history was read.', 'public', 'date-time'),
  retainedEntries: integerSchema('Number of entries currently retained.'),
  maxEntries: integerSchema('Process retention limit.'),
  entries: arraySchema('Complete events, without truncating retained bodies.', 'public', trafficEntrySchema),
}, ['addon', 'generatedAt', 'retainedEntries', 'maxEntries', 'entries']);

const debugLogDetails = payload('HTTP observability data in the server console.', objectSchema('Complete details of the observed exchange.', 'public', {
  requestId: stringSchema('Exchange identifier.'),
  operation: stringSchema('Executed operation.'),
  request: trafficEntrySchema.properties.request,
  response: trafficEntrySchema.properties.response,
  retry: trafficEntrySchema.properties.retry,
  error: trafficEntrySchema.properties.error,
  durationMs: integerSchema('Duration in milliseconds.'),
}));

export const manifest = defineAddonManifest({
  id: 'text-wikipedia',
  version: '1.0.0',
  name: 'Wikipedia (summaries)',
  description: 'Wikipedia articles and summaries with complete HTTP traffic inspection.',
  author: 'AC Team',
  license: 'MIT',
  ui: { title: '🌐 Wikipedia', body: 'Search and summaries queried from Wikipedia over HTTP. The panel below shows the manifest and the actual traffic sent and received.' },
  resources: [
    { name: 'catalog', types: ['page'], idPrefixes: [], languages: ['pt', 'en'] },
    { name: 'search', types: ['page'], idPrefixes: [], languages: ['pt', 'en'] },
    { name: 'text', types: ['page'], idPrefixes: [], languages: ['pt', 'en'] },
  ],
  types: ['page'],
  idPrefixes: [],
  catalogs: [
    { type: 'page', id: 'random', name: 'Random Articles' },
  ],
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: { required: [], optional: ['registry.services', 'ui.tab', 'logs', 'state-store'] },
    services: [],
    ui: { fields: [], actions: [] },
    state: [],
    http: [
      {
        id: 'catalog',
        direction: 'incoming',
        method: 'GET',
        path: '/catalog/{type}/{catalogId}.json?limit={limit}&cursor={cursor}&lang={lang}',
        purpose: 'Returns random titles to the host and passes through optional pagination.',
        resource: 'catalog',
        receives: incomingCatalogRequest,
        returns: payload('Normalized metadata for random articles.', objectSchema('Object with metas and pagination.', 'public', {
          metas: arraySchema('Articles found.', 'public', searchMetaSchema),
          pagination: paginationSchema,
        }, ['metas'])),
      },
      {
        id: 'search',
        direction: 'incoming',
        method: 'GET',
        path: '/search/{type}/{query}.json?limit={limit}&cursor={cursor}&lang={lang}',
        purpose: 'Searches for articles matching the provided term and returns the extract in each meta description.',
        resource: 'search',
        receives: incomingSearchRequest,
        returns: payload('Normalized results and pagination.', objectSchema('Object with metas and pagination.', 'public', {
          metas: arraySchema('Results found.', 'public', searchMetaSchema),
          pagination: paginationSchema,
        }, ['metas'])),
      },
      {
        id: 'text',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}.json?lang={lang}',
        purpose: 'Lists the summary version available for an article.',
        resource: 'text',
        receives: incomingTextRequest,
        returns: payload('Content options and their links.', objectSchema('Object with texts.', 'public', {
          texts: arraySchema('Available texts.', 'public', objectSchema('Text option.', 'public', {
            id: stringSchema('Text ID.'),
            url: stringSchema('Content URL served by the add-on.', 'public', 'uri'),
            contentJsonUrl: stringSchema('Structured content URL served by the add-on.', 'public', 'uri'),
            lang: stringSchema('Text language.'),
            name: stringSchema('Displayed name.'),
            displaytitle: stringSchema('Title formatted for presentation.'),
            description: stringSchema('Short description, when available.'),
            pageid: integerSchema('Numeric page ID.'),
            wikibase_item: stringSchema('Related Wikidata ID.'),
            namespace: namespaceSchema,
            dir: stringSchema('Text direction.'),
            revision: stringSchema('Revision ID.'),
            timestamp: stringSchema('Revision date.', 'public', 'date-time'),
            tid: stringSchema('REST response identifier.'),
            titles: titlesSchema,
            description_source: stringSchema('Source of the short description.'),
            content_urls: contentUrlsSchema,
            thumbnail: imageSchema('Thumbnail, when available.'),
            originalimage: imageSchema('Original image, when available.'),
          }, ['id', 'url', 'name'])),
        }, ['texts'])),
      },
      {
        id: 'content',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}/content.txt?lang={lang}',
        purpose: 'Returns the title and summary as plain text.',
        receives: incomingContentRequest,
        returns: payload('Article text content.', stringSchema('Title followed by the introductory extract.')),
      },
      {
        id: 'content-json',
        direction: 'incoming',
        method: 'GET',
        path: '/text/{type}/{id}/content.json?lang={lang}',
        purpose: 'Returns structured content, metadata, media, source, and collection observability without changing content.txt.',
        receives: incomingContentRequest,
        returns: payload('Structured content and complete article metadata.', contentJsonResponseSchema),
      },
      {
        id: 'debug-traffic',
        direction: 'incoming',
        method: 'GET',
        path: '/debug/traffic.json',
        purpose: 'Exposes the complete local history of observed requests and responses to the host.',
        returns: payload('Observability history for the current execution.', trafficResponseSchema),
      },
      {
        id: 'search-api',
        direction: 'outgoing',
        method: 'GET',
        origin: 'https://pt.wikipedia.org',
        path: '/w/api.php?action=query&list=search&srsearch={query}&srnamespace=0&srlimit={limit}&sroffset={offset}&srinfo=totalhits&srprop=snippet&format=json&origin=*',
        purpose: 'Searches for up to 20 titles per page and obtains an approximate total and cursor up to the 500-result limit.',
        receives: payload('Complete request sent to the search API.', searchRequestSchema),
        returns: payload('Complete response received from the search API.', searchResponseSchema),
      },
      {
        id: 'extracts-api',
        direction: 'outgoing',
        method: 'GET',
        origin: 'https://pt.wikipedia.org',
        path: '/w/api.php?action=query&titles={titles}&prop=extracts&exlimit=20&explaintext=1&exintro=1&redirects=1&format=json&origin=*',
        purpose: 'Completes the introductory content of search results in batches.',
        receives: payload('Complete request sent to the extracts API.', extractsRequestSchema),
        returns: payload('Complete response received from the extracts API.', extractsResponseSchema),
      },
      {
        id: 'random-api',
        direction: 'outgoing',
        method: 'GET',
        origin: 'https://pt.wikipedia.org',
        path: '/w/api.php?action=query&list=random&rnnamespace=0&rnlimit={count}&rncontinue={cursor}&format=json&origin=*',
        purpose: 'Obtains random titles and an optional cursor for the catalog.',
        receives: payload('Complete request sent to the random-pages API.', randomRequestSchema),
        returns: payload('Complete response received from the random-pages API.', randomResponseSchema),
      },
      {
        id: 'summary-api',
        direction: 'outgoing',
        method: 'GET',
        origin: 'https://pt.wikipedia.org',
        path: '/api/rest_v1/page/summary/{title}',
        purpose: 'Obtains the complete public summary of an article for the text route and content.',
        receives: payload('Complete request sent to the REST summary API.', summaryRequestSchema),
        returns: payload('Complete response received from the REST summary API.', summaryResponseSchema),
      },
    ],
    logs: [
      { id: 'http-request', level: 'info', message: 'Observed HTTP request', description: 'Records the method, URL, headers, query, and sent body.', details: debugLogDetails },
      { id: 'http-response', level: 'info', message: 'Observed HTTP response', description: 'Records the status, headers, complete body, and duration.', details: debugLogDetails },
      { id: 'http-retry', level: 'warn', message: 'External API retry', description: 'Records another attempt after HTTP 429, 5xx, or a network failure.', details: debugLogDetails },
      { id: 'http-error', level: 'error', message: 'External API failure', description: 'Records the error and returned body when available.', details: debugLogDetails },
    ],
  },
});
