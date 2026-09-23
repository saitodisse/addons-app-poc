# Changelog

This file describes, in reverse order, how the project evolved. The quick read shows what changed; the technical details record the affected packages and contracts.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.7.0] - 2026-09-22

### Added

- A control may declare `source: true` when it chooses *which* content to read.
  A result page that already holds the content hides those controls and keeps
  only the ones that change how it is read: the host filters by the declaration
  (`readingSections` in `packages/host-app/src/tab-view.ts`), so it stays free of
  domain rules. The chord viewer marks the **Chart** group and **Data format**.
- With an empty search field the host lists what the active add-ons publish
  instead of showing nothing: the first catalogue each add-on declares, with the
  per-add-on page size, cursor paging, **Previous page** and **Next page**, and
  the `page` parameter in the URL. The table names the mode **Catalogue** and
  every row opens the same dedicated content page as a search result.
- The chord viewer keeps the controls of the group **Current chart** — font size
  and transposition — per chart, under `chords-viewer:song:<id>`, while every
  other control stays global in `chords-viewer:settings`. A chart nobody has
  adjusted opens with the transposition at **zero** and the global font size, so
  transposing one song never follows into the next one, and returning to a song
  brings back what it had.
- The viewer notifies the host when the chart or the controls change
  (`subscribe`), which is how the panel of a page that opened a chart by URL
  shows the controls of that chart. The generic tab record is no longer used by
  this add-on: its values would have been shared by every chart.

### Fixed

- The global search field can be cleared again. The effect that hydrates the
  saved search reacted to the address bar, so clearing the field read the stored
  term back — into the field and into the URL — and the previous search returned.
  It now reads the query the page opened with, once, when the add-ons are ready.
- A single control change reaches the add-on with no wait. The live action now
  runs straight away when the controls have been still for one pause (60 ms,
  `LIVE_PAUSE_MS`), and only a change inside the pause is queued for the rest of
  it: an arrow key or a click applies in 15–21 ms against the 145 ms of the fixed
  pause it replaced. A drag still coalesces, now at 60 ms instead of 120 ms.
- Changing a control of a rendered result no longer waits for the drag to end.
  The live action used to restart its pause on every change, so a dragged slider
  froze the chart until the person stopped, and each change read the content URL
  again from the catalogue and rendered the chart twice. Now the action runs at
  most once per 120 ms with the newest values, the page paints the view that came
  with the response, and the content view provider reads a content URL once and
  hands the chart it read to its own add-on. Measured on the demo chart: a drag
  across 60 values renders 12 views with no HTTP request, against one view after
  the drag and one request per change before.
- The rendered view is inserted through a memoized leaf (`RenderedHtmlView`), so
  a page that re-renders while a control moves no longer drops the chart subtree
  and parses it again on every step.
- The tab state reaches storage after a 400 ms pause instead of on every step of
  a drag, and a write still waiting is flushed when the page goes away.
- The controls of a page open with the values saved in storage. A record read
  after the add-on had already answered used to replace the values on screen, and
  an unmount flushed an empty state over the saved one — which is what left the
  panel of a result page showing the minimum of every slider until a control was
  touched. Storage now only fills the controls the add-on has not reported yet.
- A result page paints a response view only after the provider of the add-on
  accepted the content URL. Without that guard, the add-on restoring its own
  controls on an article page could paint the chart it had open, replacing an
  article the person opened.

### Removed

- The live demo modal and the gear button that opened it in the header. Add-on
  configuration lives only in **Settings**, which is also where an installed
  add-on opens on the detail route `#/addons/<encoded-manifest>`. The modal and
  the sidebar it hosted (`LiveDemoModal`, `AddonSidebar`) are gone, and the home
  page keeps only the search listing.

### Changed

- The header navigation calls the home route **Start**, and the back link of an
  add-on page reads **← Back to start**.
- The chord viewer no longer offers a **Scroll speed** control. It was kept for
  parity with the AC viewer, which stores it without driving any scrolling, so it
  only took a row of the panel.
- The chord viewer no longer offers a capo control, in the panel or in the
  response items. A capo declared by the chart is still reported as a property of
  the chart; the sounding key is not computed from a control the person cannot
  set.
- **Render chart** moved from the **Chart** group to **Options**, next to the
  presets and the restore button, so the source group holds only controls that
  choose the content.

## [1.6.0] - 2026-09-19

### Added

- `@addons/addon-chord-catalog`, an HTTP add-on that lists and searches chord
  charts and delivers them on demand, on port `5295`.
- `@addons/addon-chord-viewer`, an in-process add-on that renders a chord chart
  with controls, on port `5305`.
