# Project phases

Building an extensible system all at once would hide too many risks. That is why the POC grows in steps: each phase answers one question and leaves a verifiable demonstration.

The states used here are **Planned**, **In Progress**, **Delivered**, **Partial**, **Deactivated**, and **Replaced**.

The current state of the packages is detailed in [`PACKAGES.md`](PACKAGES.md). Phases 1 through 6 preserve the POC's history; when an old name appears in them, it is historical and is no longer a public API.

## Journey map

| Phase | Main question | State |
|---|---|---|
| 1. Foundation | Can a host receive services from add-ons? | Delivered |
| 2. Replacement | Can an alternative take over after a failure? | Delivered |
| 3. Servers | Can an add-on live outside the host process? | Partial |
| 4. Composition | Can add-ons form larger capabilities without direct imports? | Delivered |
| 5. Management and compatibility | Can a user install and control remote add-ons? | Partial |
| 6. Isolation | Can untrusted code be safely limited? | Planned |
| 7. Public protocol | Can the contract be published and used by independent hosts? | Delivered |

"Partial" in phase 3 means that the HTTP format and generic search are
delivered, while catalog, reading, caching, updating, and complete response
validation are not. SemVer negotiation and the capability profile were delivered
in phase 7.

## Verification on 2026-09-08

This record separates the already demonstrated foundation from the work needed to continue the experiment. The overall state remains **Partial**: the public protocol and URL installation are delivered, but the lifecycle and HTTP experience still need to be completed.

The verification used commit `09ac6da`, POC version `1.0.1`, with consumers of `@addons-poc/protocol@1.0.0` through npm. Before this documentation update, the checkout was on the `master` branch with no local changes.

Version `1.0.2` consolidates this documentation review. The commands below were repeated while finishing that version with the same results; the protocol remains at `1.0.0`.

| Verification performed | Result |
|---|---|
| `pnpm test` | 136 tests passed in 24 files; includes the host-boundary check and protocol build |
| `pnpm build:host` | TypeScript, boundary check, and production build passed |
| Loader and installation-management inspection | Confirmed basic cleanup after `setup` failure, absence of complete unload, and an informational-only tab for manifests without `entrypoint` |

There was no new browser visual check, npm query, or Git remote check. Protocol publication and clean-consumer testing belong to the delivery recorded on 2026-08-24 in the [changelog](../CHANGELOG.md).

To reproduce the manual demonstration, run `pnpm dev`, open `http://localhost:5280`, and install `http://localhost:5301/manifest.json` in **Settings**. Review and accept the contract, open the Hello tab, and reload the page. The expected result is that the installation remains available. This flow was not executed in this verification.

## Management interface verification on 2026-09-08

### Why

The sidebar showed an unlabeled switch, and the row-selection button was disabled for inactive add-ons. When the stored contract was outdated, clicking the switch also did not explain that a new review was required.

### What

Version `1.0.3` makes the actions visible: ready add-ons show **Activate** or
**Deactivate**; pending contracts show **Review and activate** and send the
person to **Settings**. Review of a URL installation remains open next to the
selected add-on, receives focus, and switches between **Install** and **Close**.

### How

With `pnpm dev` running, the verification opened an add-on route, checked the Web Quotes and Poems buttons, disabled and re-enabled each one, and simulated an old contract fingerprint. The first flow ended in `Active`; the second showed **Review and activate** and navigated to `#/settings`.

## Health list verification on 2026-09-08

### Why

The Health tab still used a historical list of four HTTP servers, although `pnpm dev` starts 14 servers in the demonstration.

### What

Version `1.0.4` centralizes the list of 14 local manifests in the Health add-on and uses the same list in code, the HTTP contract, the tab description, and tests. The response shows each server with its latency or error.

### How

At `#/addons/http%3A%2F%2Flocalhost%3A5307%2Fmanifest.json`, the **Check now** action was run with the demonstration servers active. The result changed from `4/4 online` to `14/14 online` and displayed 14 state rows.

