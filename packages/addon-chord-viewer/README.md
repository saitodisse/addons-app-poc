# `@addons/addon-chord-viewer`

An in-process add-on that renders chord charts with controls. It provides
`addons.chords.viewer` `1.0.0`.

The rendering engine is a **ported copy** of `@achorde/tab-renderer@0.8.5`
(MIT); see [`src/tab-renderer/PROVENANCE.md`](src/tab-renderer/PROVENANCE.md).

## Why it exists

Reading a chart is more than printing text: a person changes the key, adds a
capo, hides the lyrics, narrows the line, or wants the shapes. This add-on
proves that a rich, interactive capability fits in the declarative tab response
of the protocol, without the host learning anything about music.

## What it offers

The **Chord viewer** tab loads a chart and renders it. It reads charts from a
catalogue through the manifest URL of that catalogue — the same two-stage flow
the host uses — or from text pasted by hand.

The panel groups follow the dial panel of the AC viewer:

| Group | Controls |
| --- | --- |
| Chart | Catalogue URL, chart, pasted text, and the four buttons |
| Current chart | Font size, transpose, capo (sliders) |
| Reading | Extended layout, show chords (toggles), line height, scroll speed (sliders) |
| Chords | Chord colour (colour), chord height, block margin (sliders) |
| Lyrics | Lyric colour (colour) |
| Sections | Section gap, title size (sliders), title colour (colour) |
| Page | Page colour (colour) |
| Presets | The four literal presets of the AC viewer |
| Options | Simplify chords, summary (toggles), restore defaults |

The `apply` action is declared `live`, so the host renders the chart again while a
control changes. A preset returns the values it rewrote, and the host moves the
controls to match.

The response carries the chart twice: `body` is the chart text, so any host can
show it, and `view` is the HTML built from the React component, which the host
inserts inside the tab. The controls declare their `group`, so the host shows
them in sections inside its fixed control panel.

The tab also consumes the optional `state-store`: the controls and the loaded
chart survive a reload when a storage add-on is active, and stay in memory when
it is not.

## Rendered result page

The add-on also provides the service the host asks for a rendered result:
`host.content-view`, with one method, `render({ url, type, name })`. It reads the
chart behind the content URL and returns the same HTML as the tab, using the
controls the person already chose. A URL whose payload does not declare the
`chord-over-lyrics` notation is declined, so results from other add-ons keep
their own layout.

When `addons.chords.drafts` is available, the result page may show a local
draft saved by the independent chord editor. The viewer accepts it only when
its recorded source checksum matches the published chart; otherwise the
published chart remains visible and the editor warns about the conflict.

## How to run and test

```bash
pnpm --filter @addons/addon-chord-viewer test
pnpm --filter @addons/addon-chord-viewer serve
```

The manifest is at `http://localhost:5305/manifest.json`. In the tab, keep
`http://localhost:5295` as the catalogue URL, press **List charts**, copy an
identifier into **Chart**, and press **Load chart**.

## How it is organized

| File | Responsibility |
| --- | --- |
| [`src/tab-renderer/`](src/tab-renderer/PROVENANCE.md) | Ported engine: parser, transposition, preparation, React components |
| [`src/render-chart.tsx`](src/render-chart.tsx) | Renders one chart to HTML and reports its summary |
| [`src/service.ts`](src/service.ts) | The `addons.chords.viewer` service (`parse`, `render`) |
| [`src/content-view.ts`](src/content-view.ts) | The `host.content-view` provider used by the host result page |
| [`src/chart-transform.ts`](src/chart-transform.ts) | Symbol simplification and key detection |
| [`src/settings.ts`](src/settings.ts) | Control values, limits, presets, and descriptions |
| [`src/catalog-client.ts`](src/catalog-client.ts) | HTTP client for the catalogue routes, with injectable `fetch` |
| [`src/state.ts`](src/state.ts) | Settings and chart persistence through `state-store` |
| [`src/tab-definition.ts`](src/tab-definition.ts) | One definition of the fields and actions, shared with the manifest |
| [`src/manifest.ts`](src/manifest.ts) | Contract v1: service, state, outgoing HTTP, logs |
| [`src/index.ts`](src/index.ts) | `setup` and `createTab` |

The add-on depends on `@addons-poc/protocol`, `react`, and `react-dom` (used
only to render the view to static markup). The rendering service is registered
during setup and consumed by the tab through `host.services.use`, so every call
is validated by the contract proxy. Another add-on may consume the same
identifier without importing this package.

The bundle includes React and the ported engine, so it is around 900 KB
unminified. That is the cost of rendering a real component from inside the
add-on; the catalogue add-on stays dependency-free.