- A ported copy of `@achorde/tab-renderer@0.8.5` (MIT) inside the viewer add-on,
  with its license and a provenance file, so chord rendering uses the same engine
  as the AC viewer without depending on that project.
- A rendered view in the tab response: `view: { kind: "html", html }` is declared
  in `packages/protocol/src/domain/tab.ts`, validated at runtime, and inserted by
  the host. The text body remains the fallback.
- The four literal presets of the AC viewer, plus controls for font size, line
  height, chord height, block margin, section gap, and section title size.
- Key detection for charts without metadata, and symbol simplification applied
  to the chart text before parsing.
- The rendered chart on a result page is no longer clipped to `70vh` with a
  scroll of its own: it grows to its full height and the document is the only
  scroller, so the wheel moves the page wherever the pointer is and the control
  panel has no scroll to trap it.
- A rendered result now shows the control panel of the add-on behind it, beside
  the chart, and a change made there renders the result again — the shape of the
  AC viewer's version page. The add-on tab and the result page share one
  controller, and the viewer shares one state between its tab and its content
  view, so both always render what the panel says.
- A rendered result uses the whole window, while a prose article keeps its
  readable width. The rendered chart also gained padding around the panel and
  inside it.
- The declarative tab gained three additions: a field may declare its kind
  (`range`, `toggle`, `color`), an action may be `live` and run again while its
  controls change, and a response may return `values` to move the controls it
  rewrote.
- The chord viewer now exposes the whole dial panel of the AC viewer as sliders,
  toggles, and colour pickers, in the same groups as that panel (its current
  chart, reading, chord, lyric, section, and page folders), and the chart
  re-renders while a control moves. The preset and reset buttons move the controls to match.
- The controls of an add-on now live in a panel that stays visible while the
  response scrolls. `contract.ui` fields and actions accept an optional `group`,
  used as the heading of the section that holds them; the viewer declares six.
- A rendered result page: the host asks the service declared by convention as
  `host.content-view` for a view of a search result, so clicking a chord chart
  opens the rendered chart instead of the article layout. Providers that decline
  the URL keep the previous behaviour, which is why Wikipedia results are
  unchanged.
- A structured chart payload with the vocabulary of the AC archive: musical
  work, playable version, chart record with a checksum, sections, and shapes.
- [`docs/CHORD-CHART.md`](docs/CHORD-CHART.md), with the data format, the control
  table, and what was reused from the AC projects.
- Decision 22, recording that the chord-chart add-ons depend on nothing from
  `ac15`, `achorde`, or the AC12 archive, and that the viewer carries a ported
  engine instead of a dependency.

### Changed

- The viewer add-on renders with the ported tab renderer instead of a local
  engine; its bundle now includes React and is around 900 KB unminified.
- In-process add-ons may ship TSX: the bundler used by the `serve` scripts now
  builds with the automatic JSX runtime.
- The tab response body and the plain-text content fallback of the host are
  rendered in a monospace font, because both are preformatted text whose columns
  must line up.
- `pnpm dev`, `pnpm kill-all`, `pnpm dev:addons`, the local manifest shortcuts,
  and the health add-on all include the two new ports.
- The demonstration now has two HTTP add-ons and five in-process add-ons.

## [1.5.1] - 2026-09-14

### Changed

- The repository documentation, host interface, add-on manifests, diagnostics,
  scripts, and tests are now written in English.
- Examples, fixtures, and public-facing messages use consistent English
  terminology while preserving the protocol and supported language options.
- Dependency blocking in the host derives its reason from declared services, so
  it remains compatible with the published protocol package.

## [1.5.0] - 2026-09-13

### Changed

- The global search field now enables native autocomplete and browser history.

## [1.4.0] - 2026-09-12

### Added

- The Wikipedia integration now exposes `content.json` with structured content,
  page metadata, media, URLs, counts, source, duration, request ID, and response
  headers.
- The host records all information exchanged between the host, add-on, and
  Wikipedia API in the browser console and server debug output.
- Wikipedia results now open on a dedicated page with a centered image, title,
  description, summary, and link to the original article.
- Responses for missing articles now return a specific `404` instead of turning
  a missing article into a `500` error.

### Changed

- The Wikipedia descriptor documents the structured endpoints and available
  metadata while keeping `content.txt` compatible with existing consumers.
- The main article view was reduced to essential content; full details remain
  available in JSON and through the debug flow.

## [1.3.1] - 2026-09-10

### Fixed

- Wikipedia search now identifies the client, retries transient `429` and `5xx`
  failures, deduplicates simultaneous calls, and caches each page for 60 seconds,
  avoiding `500` failures after reloading the list.

## [1.3.0] - 2026-09-10

### Added

- Global search now uses `q` and `page` in the URL, allowing the term and current
  page to be restored and shared.