## Health list identification verification on 2026-09-08

### Why

Results showed only the address, which made it difficult to recognize which add-on answered on each port.

### What

Version `1.0.5` renames the tab **Add-on Health**. Each row shows the name read from the manifest and the queried address, as well as state and latency; when a server does not respond, the list uses the demonstration's known name.

### How

After running **Check now** on the Health add-on route, the list was checked for all 14 servers. Each row showed a distinct name and its `http://localhost:<port>` address.

## Global search verification on 2026-09-08

### Why

Search resources already existed on the HTTP servers, but the host offered only
informational tabs. A single entry point was missing for querying active
extensions and comparing their responses.

### What

Version `1.1.1` fixes a search field in the header and keeps a result table at
the beginning of every route, including when there are no extensions. Enter
queries add-ons that declare `search`; Esc clears the field and table. Web Quotes,
Poems, and Wikipedia appear in the same list with type, ID, URL, name,
description, and emoji. Each search extension has a configurable limit in
Settings and the extension sidebar. When Local Storage or Session Storage is
active, the query and rows are saved by `state-store`.

### How

With `pnpm dev` running, Web Quotes (`5292`), Poems (`5293`), Wikipedia (`5294`),
and Local Storage (`5308`) were installed. The `life` search showed rows from
all three add-ons; an isolated source failure remained visible without removing
the other responses. Each add-on's limit appeared in Settings, the `brazil`
query was found in `addons:state:host:search:results:v1`, and Esc cleared the
field and table. The `life` search was repeated to confirm Web Quotes, Poems,
and Wikipedia rows in the real flow. `pnpm test` passed with 142 tests in 26
files, `pnpm build:host` produced the production build, and the boundary check
confirmed that the host does not depend on concrete add-ons.

## Home layout verification on 2026-09-09

### Why

The table and live demo split the width into a vertical sequence, making the main listing smaller than necessary and repeating the URL as a wide column.

### What

Version `1.1.2` makes the home page use all available width. The table stays in
the main column, and the live demo moves to a narrower right sidebar; below 900
px, both areas stack. The `URL` column was removed from the presentation, and
each row name opens its content URL.

### How

With `pnpm dev` running, the home page was checked in desktop and mobile
viewports. On desktop, results filled the main column and the demo stayed on the
right; on mobile, the demo appeared below without narrowing the table. The first
row confirmed the name hyperlink and the absence of the `URL` header. `pnpm test`
passed with 142 tests in 26 files, and `pnpm build:host` produced the production
build.

## Wikipedia pagination verification on 2026-09-10

### Why

Wikipedia's search API allows many matches, but the extracts API limits how many articles can be completed in one response. Without a cursor-based page, the host was stuck with the provider's first response.

### What

The public protocol now accepts `limit` and `cursor` in the request and returns
optional `pagination.limit`, `pagination.total`, and `pagination.next`. The
shared server forwards these parameters; the host stores one cursor per add-on
and offers **Previous page** and **Next page**. While navigating, the table shows
only the current page. Wikipedia uses `list=search` with pages of up to 20
articles, completes each page with `exlimit=20`, and enforces a total limit of
500 records.

### How

`GET /search/page/Ball.json?limit=500` returned 20 metas, `total: 500`, and
`next: "20"`; the next page did not repeat the first. On the home page, the
`Forest bathing` search showed the extract in the **Description** column,
opened content in the modal through the meta link, and **Next page** replaced
the 20 rows with the next page. **Previous page** restored the initial page
without new accumulation. It was also confirmed that `limit=999` remains
limited to 20 items per page.

## Counter persistence verification on 2026-09-08

### Why

The `+1` button returned to `1` after a page reload. The state was in
`localStorage`, but the next `state-store` query was treated as a new restoration
when the host created another mediation bridge.

### What

