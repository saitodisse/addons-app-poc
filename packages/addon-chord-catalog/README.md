# `@addons/addon-chord-catalog`

An HTTP add-on that publishes a chord-chart catalogue: listing, search, and
two-stage content delivery.

## Why it exists

A catalogue is the part of a music application that must live outside the host.
This add-on proves that an independent server can list, search, and deliver
chord charts through the public protocol, with the host never knowing what a
chord is.

## What it offers

| Resource | Route | Answer |
| --- | --- | --- |
| `catalog` | `GET /catalog/chart/{catalogId}.json` | One named view: `recent`, `popular`, `beginner`, `alphabetical` |
| `search` | `GET /search/chart/{query}.json` | Rows ranked by title, artist, composer, key, tag, chord, or lyric word |
| `text` | `GET /text/chart/{id}.json` | The deliverable version of a chart and its content links |
| — | `GET /artists/{artistSlug}.png` | Generated artist portrait used in the catalogue table |
| — | `GET /text/chart/{id}/content.txt` | The chart text exactly as authored |
| — | `GET /text/chart/{id}/content.json` | The structured payload: work, version, chart record, sections, shapes |
| — | `GET /debug/traffic.json` | The recent exchange history for the host observability panel |

Listing and search return metadata only; the chart text is delivered when
someone opens it (decision 14). Both accept `limit` and `cursor` and return an
optional `pagination` with `total` and `next`. The cursor is the offset itself,
so the server stays stateless.

The data set is **original demo content** written for this POC: eight charts,
invented songs, artists, albums, and first-release years, with realistic
notation and shapes. Artist portraits are generated for this demo. No published
catalogue or artist photo was copied. See
[`docs/CHORD-CHART.md`](../../docs/CHORD-CHART.md).

## How to run and test

```bash
pnpm --filter @addons/addon-chord-catalog test
pnpm --filter @addons/addon-chord-catalog serve
```

The manifest is at `http://localhost:5295/manifest.json`.

```bash
curl -s 'http://localhost:5295/search/chart/lantern.json?limit=3'
curl -s 'http://localhost:5295/text/chart/harbor-light/content.json' | head -c 400
```

## How it is organized

| File | Responsibility |
| --- | --- |
| [`src/data/charts.js`](src/data/charts.js) | The demo data set and the announced catalogue views |
| [`src/data/voicings.js`](src/data/voicings.js) | Chord shapes as `frets`, `fingers`, and `position` |
| [`src/catalog.js`](src/catalog.js) | Pure rules: text folding, ranking, listing, paging |
| [`src/payloads.js`](src/payloads.js) | Row, text-option, and structured payload builders |
| [`assets/artists/`](assets/artists) | Generated portraits served from the catalogue's own URL |
| [`src/handlers.js`](src/handlers.js) | Route handlers, with injectable dependencies for tests |
| [`src/manifest.js`](src/manifest.js) | Contract v1 with one described route per resource |
| [`src/server.mjs`](src/server.mjs) | Node.js server built on `@addons/addon-server` |

The add-on depends only on `@addons-poc/protocol` and `@addons/addon-server`. It
uses plain ESM JavaScript, has no external runtime dependency, and does not know
the viewer add-on exists.