- The table offers **Previous page**, the current page, and **Next page** at
  both the beginning and end of the list.
- Cursor pagination was added to the protocol, HTTP server, host client, and
  Wikipedia search.
- The host opens a result's text content in a modal and shows Wikipedia content
  directly in the description when available.

### Changed

- Navigation replaces the entire result page without accumulating the previous
  page, and preserves visited pages for returning without a new request.
- Wikipedia limits each page to the maximum allowed by the extracts API and the
  total search to 500 records.
- List descriptions are truncated to 140 characters, and their column occupies
  at most half the window width.
- The configurable search limit accepts an empty field and uses 10 by default.

## [1.2.0] - 2026-09-10

### Added

- The live demo now opens and closes through a gear icon in a responsive modal.
- Active extensions now have dedicated dynamic detail and configuration routes.
- Factory reset removes the host's persisted installations, configuration, and
  state after explicit confirmation.

### Changed

- The home page now shows only the main listing; extension details are not
  repeated there.
- The local demonstration was reduced to the maintained add-ons: Markdown,
  Favorites, Health, Local Storage, and Wikipedia.

### Removed

- The Hello, Hello PT, Counter, Aggregator, Session Storage, Debug, Library,
  Web Quotes, and Poems add-ons were removed from the demonstration.

## [1.1.2] - 2026-09-09

### Changed

- The home page now uses all available width and presents the live demo in a
  responsive right sidebar.
- The result table removes the URL column and makes each item's name the link to
  its content.

## [1.1.1] - 2026-09-09

### Changed

- The extension sidebar now shows the search result limit for Library, Quotes,
  Poems, and Wikipedia.
- The sidebar control shares the same persisted configuration as Settings and
  continues applying the limit to the main table.

## [1.1.0] - 2026-09-08

### Added

- A fixed search field at the top of the host, with Enter to search and Esc to
  clear.
- A central result table on every route, including when no add-ons are
  installed.
- Normalization of Web Quotes, Poems, and Wikipedia responses into rows with
  type, ID, URL, name, description, and optional emoji or image.

### Changed

- Active HTTP add-ons that declare `search` are now queried in parallel, with
  isolated failures shown in the table.
- Each search add-on gained a configurable result limit persisted with the
  installation.
- The last query and its rows are persisted by the active `state-store` under
  `host:search:results:v1`.

### Documentation

- Architecture, PRD, phases, decisions, glossary, and READMEs were updated to
  record global search and the remaining work for generic catalog, reading, and
  complete HTTP response validation.

## [1.0.7] - 2026-09-08

### Changed

- The Local Storage and Session Storage tabs now list states automatically when
  opened.
- The JSON panel now appears only for those two providers, and Session Storage
  also allows opening each state's full value.

## [1.0.6] - 2026-09-08

### Fixed

- Counter stopped rereading the old value on every action when the host-mediated
  `state-store` created a new bridge. The `+1` button now preserves successive
  increments after a page reload.
- The add-on gained a regression test simulating host mediation and a dedicated
  test instruction in its README.

## [1.0.5] - 2026-09-08

### Changed

- The add-on is now called **Add-on Health** in the interface and metadata.
- Each result now shows the name obtained from the manifest next to the queried
  address, with a local fallback name when the server does not respond.

## [1.0.4] - 2026-09-08

### Fixed

- Health no longer queries only the four text HTTP servers; it now checks the 14
  demonstration servers, including in-process add-ons.
- The `contract.http` declaration, tab description, and Health tests now use the
  same complete manifest list.

## [1.0.3] - 2026-09-08

### Changed

- The demonstration sidebar now shows named **Activate** and **Deactivate**
  actions for each add-on, making Quotes and Poems activation visible and
  actionable.
- Add-ons whose contract changed now show **Review and activate** and take the
  person to Settings instead of accepting a click that would have no effect.
- Review of a local installation appears directly below the selected add-on,
  receives focus when opened, and switches between **Install** and **Close**.

## [1.0.2] - 2026-09-08

### Documentation

- The current POC state was recorded with 136 passing tests, a passing production
  build, and explicit limits for local verification.
- Planning was corrected to recognize version compatibility and basic cleanup
  after initialization failure as implemented.
- Remaining work for unloading add-ons when deactivating or removing them,
  recovery from cleanup callback failures, and a generic HTTP resource interface
  was detailed.
- Requirements and the order of upcoming work were aligned: lifecycle, HTTP
  experience, priority editing, manifest caching and updates, followed by
  isolation.

## [1.0.1] - 2026-08-24

### Changed

- All workspace consumers, including the host, HTTP server, and add-ons, now
  declare `@addons-poc/protocol@1.0.0` as an npm dependency.
- The lockfile records the published package integrity without local links to
  `packages/protocol`.