Version `1.0.6` makes restoration idempotent during each Counter instance's
lifetime. The add-on restores the value once when it finds a provider, keeps the
value in memory for later actions, and saves each updated result. The package
test simulates a new bridge on every query to protect this flow.

### How

With `pnpm dev` running, route
`#/addons/http%3A%2F%2Flocalhost%3A5303%2Fmanifest.json` was opened with Counter
and Local Storage active. After reloading, the `+1` button was pressed and
showed `3` from a persisted value of `2`, leaving
`addons:state:counter:value` at `3`. `pnpm --filter @addons/addon-counter test`
and the host build also passed.

## State inspection verification on 2026-09-08

### Why

The JSON details panel appeared on every tab, although only storage providers
offer a list of states to inspect. The session tab also did not load its states
automatically or expose complete values to the host.

### What

Version `1.0.7` limits the `json-details-card` panel to the `storage-local` and
`storage-session` add-ons. Both tabs use `getSnapshot` to list states as soon as
they open, and each session item now carries `details`, as Local Storage already
did.

### How

At routes `#/addons/http%3A%2F%2Flocalhost%3A5308%2Fmanifest.json` and
`#/addons/http%3A%2F%2Flocalhost%3A5309%2Fmanifest.json`, states appeared without
pressing **View states**. An item opened JSON with `localStorage` and
`sessionStorage` headers; on the Counter route,
`document.querySelector('#json-details-card')` found no panel. Tests for both
providers and the host build passed.

## Phase 7 — Public protocol v1

**State: Delivered**

### Why

A contract mixed with the runtime prevents publication and compatibility between hosts.

### What was delivered

- `@addons-poc/protocol@1.0.0`, MIT, with ESM, types, and JSON schema, published to npm;
- one `contract` v1 section in every manifest;
- capabilities, SemVer, namespaced descriptors, and official `state-store`;
- `host.services.use(contract)` proxy and runtime validation;
- loader, registry, status, and adapters internal to the host;
- blocking for incompatibilities, required dependencies, and cycles;
- ADR 0001 and aligned documentation.

The package was queried in the registry with `npm view` and installed in a clean
consumer. Workspace consumers now use the published version, recorded in the
lockfile with its integrity.

### How to verify

Run `pnpm check:host-boundary`, `pnpm test`, `pnpm build:host`, `npm pack --dry-run`
in the protocol package, and `npm view @addons-poc/protocol@1.0.0`. For a new
version, publish only with the organization's account and confirm installation
in a clean consumer.

## Phase 1 — The foundation

**State: Delivered**

### Why it came first

Before thinking about networking or sandboxing, the most basic conversation had to be proven: an add-on provides a capability, the host finds it, and uses it.

### What was delivered

- add-on manifest and instance;
- `HostAPI` with registration, lookup, declared unloading, and logs;
- `ServiceRegistry` with multiple implementations and priority;
- structural manifest validation;
- ports for loading and logs;
- adapters using `fetch`, `import()`, and the console;
- greeting and counter add-ons;
- generic React host for installing extensions by URL;
- registry, validation, and loader tests.

### How to verify

Run `pnpm test`. For the interface, start `pnpm dev`, enter a manifest URL in **Settings**, review the contract, and activate the extension.

### Limit that remained

The host does not import local implementations: each extension must publish its own manifest and, in the in-process format, its ESM bundle. The local `serve-inprocess-addon.mjs` script demonstrates this publication on its own ports. Caching, updating, and complete unloading are still absent.

## Phase 2 — Priority and fallback

**State: Delivered**

### Why it came next

A single service works in a happy-path demonstration. A real ecosystem must survive when the preferred implementation fails.

### What was delivered

- `Greeter` and `Counter` interfaces;
- internal fallback helper for synchronous calls;
- internal fallback helper for asynchronous calls;
- `AggregateFallbackError` for gathering failures;
- `addon-hello-pt` with priority `10`;
- simulated failure when receiving the name `error`;
- `addon-hello` as the priority `0` alternative;
- tests for ordering, alternative success, and total failure.

