# Chord charts: listing, rendering, and editing

**Status: Delivered · Three independent add-ons**

This document explains the add-ons that publish, render, and edit chord charts,
the data format they exchange, and the controls the viewer offers. It also records
what was reused, in concept, from the AC projects (`ac15`, `achorde`, and the
AC12 archive), and what was deliberately left out.

## Why

A chord chart — a *cifra* — is text a musician reads while playing: chord lines
above the lyric line, section titles between brackets, and instrumental
annotations in parentheses. The text is convenient to write and hard to compute
with: a person cannot transpose it, reflow it, or draw the shapes from it
without an engine.

The POC needed a domain that is rich enough to prove three things at once:

1. an HTTP add-on can publish a real catalogue with listing, search, and
   two-stage content delivery;
2. an in-process add-on can render structured data with many controls through a
   declarative interface;
3. independent add-ons can collaborate through the public protocol and manifest URLs
   without importing each other.

## What

There are three add-ons, with one responsibility each:

| Add-on | Format | Responsibility |
| --- | --- | --- |
| `@addons/addon-chord-catalog` | HTTP server, port `5295` | Lists, searches, and delivers chord charts and their shapes |
| `@addons/addon-chord-viewer` | in-process, port `5305` | Reads a chart and renders it with controls |
| `@addons/addon-chord-editor` | in-process, port `5309` | Edits text with Monaco and saves local drafts |

The catalogue owns the published data. The viewer owns rendering. The editor
owns local drafts. The editor requires the viewer service, so the host always
initializes the renderer before the editor even when their saved manifest order
is reversed. Provider priority only selects between multiple implementations
of the same service. The catalogue also supplies artist portraits and song,
album, and first-release metadata for its listing. The add-ons communicate
through HTTP content URLs and declared services, so none imports another
implementation and each can be replaced.

The host stays generic: it queries `search`, renders the viewer's response, and
asks an optional `host.content-editor` service whether the opened result has an
editor. No host code knows what a chord is.

The catalogue rows supply three display fields: **Artist**, **Song**, and
**Album · First released**. The artist field carries its own portrait image;
the song title remains the link to the chart. The host uses these provider
labels and values generically, and retains its standard columns for rows whose
provider does not supply a matching field set.

## How

### The chart text format

The text follows the notation used by the AC archive: a chord line above its
lyric line, section titles between square brackets, chord-only lines, and
parenthesised annotations.

```text
[Intro]
(G / D/F# / Em / C) - 2x

[Verse 1]
G                 D/F#
Rows of lanterns on the pier
Em                    C
Salt and diesel in the air
```

The parser accepts the variations found in the archive:

| Element | Accepted forms |
| --- | --- |
| Section titles | Any short name between brackets, in any language: `[Intro]`, `[Chorus]`, `[Solo]`, `[Outro]` |
| Chord lines | Any line with more chord tokens than lyric tokens |
| Chord-only lines | `G   D   Em   C`, used for intros and solos |
| Annotations | `(G / D / F#) - 2x`, `( Bm   D   G )` |
| Extensions | `7M`, `maj7`, `Maj7`, `M`, `m7`, `mmaj7`, `m7(b5)`, `dim`, `º`, `aug`, `sus4`, `add9`, `6`, `9` |
| Inversions | `D/F#`, `C/G`, `E7/G#` |
| Slash extensions | `D7/9`, `C6/9` — a number after the slash is an extension, not a bass |
| Repeats | `/` and `%` |
| Decoration | `(Bm  A7)` keeps the parentheses around a group of chords |

Words that only start like a chord stay lyric words: `Eu`, `De`, `Com`, and
`Amor` are rejected by the grammar because `m` and `M` only count as a quality
when no letter follows them.

### The engine is a ported tab renderer

The viewer does not reimplement chord rendering. It ships a **ported copy** of
`@achorde/tab-renderer@0.8.5` (MIT), the same engine the AC viewer uses, inside
`packages/addon-chord-viewer/src/tab-renderer`. `PROVENANCE.md` in that directory
records the origin, the version, what was ported, and what was left out; the
original license travels with the copy.

The pipeline is the one of that engine:

```text
rawText ──parseTab──► ParsedTab ──transposeParsedTab──► ParsedTab
        ──prepareSongFromParsedTab──► PreparedSong (barList)
        ──buildTabNodes──► React nodes ──renderToStaticMarkup──► HTML
```

The parse is column-based, exactly like the source: every token carries
`startColumn` and `endColumn`, and a chord is drawn above the lyric line with
`position: relative` plus a negative right margin, not by rewriting the text.
The port keeps `parserVersion` and `astVersion` at `2.2.2`.