- Workspace installation now explicitly allows the newly published version
  during pnpm's package-age verification window.

### Publication

- Public publication of `@addons-poc/protocol@1.0.0` and installation in a clean
  consumer were confirmed.

## [1.0.0] - 2026-08-24

### Added

- `@addons-poc/protocol@1.0.0`, publicly published to npm under the MIT license.
- Contract v1 with JSON Schema, SemVer range, capabilities, namespaced
  descriptors, method schemas, UI, state, HTTP, and logs.
- `host.services.use(contract)`, the optional official `state-store`, and
  blocking for incompatibilities, required dependencies, and cycles.
- Loader, registry, status, and adapter runtime moved to the host.
- ADR 0001 and protocol packaging validation.
- The Settings screen now lists the 14 local manifests with titles, descriptions,
  and actions to copy or start installation.

### Changed

- All add-ons and the host directly depend on `@addons-poc/protocol`.
- All manifests use only `contract`; the legacy parser was removed.
- Example services use namespaced identifiers.
- The loader accepts relative paths only in the bundle's internal manifest, using
  the public manifest URL as the canonical `entrypoint`.
- `pnpm dev` and `pnpm kill-all` cover all executable projects and their ports,
  with synchronization comments between the scripts.

### Documentation

- Each package gained its own README with responsibility, contract,
  dependencies, ports, commands, and limits.
- `docs/PACKAGES.md` became the operational index, and the central guides now
  point to it.

## [0.4.1] - 2026-08-23

### Documentation

- Documentation now describes the delivered URL-based installation path,
  contract review, and persistence of choices after reloading the page.
- Remaining limits were corrected to highlight the absence of caching, updates,
  transactional unloading, version negotiation, and code isolation.
- Requirements and phases now record dedicated routes, new review of changed
  contracts, and host mediation of declared interactions.

## [0.4.0] - 2026-08-23

### Added

- Each manifest now declares a complete interaction contract: services, fields,
  actions, inputs, outputs, state, HTTP, and logs.
- Installations now show a readable explanation and the full manifest JSON in a
  terminal-style expansion below the add-on.
- The host includes local-state, session, and debugging add-ons to demonstrate
  where each value is stored and which effective provider serves it.
- The `json-highlighter` viewer was integrated into the host without highlighting
  paths or opening a modal.

### Changed

- The host validates the contract before activating an add-on, restricts
  services and action inputs to what was declared, and requires new acceptance
  when the remote contract changes at the same URL.
- The four HTTP servers now transparently declare incoming resources, returned
  data, and external calls.
- The specification, architecture, decisions, glossary, and domain context
  were updated to record protocol `contract` 1.0.0 and its observable limits.

## [0.3.0] - 2026-08-20

### Documentation

- The technical and introductory versions were consolidated into one progressive
  documentation set.
- Each subject now starts with the problem and overview before presenting
  contracts, flows, and limitations.
- Decisions previously gathered in the former planning document now form
  `docs/DECISIONS.md`.
- Outdated references were aligned with current code behavior.

### Added

- A hash-based routing foundation with no external dependency for future
  host-owned URL navigation.
- A Docker configuration to run the OpenViking service locally.

### Changed

- The temporary `temp/` directory is now ignored by Git.

## [0.2.0] - 2025-08-19

This version expanded the demonstration: in-process add-ons began composing
services, and a fourth remote server brought Wikipedia content.

The names `textFormatter`, `searchProvider`, `healthCheck`, and **Extras** below
describe that version's historical implementation. In v1, services are
namespaced (`addons.markdown.text-formatter`, `addons.aggregator.search-provider`,
and `addons.health.health-check`), and each domain remains in its own package.

### Added

- `@addons/addon-markdown`, then identified as `textFormatter`, for Markdown and
  HTML.
- `@addons/addon-aggregator`, then identified as `searchProvider`, with
  failure-tolerant parallel search.
- `@addons/addon-favorites`, with the `addons.favorites` service and optional
  `state-store` persistence.
- `@addons/addon-health`, then identified as `healthCheck`, for availability and
  latency.
- `@addons/addon-text-wikipedia`, on port `5294`, with searches and summaries
  obtained from Wikipedia APIs.
- Formatting, favorites, and bookmark-storage helpers kept in their own
  add-ons.
- Infrastructure services registered by the host with `addonId: "host"`.
- The **Extras** area in the host, with formatting, aggregated search, favorites,
  and server-health demonstrations.

### Changed

- `pnpm dev` now also starts the Wikipedia server.
- The host `tsconfig.json` now uses `noEmit`, avoiding generated JavaScript next
  to TypeScript files.
- Documentation now includes composition between add-ons and services provided
  by the host.
