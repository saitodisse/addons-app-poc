# `@addons/addon-server`

ESM HTTP server for text-resource add-ons.

## Why this package exists

A remote add-on must be hostable without loading the host's TypeScript runtime. This package contains only the HTTP server and manifest validation through the public protocol.

## What it offers

`createAddonServer` receives a v1 manifest, a port, and four primary handlers, plus optional handlers:

| Handler | Route | Response |
| --- | --- | --- |
| `catalog` | `GET /catalog/{type}/{catalogId}.json?limit=20&cursor=...&lang=...` | `{ metas: [...], pagination? }` |
| `search` | `GET /search/{type}/{query}.json?limit=20&cursor=...&lang=...` | `{ metas: [...], pagination? }` |
| `text` | `GET /text/{type}/{id}.json?lang=...` | `{ texts: [{ id, url, lang, name }] }` |
| `content` | `GET /text/{type}/{id}/content.txt?lang=...` | plain text |
| `contentJson` (optional) | `GET /text/{type}/{id}/content.json?lang=...` | structured object; may return `{ body, headers }` |
| `debugTraffic` (optional) | `GET /debug/traffic.json` | local request and response history |

For binary files such as images, an add-on can also pass an `assets` map keyed
by exact URL path. Each entry supplies a `Uint8Array` and a MIME type. The
server serves matching `GET` and `HEAD` requests with CORS, a one-day cache
header, and a traffic record that does not copy the binary body into logs.

It also publishes `GET /manifest.json`, enables CORS for the local demonstration,
turns relative content URLs into absolute server URLs, and forwards `limit`,
`cursor`, and the optional `lang` parameter to handlers. The cursor and
language are opaque to the shared server: each add-on decides how to interpret
them. An add-on that offers languages should announce them in
`contract.resources[].languages`.

`contentJson` is a parallel extension and does not change plain `content` text.
When a handler returns `{ body, headers }`, the server serializes `body` as JSON,
preserves additional headers, and calculates `Content-Length` for the delivered
body.

When `handlers.debugTraffic` is provided, the server also publishes local
history. `onTraffic` receives every incoming request and outgoing response,
including URL, headers, status, duration, and text/JSON bodies. Binary asset
responses record their byte length instead of copying image bytes into the log.
The debug route does not record its own read, avoiding an observability cycle. Authentication,
session, API-key, and IP headers are redacted before recording; other fields
remain available.

## How to use

```js
import { createAddonServer } from '@addons/addon-server';
import { manifest } from './manifest.js';

const server = await createAddonServer({
  manifest,
  port: 5294,
  handlers: { catalog, search, text, content },
});

console.log(server.manifestUrl);
```

The server calls `validateManifest` from `@addons-poc/protocol` before opening
the port. The manifest must declare `contract.resources`, incoming HTTP
interactions, and all external I/O in `contract.http`. The package uses ESM
JavaScript and has no external runtime dependencies beyond the public protocol.

## Development

```bash
pnpm --filter @addons/addon-server test
pnpm --filter @addons/addon-text-wikipedia serve
```

The remaining consumer is documented in the [package index](../../docs/PACKAGES.md). The host knows only the manifest URL; it does not import this server or the handlers of a specific add-on.

## Limits

This server is not a sandbox. The `onTraffic` callback only observes requests
received by the server and responses it delivers; each handler must record the
external network calls it makes. The add-on is trusted for this POC and should
declare its external destinations in the manifest for human review.