The port left out the legacy path that depends on `@tonaljs/tonal`
(`prepareSong`, `splitSections`, `pairLines`, the `transposer` folder) because
the rendered pipeline does not use it. A parity test file compares the ported
behaviour against the cases documented by the source project.

### The rendered view

The add-on returns an HTML view built from the React component, and the host
inserts it inside the tab:

```json
{
  "status": "success",
  "body": "Harbor Light — Mare Alta\nkey G · playing G …\n\n[Intro]…",
  "view": { "kind": "html", "html": "<pre data-tab-root …>" }
}
```

`body` stays the preformatted text of the chart, so a host that does not render
the view still shows something readable. `items` keeps carrying the control
values. The host does not interpret the markup and does not sanitize it: an
in-process add-on already runs in the host page, so a rendered view adds no new
privilege. This is the only protocol change the viewer needed, and it is
declared in `packages/protocol/src/domain/tab.ts`.

### The controls

The panel beside the chart carries the same configuration as the dial panel of
the AC viewer, with the same names and the same groups. A control is declared as
a `range`, a `toggle`, or a `color`, and the host renders the matching input; the
action marked `live` renders the chart again by itself while a control changes,
which is what makes a dragged slider update the chart.

The host keeps two rules for a live action: it runs at most once every 60 ms, and
it never restarts that pause while a control keeps moving. A queued run reads the
newest values, so the chart follows the drag instead of waiting for the person to
stop. A change that arrives when the controls have been still for one pause runs
straight away, so a single adjustment — an arrow key, a click on a toggle — costs
no wait at all.

Changing one control costs one render of the add-on and one insertion of HTML in
the page:

| Step | What happens |
| --- | --- |
| Control moves | The panel writes the value into the state of the page |
| Now, or after the rest of the pause | The host runs the `live` action with the values on screen |
| Add-on | Renders the chart from the chart it already holds — no HTTP request |
| Page | The response carries the rendered view, so the page inserts it |

Nothing else repeats: the content URL is read once, when the page opens, and the
view is a memoized leaf, so the document receives HTML only when the add-on
publishes a different one. Measured on the demo chart: one adjustment of the font
size reaches the page in 15–21 ms, and dragging it through 60 values renders 28
views in 1,6 s, sends no request at all, and produces no main thread task longer
than 50 ms (before: one view per step of the drag, each after a round trip to the
catalogue, and the chart froze until the drag ended).

The pause is `LIVE_PAUSE_MS` in `packages/host-app/src/tab-view.ts`. It trades
smoothness against load: every run costs one render of the add-on and one
insertion of HTML, measured at about 15 ms for this chart. Raising it to 120 ms
halves the work during a drag; lowering it to 30 ms doubles it, at the risk of
frames dropped while the pointer moves.

| Group | Controls |
| --- | --- |
| Chart | Catalogue URL, chart identifier, pasted text; Load chart, List charts (all marked as source) |
| Current chart (`cifraAtual`) | Font size, Transpose |
| Reading (`leituraGlobal`) | Extended layout, Show chords, Line height |
| Chords (`acordes`) | Chord colour, Chord height, Block margin |
| Lyrics (`letras`) | Lyric colour |
| Sections (`secoes`) | Section gap, Title colour, Title size |
| Page (`page`) | Page colour |
| Presets | Light, Dark, Lyrics light, Lyrics dark |
| Options | Simplify chords, Summary, Data format, Render chart, Restore defaults |

A control that chooses *which* content to read is declared with `source: true`:
the three fields of the **Chart** group, **Load chart**, **List charts**, and
**Data format**, which prints the model of whatever chart is open. A page that
already holds the content — the result page reached from a search — hides those
controls, so its panel shows only what changes how the chart is read: the
**Chart** group disappears there and the **Data format** button with it. The
**Render chart** and **Restore defaults** buttons stay, because they act on the
chart that is already open.

### Where the controls are kept

The panel opens with the values kept in storage, and the store is split in two:

| Record | Key | Controls |
| --- | --- | --- |
| Global | `chords-viewer:settings` | Layout, colours, sections, page, and options — how the person reads, in every chart |
| One per chart | `chords-viewer:song:<chart id>` | Font size and transposition — the group the AC viewer calls the current chart |

A chart nobody has adjusted opens as written: the transposition starts from
**zero** while the font size falls back to the global preference. Transposing one
song therefore cannot follow into the next one, and returning to a song brings
back what it had. The record of a chart is read once, when the chart reaches the
screen, and written when a control of that chart moves.

The table is the group **Current chart** of the panel: the fields listed there
are the ones stored per chart (`SONG_FIELDS` in
`packages/addon-chord-viewer/src/settings.ts`). Adding a control to that group
makes it per chart on its own.

The panel itself always reads the add-on, which is what knows which controls
belong to the chart on screen: the add-on reports the controls in use with every
response and notifies the host whenever the chart or the controls change. A
record restored from storage only fills the controls the add-on has not reported
yet, so a late or empty record cannot leave the panel out of step with the chart
beside it.