### How to verify

Run the fallback tests in `@addons-poc/protocol`. A host can demonstrate this flow after installing two compatible extensions that publish the same service with different priorities.

## Phase 3 — Add-ons as servers

**State: Partial**

### Why change the format

Not every extension needs to run inside the host. Remote content and external processing benefit from independent deployment and a simple HTTP contract.

### Delivered part: text protocol

- manifest with `resources`, `types`, `idPrefixes`, and `catalogs`;
- `@addons/addon-server` in plain ESM JavaScript;
- routes for manifest, catalog, search, text options, and content;
- local HTTP clients in add-ons that consume the text format;
- `{ texts: [{ id, url, lang, name }] }` format;
- CORS for local browser consumption;
- Text Library on port `5291`;
- Web Quotes on port `5292`;
- Poems on port `5293`;
- Wikipedia on port `5294`;
- server, client, and handler tests.

### Pending part: compatibility and generic experience

- cache manifests with an update policy;
- fully validate catalog, text, and content responses beyond the manifest (search already checks the basic `{ metas }` shape);
- turn catalog and reading from a newly installed HTTP server into a specialized tab without prior host code.

### How to verify the delivered part

Run `pnpm dev`, install one of the manifest URLs on ports `5291` through `5294`, and search in the fixed field. The host reviews and preserves the contract, applies the per-add-on limit, and displays `search` resource rows; generic catalog and reading are still the next step.

## Phase 4 — Service composition

**State: Delivered**

### Why this phase matters

Isolated add-ons prove basic extensibility. The architecture becomes more interesting when one capability uses another without creating direct imports.

### What was delivered

| Add-on | Service | Demonstrated composition |
|---|---|---|
| `addon-markdown` | `addons.markdown.text-formatter` | Uses local pure formatting functions |
| `addon-aggregator` | `addons.aggregator.search-provider` | Queries several HTTP add-ons in parallel |
| `addon-favorites` | `addons.favorites` | Consumes optional `state-store` |
| `addon-health` | `addons.health.health-check` | Queries manifests and measures availability |

The host or a storage add-on may register `state-store`; when it is absent, Favorites degrades to temporary memory.

### How to verify

Run the composition package tests. A host can present these capabilities when the extensions publish protocol-compatible tabs.

## Phase 5 — Management and compatibility

**State: Partial**

### Problem to solve

A URL-based ecosystem must leave the choice with the user without turning an installation into invisible authorization. The host must remember the choice, show what the add-on declares, and request a new review if that declaration changes.

### Delivered part

- URL installation with manifest and interaction-contract review;
- expansion for each installed add-on with an explanation and complete manifest JSON;
- persistence of URLs, disabled extensions, and the accepted contract fingerprint;
- blocked reactivation when the contract changes at the same URL;
- validation of services, fields, actions, and mediated state access;
- version and capability compatibility, with blocking for missing required dependencies and cycles;
- basic cleanup of registered services when `setup` fails, covered by a loader test.

