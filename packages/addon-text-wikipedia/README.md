# `@addons/addon-text-wikipedia`

HTTP server for Wikipedia summaries in Portuguese.

## Why it exists

It demonstrates an add-on that declares multiple external endpoints and presents them as text resources compatible with the same protocol.

## What it offers

It publishes a random catalog, search, text options, and plain-text content for
the `page` type. The search resource announces `pt` and `en` languages; the
host sidebar configuration chooses the Wikipedia domain used for the search and
keeps the same language when opening an article. Search uses `list=search` in
pages of up to 20 titles, continues with `sroffset`, and limits the total to 500
records. Each page completes extracts in batches through the Wikipedia API and
returns each article's content in the meta `description` field. Thus, a search
for `Ball` shows the content for `Ball` directly in the host's **Description**
column; **Previous page** and **Next page** navigate between pages without
accumulating rows, and the technical link
`http://localhost:5294/text/page/Ball/content.txt` leads to a dedicated page
that also fetches `content.json`, displaying the image, description, summary,
and original link. Metadata, headers, and observability remain available in JSON
and debug output. The client identifies itself to the API, retries transient
`429`/`5xx` failures, deduplicates simultaneous calls, and caches each page for
60 seconds. The per-page limit of 20 comes from the extracts API's `exlimit`;
the total limit of 500 comes from the search API's `srlimit`. See
[`API:Search`](https://www.mediawiki.org/wiki/API%3ASearch/en) and
[`Extension:TextExtracts`](https://www.mediawiki.org/wiki/Extension:TextExtracts).
`contract.http` records calls to paginated search, extract batches, the random
page list, and the summary API on `https://pt.wikipedia.org` and
`https://en.wikipedia.org`.

The manifest also declares the exact fields of every external request and
response. The server keeps the latest 100 exchanges with complete bodies at
`http://localhost:5294/debug/traffic.json` and prints each event as JSON in the
process terminal. When the extension is opened in the host, the same history is
available in the process terminal; in the host, the section shows only one link
to that endpoint while the page records the complete exchange in the DevTools
console. The debug endpoint itself is excluded from the history to avoid feeding
itself. Bodies, URLs, queries, and non-sensitive headers are preserved; cookies,
authentication, keys, and IP identifiers appear as `[redacted]`.

The `content.txt` route still returns only compatible plain text. It accepts
`?lang=pt` or `?lang=en`, as does the parallel content route. The parallel route
`http://localhost:5294/text/page/Ball/content.json` returns the title,
`displaytitle`, description, `extract`/`extract_html`, IDs, language and
direction, revision, timestamp, desktop/mobile page, revision, and edit links,
thumbnail, original image, text metrics, queried source, relevant headers, and
observability data (`requestId`, duration, and collection time). The HTTP
`ETag`, `Last-Modified`, `Content-Language`, and `Content-Length` headers are
also delivered by this route. A missing article returns a specific 404.

## How to run and test

```bash
pnpm --filter @addons/addon-text-wikipedia test
pnpm --filter @addons/addon-text-wikipedia serve
```

The manifest is at `http://localhost:5294/manifest.json`. The implementation is in [`src/handlers.js`](src/handlers.js) and [`src/manifest.js`](src/manifest.js), with the shared server [`@addons/addon-server`](../addon-server/README.md).