The four presets are the literal values of the AC viewer, so a chart can be
compared between the two projects. A preset returns the values it rewrote, and
the host moves every control it changed — which is how a preset reaches the
sliders the person sees.

### The catalogue payload

`content.json` publishes the chart with the vocabulary of the AC archive: a
musical work, a playable version, the chart record, the sections, and the shapes.

```json
{
  "id": "harbor-light",
  "title": "Harbor Light",
  "musicalWork": { "title": "Harbor Light", "artistName": "Mare Alta", "composers": ["Ana Reis"] },
  "playableVersion": { "id": "harbor-light-original", "key": "G", "capo": 0, "tempo": 96, "time": "4/4" },
  "notation": { "format": "chord-over-lyrics", "sectionMarkers": "square-brackets" },
  "chordChart": {
    "id": "harbor-light-chart",
    "playableVersionId": "harbor-light-original",
    "rawFormat": "chord-over-lyrics",
    "rawText": "[Intro]\n(G / D/F# / Em / C) - 2x\n...",
    "rawTextChecksum": "0f71a404…",
    "sourceKey": "G",
    "parserVersion": "1.0.0",
    "verifiedStatus": "community"
  },
  "sections": [{ "title": "Intro", "line": 0 }],
  "chords": [{ "symbol": "G", "frets": "320003", "fingers": "210003", "position": 1 }],
  "content": { "text": "…", "lineCount": 51, "contentType": "text/plain" },
  "source": { "provider": "addon-chord-catalog", "license": "MIT" },
  "observability": { "requestId": "…", "durationMs": 0 }
}
```

The shape of `content`, `source`, and `observability` follows the Wikipedia
add-on, so both add-ons are read the same way by the host and by the viewer.

### Local editing and cross-add-on conversation

The editor reads a chart's `content.json`, presents its original text in
Monaco, and asks the viewer's `addons.chords.viewer.render` service to produce
the live preview. Monaco assets come from the editor's own server, not the
host. If Monaco is unavailable, the text area still allows an edit.

The **Save local draft** action writes through `state-store`. The saved record
contains the full source URL, edited text, and checksum of the published text.
The viewer can read it through `addons.chords.drafts.get`. It overlays the draft
only while that checksum matches; when the source changes, the editor warns
about the old base and the viewer keeps the published chart. **Discard draft**
removes the local record. None of these actions changes the HTTP catalogue or
publishes the revision to another person.

The host only knows the optional `host.content-editor` convention: it asks
`supports({ url, type, name })`, displays **Edit** if accepted, and mounts
the markup returned by `render`. The service boundary, rather than direct
package imports, lets the three add-ons work together without knowing one
another's implementation. See [ADR 0002](adr/0002-independent-chord-editor.md)
for the trade-offs.

### What was reused, and what was left out

The chord demonstration was designed after reading the AC projects. The viewer
contains a documented, MIT-licensed port of the renderer, but no package imports
an AC project. The editor follows the concept of a Monaco editing surface
without copying an AC editor implementation.

| Reused concept | Where it comes from | How it appears here |
| --- | --- | --- |
| Chord-over-lyrics text with `[sections]` and `(...)` annotations | AC12 `tabs.body` in the archive export | The catalogue data set and the parser |
| Chord grammar, including `7M`, `º`, `m7(b5)`, and slash extensions | `@achorde` chord symbol parser, used by `ac15` | `engine/chord-symbol.ts` |
| Guard against lyric words that start like a chord (`m(?![a-z])`) | Same parser | Same file, with tests |
| Semitone table for root and bass, quality left untouched | `transposeChordSymbol` in `@achorde/tab-renderer` | `transposeChordSymbol`, plus a spelling mode |
| Line pairing by token counting, decoration in parentheses | `parseTab` and `tokenizeContentWord` in `tab-renderer` | `tokenizeLine`, `classifyLine`, `anchorChords` |
| Aligning a chord line with the line below it | `alignLines` in `tab-renderer` | The ported `alignLines` runs unchanged |
| Bars/cells as the render unit | `generateBarList` in `tab-renderer` | The ported `generateBarList` runs unchanged |
| Column-based overlay of a chord above its lyric | `chordSpanStyle` in `tab-renderer` | The ported React components render the chart |
| Four presets with literal colours and sizes | `viewer-dialkit-presets.ts` in `ac15` | `VIEWER_PRESETS` in `src/settings.ts` |
| Key detection from the chords | `ac15/chord-engine` | `inferKey`, from the first chord |
| Ported engine instead of a rewrite | `@achorde/tab-renderer@0.8.5` | `src/tab-renderer/**` with its license and provenance |
| Viewer settings and their ranges | `ac15/contracts/viewer.ts` (`UserSettings`, `PlayableVersionSettings`) | `ViewerSettings` with the same names |
| Chord shapes as `frets`, `fingers`, `position` | AC12 `chords` records | `data/voicings.js`, published inside `content.json` |
| Chart record with checksum and parser versions | `ac15/domain` (`ChordChart`) | `chordChart` inside `content.json` |
| Two-stage delivery: metadata first, content on demand | `ac15` viewer load, and decision 14 of this POC | `text` resource plus `content.txt`/`content.json` |