Basic cleanup calls `onUnload` callbacks and then removes services for the URL. It does not yet guarantee recovery if one of those callbacks throws. When disabling or removing an active instance, the interface clears the service registry but does not run these callbacks. See the details in the [architecture](ARCHITECTURE.md#loader-and-states).

### Pending part

- priority editing;
- manifest caching and updating;
- clear incompatibility messages;
- complete unload cycle;
- ensuring that a cleanup callback failure does not prevent later callbacks or service removal.

### Completion condition

Persistent installation already works. To complete the phase, the host must also perform complete cleanup when disabling or removing an instance, preserve service removal even when a callback fails, allow priority editing, and provide manifest caching and updates. Invalid or incompatible URLs must produce understandable errors without changing already active add-ons.

## Phase 6 — Isolation and trust

**State: Planned**

### Problem to solve

Fallback handles service failures but does not limit what in-process code can access. A malicious or blocking module still shares the host context.

### Planned investigation

- compare Web Worker and `iframe` with a separate origin;
- define serializable messages between host and add-on;
- limit time, memory, and response size where possible;
- design capability-based permissions;
- study integrity, signatures, and trusted origin;
- restrict CORS and content policies for real deployment;
- create failure and priority-degradation limits.

### Completion condition

A test extension must be able to fail, hang, or attempt unauthorized access without compromising the rest of the host. The selected mechanism needs tests and documented threats; an isolated `try/catch` is not enough.


## Chord-chart demonstration on 2026-09-19

**State: Delivered**

### Why

The catalogue and the renderer answer two questions the POC had not answered
with a real domain: can an HTTP add-on serve a catalogue of its own data, and can
an in-process add-on render structured data with many controls through a
declarative interface? They also demonstrate, end to end, that two add-ons can
collaborate through the protocol and a manifest URL without importing each
other.

### What

`addon-chord-catalog` (port `5295`) publishes `catalog`, `search`, and `text`
resources over eight original demo charts, with cursor pagination, `content.txt`,
and `content.json`. `addon-chord-viewer` (port `5305`) loads a chart from that
catalogue or from pasted text and renders it with a **ported copy of
`@achorde/tab-renderer@0.8.5`**, returning an HTML view with controls for output,
layout, transposition, font size, line height, chord height, block margin,
section spacing, colours, and four presets. Both are described in
[`CHORD-CHART.md`](CHORD-CHART.md).

### How it was verified

| Verification performed | Result |
|---|---|
| `pnpm test` | 35 tests in the catalogue and 59 in the viewer pass with the rest of the suite |
| Contract validation | Both manifests pass `validateManifest`; the viewer tab passes `validateTabContract`; service calls and log events pass the contract proxy and validators |
| Ported engine | A parity test file covers the documented behaviour of the ported tab renderer: transposition, line classification, chord collection, and the prepared bar list |
| Live check in the browser | With the catalogue, the viewer, and `storage-local` installed, the tab rendered `harbor-light` with 6 sections and 45 chord spans, transposed it by one semitone, applied the light and dark presets, and kept the chart and the controls after a full page reload |
| HTTP routes | `GET /manifest.json`, `/catalog/chart/popular.json`, `/search/chart/lantern.json`, `/text/chart/harbor-light.json`, `content.txt`, and `content.json` all answered as declared |

### Limits

Chord diagrams are not drawn (that would need a canvas or SVG library), only the
`chord-over-lyrics` family is parsed, the ported engine always spells transposed
chords with flats, and the demo catalogue is original content rather than a real
repertoire.

## Local chord editing on 2026-09-25

**State: Delivered**

### Why

Reading a chord chart was possible, but changing its text would otherwise
require a chart-specific host feature or direct imports between add-ons. The
POC needed an editing flow that kept those boundaries intact.

### What

`addon-chord-editor` (`5309`) opens a chart with Monaco and a live preview from
the viewer's service. It saves and discards browser-local drafts through
`state-store`. The viewer may display a saved draft when its source checksum
still matches. The host offers an optional, content-neutral Edit action on the
result page. The catalogue remains read-only.

### How it was verified

Targeted tests cover source loading, drafts, service registration, and the
host's generic editor convention. A browser run installed the four needed
manifests, opened a chart, loaded Monaco, saved a draft, returned to the viewer,
and discarded the draft. The repository test and build gates are recorded in
the delivery summary. Publishing edits and synchronizing across devices remain
outside this phase.

## Recommended order for the next work

1. Complete and test unload when disabling or removing add-ons, including recovery when a cleanup callback fails.
2. Complete generic catalog and reading for installed HTTP resources, expanding response validation.
3. Add priority editing and improve incompatibility messages.
4. Add manifest caching and updating while preserving new review when the contract changes.
5. Only then choose the sandbox model.

This order closes lifecycle inconsistencies first, then adds convenience, and finally addresses isolation—the most expensive and sensitive topic.
