# Changelog

This file describes, in reverse order, how the project evolved. The quick read shows what changed; the technical details record the affected packages and contracts.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

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