Deliberate differences, all of them recorded because they change behaviour:

| Decision here | Reason |
| --- | --- |
| Charts are original demo data, not the AC archive | The archive is licensed content and belongs to another project; see [decision 22](DECISIONS.md#22-the-chord-chart-add-ons-are-independent-of-the-ac-projects) |
| The engine is copied instead of depended on | The two projects must stay independent; the copy carries its license and provenance |
| The rendered view travels in the response | The host renders text responses only, so the protocol declares an explicit `view` field |
| The add-on returns HTML instead of mounting React itself | The host keeps owning the page and the layout, and the response stays serializable |
| No scroll speed, no ASCII diagrams, no grid layout | The view is HTML now, so the window and the text tricks are unnecessary; chord diagrams would need a canvas library that is out of scope |

### Limits

* The bundled catalogue holds eight demo charts; downloaded charts are kept
  separately by source in the device library.
* Only the `chord-over-lyrics` family is parsed. Tablature lines are treated as
  lyric text and never as chords.
* A section title sharing its line with content produces a warning and the
  content on that line is ignored.
* Chord diagrams are not drawn in the rendered view: they would need a canvas or
  SVG library, which is out of scope here. The catalogue still publishes the
  shapes, and the summary lists them.
* The rendered view is HTML produced by the add-on; a host that does not support
  the `view` field shows the text body instead.
* `personal` classification marks the pasted text, because a person may paste
  anything; the catalogue data is `public`.

## How to try it

```bash
pnpm dev
```

Then, in the host at `http://localhost:5280`:

1. In **Settings**, install `http://localhost:5295/manifest.json` (catalogue) and
   `http://localhost:5305/manifest.json` (viewer).
2. Type `lantern` in the search field: the catalogue answers with rows.
3. Click any result name: the dedicated page shows the rendered chart. Open the
   panel beside the chart to change how it is read. The controls that choose the
   content live in the viewer tab: keep the catalogue URL, press **List charts**,
   copy an identifier into **Chart**, and press **Load chart**.
4. Use the controls: transpose, output, layout, font, line height, chord height,
   section spacing, and the four presets of the AC viewer.
5. Press **Data format** to see the model another add-on would consume.

Only the catalogue is needed to see the listing and the search. Only the viewer
is needed to render a chart, and it accepts a pasted chart text as well.

## Source Catalog imports

**Status: Delivered**

### Why

The demonstration catalogue has a fixed collection. Configurable sources let a
person build a library of charts and read them when the sources are unavailable.

### What

Settings offers a textarea with one Source Catalog root URL per line. Each
source can contain multiple artists and their charts. A manual **Update
catalogue** action downloads and verifies the source files, then saves its charts
in a persistent library on this device. Search and reading work offline,
including charts that have not been opened individually before going offline.
The POC assumes that all songs are licensed and does not make licensing a gate.

### How

The importer reads `source-manifest.json`, verifies each declared NDJSON file
against its SHA-256 checksum, then connects artists, musical works, playable
versions, and chart text. Each source snapshot is replaced only after a complete
successful import. An error preserves that source's last successful snapshot.
Duplicate source URLs are ignored; different source records remain separate
chart variants. Removing a URL stops future updates and keeps its downloaded
charts. **Delete downloaded source** removes one source explicitly; clearing site
data in the browser also removes the library.

The catalogue add-on stores source snapshots in IndexedDB and answers the same
generic catalogue, search, and content URLs from the browser. The host renders
its declared **Settings** control group and routes declared resource URLs to
local providers without importing an add-on. The production host build includes
a service worker that caches the application shell and installed add-on bundles.
Source hosts must permit cross-origin browser requests. See
[the browser-owned library decision](adr/0003-browser-owned-source-catalog-library.md).

For offline use, serve a production build from the same stable HTTP(S) origin:

```bash
pnpm build:host
pnpm --filter @addons/host-app exec vite preview --host 0.0.0.0
```

Install the catalogue and viewer while online, configure a source URL, then press
**Update catalogue** before going offline. The development server does not
register the production service worker. For the local Artist Portal, copy its
Source Catalog root URL, currently `http://localhost:5287/source-catalog/`, into
the catalogue settings; a deployed portal can use another base path.
