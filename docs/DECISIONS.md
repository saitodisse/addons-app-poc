# Architecture decisions

This document preserves the reasoning behind the system. It exists because a decision without context looks like an arbitrary rule; when the problem and alternatives are visible, it is easier to know when to keep it and when to revisit it.

Each decision starts with the simple idea and ends with the technical consequences.

## 1. The manifest URL is the identity

### Why

Declared names and identifiers can repeat. Two people can publish an add-on called `hello`, and the same server can change its name without becoming a different add-on.

### Decision

The complete manifest address identifies the add-on. The `id` field remains useful for reading, logs, and the interface, but it does not define uniqueness.

### Technical consequences

- `AddonInstance.manifestUrl` preserves identity.
- `ServiceEntry.addonId` receives the manifest URL when the loader registers services.
- moving the manifest to another URL creates another identity;
- updating content at the same URL preserves identity.

## 2. Manifest and setup are separate parts

### Why

The host must understand what an add-on declares before executing its code.

### Decision

An in-process add-on exports `manifest` and `setup`. The manifest describes; `setup` initializes.

```typescript
interface AddonModule {
  manifest: AddonManifest;
  setup(host: HostAPI): void | Promise<void>;
}
```

### Technical consequences

The host can validate metadata and services before activation. In a future evolution, it can also show permissions or compatibility before executing the bundle.

## 3. HostAPI must remain small

### Why

Each method exposed by the host becomes a compatibility commitment. A large API gives the add-on more immediate power, but increases coupling and makes future isolation harder.

### Decision

The add-on receives only:

- `services`, to query the registry;
- `registerService`, to publish an implementation;
- `onUnload`, to declare cleanup;
- `log`, to emit contextual messages.

### Technical consequences

Capabilities such as networking, persistence, or authentication must arrive as explicit services, not unrestricted access to the host's internal details.

`log` accepts optional details and forwards them to the `addons.debug.log` service when it is active. This does not add a parallel debug API or hand storage directly to the add-on.

## 4. The registry is internal to the host

### Why

If the host and each add-on imported one another, every part would be tied to the same build.

### Decision

Providers register implementations by `serviceId` in the host's private registry; consumers receive only `host.services.use(contract)`. The public package describes the port but does not export the registry or a loader.

### Technical consequences

The registry stores `serviceId`, instance, source, descriptor, and priority. It does not know React, HTTP, or the purpose of each service. This small, generic depth is intentional.

## 5. Priority is explicit

### Why

When several implementations provide the same capability, the system needs a predictable order.

### Decision

Each provider descriptor may declare a numeric priority. Higher values come first; the default priority is zero.

### Technical consequences

`ServiceRegistry.register` orders entries. Ties use the manifest URL identity as a tiebreaker so that the choice is deterministic.

This numeric priority chooses among implementations of the same service. It
does not choose setup order: required service dependencies determine execution
order, with each provider ready before its consumer starts.

## 6. A setup failure deactivates the instance

### Why

A partially initialized add-on leaves state difficult to understand. The host must know whether activation finished.

### Decision

If `setup` throws an exception, the loader returns an `AddonInstance` with `error` status and does not advertise services in the returned instance.

### Technical consequences and current gap

The loader runs registered callbacks, clears services for that URL, and returns
an `error` instance as long as callbacks finish without throwing. Removal of
registrations after a `setup` failure has a host-runtime test. It still needs to
ensure that a callback failure does not interrupt later callbacks or prevent
service removal. Current activation registers services directly in the registry;
there is no transaction keeping them invisible until `setup` completes.

## 7. Fallback is an explicit operation

### Why

Choosing the first service and trying alternatives are different responsibilities. Hiding execution inside the registry would make errors and types harder to control.

### Decision

The internal registry orders entries; internal helpers `withFallback` and
`withFallbackAsync` execute attempts in sequence. They are not part of the
public exports of `@addons-poc/protocol`; the public add-on API is
`host.services.use(contract)`.

### Technical consequences

The consumer supplies the function applied to each implementation. If all fail, it receives an `AggregateFallbackError` with the individual errors. If no service is registered, the same error is thrown with an empty internal list.

## 8. In-process add-ons use ESM

### Why

Modern browsers and Node.js already understand ECMAScript modules, or **ESM**. A native standard reduces proprietary formats and extra loaders.

### Decision

In-process bundles must be ESM modules loadable with `import()`.

### Technical consequences

The `entrypoint` must be an HTTP or HTTPS URL in the public manifest validated by the loader. This remote URL is the canonical source for importing the bundle; the manifest exported inside the bundle may keep a relative build-project path as long as its identity, version, and contract match the remote manifest. The host contains no imports, aliases, or embedded add-on metadata catalog: after contract review, the interface uses `FetchAddonLoader` to fetch the manifest and import the extension's published ESM bundle. As a development convenience, Settings lists known local `manifest.json` URLs and reads only `name` and `description` for presentation without executing the bundle.

## 9. The manifest must be complete before execution

### Why

A host needs to show authorship, version, license, and capabilities without guessing from code.

### Decision

Every manifest declares `id`, `version`, `name`, `description`, `author`,
`license`, and one `contract` v1 section. Services, UI, state, HTTP, logs,
capabilities, and resources live inside it. The legacy format is not interpreted.

### Technical consequences

`validateManifest` rejects empty required fields, IDs outside kebab-case,
versions outside `X.Y.Z`, non-namespaced capabilities, descriptors without
schemas, and incompatible structures. The canonical specification is in
[`MANIFEST-SPEC.md`](MANIFEST-SPEC.md).

## 10. Domain interfaces make services understandable

### Why

A `serviceId` alone does not say which methods an implementation provides. Without a contract, the error appears only during execution.

### Decision

The public protocol exposes contract types and an authoring SDK. Domain helpers, such as favorites, Markdown, or aggregation, stay in the add-ons that use them and do not become an accidental global API.

### Technical consequences

TypeScript checks providers and consumers during development. The `services.use` proxy also validates inputs, outputs, and state at runtime; this guarantee does not replace trusted code review or sandboxing.

## 11. Tests focus on the critical protocol

### Why

The most expensive error is one that breaks every add-on. Therefore, registry, validation, fallback, loading, and clients deserve small, deterministic tests.

### Decision

`@addons-poc/protocol` keeps unit tests next to the code. The server and add-ons with their own transformations also test their handlers and services.

### Technical consequences

Real networking is replaced with injected functions or mocks whenever the goal is to test rules. The React interface still depends mainly on manual verification.

## 12. The public protocol is a versioned package

### Why

Independent hosts and add-ons need to install the same boundary without bringing the entire host runtime.

### Decision

`@addons-poc/protocol` starts at `1.0.0`, uses MIT, publishes ESM, TypeScript declarations, and `schema/addon-contract.schema.json`. Publication requires checking the account and scope ownership before sending the package.

### Technical consequences

The package does not contain a loader, registry, or add-on catalog in its exports. An incompatible change requires a new major version; method or schema changes require a new major version of the service.

## 13. An add-on can be an HTTP server

### Why

Running everything inside the host increases coupling, build size, and risk. Some capabilities work better as independent services.

### Decision

The protocol accepts add-ons that declare `contract.resources` and respond over HTTP, following the route organization popularized by Stremio.

### Technical consequences

Add-ons that consume text keep their local clients; the server uses
`@addons/addon-server`. Code and deployment can evolve separately, but the
system must handle networking, CORS, response time, and unavailability.

## 14. Text uses two-stage delivery

### Why

Sending complete content in catalogs and searches wastes bandwidth. Most of the time, the user opens only a few results.

### Decision

Catalog and search return metadata. The `text` resource returns a list of options in this format:

```json
{
  "texts": [
    {
      "id": "text-1",
      "url": "https://example.com/text/text/text-1/content.txt",
      "lang": "pt-BR",
      "name": "Primary version"
    }
  ]
}
```

### Technical consequences

The host fetches the content referenced by `url` only when needed. The format is inspired by Stremio's `subtitles`, adapted for plain text.

## 15. The HTTP server remains autonomous

### Why

A remote add-on should be simple to host without loading the protocol's entire TypeScript toolchain.

### Decision

`@addons/addon-server` and text add-ons use plain ESM JavaScript and zero external runtime dependencies beyond the public protocol used to validate the manifest.

### Technical consequences

The server calls the canonical validation from `@addons-poc/protocol`; there is no parallel legacy parser.

## 16. Services can compose other services

### Why

Useful extensions rarely live in isolation. Favorites need storage; aggregated search needs sources; the host can provide infrastructure without knowing each consumer.

### Decision

An add-on may query `host.services` during `setup` and build its capability from existing services.

### Technical consequences

- the host registers infrastructure with an explicit source such as `addonId: "host"`;
- consumers must account for missing optional dependencies;
- the host analyzes required dependencies, reactivates blocked instances when a provider appears, and blocks cycles;
- add-ons do not import other add-ons directly.

## 17. The demo interface belongs to the active add-on

### Why

Fixed tabs in the host made the application know specific services and examples. A removed extension still left its interface in the host, contradicting independent installation.

### Decision

Every manifest declares `contract.ui.title` and `contract.ui.body`. An in-process module exports `createTab(host)`, which provides fields, actions, and `run(actionId, values)`. The return value of `run` is a declarative response that the host renders without knowing the add-on's rules.

### Technical consequences

- the host lists only `ready`, active instances with a tab;
- disabling or removing an extension immediately removes its tab;
- each add-on owns its functionality, including service state and remote calls;
- HTTP add-ons may declare an informational tab in the manifest; interactive actions also require an in-process module;
- response items may carry JSON `details`; the host shows them on demand and does not interpret their structure;
- a response may also carry a rendered `view`; the host inserts the add-on's HTML
  inside the tab without interpreting it. The content comes from trusted code
  that already runs in the host page, so this adds no new privilege, and the
  text `body` remains the fallback every host must support;
- the contract is React-neutral, so `protocol` does not become dependent on the interface library.

## 18. Persistence and observability are optional capabilities

### Why

Writing data directly through the host made Favorites persist even without an installed storage extension. Likewise, console messages were invisible inside the POC and did not let a debug extension show what the others had executed.

### Decision

The protocol uses two optional services: `state-store`, for serializable values by key, and `addons.debug.log`, for structured events. Consumer add-ons query these services when operating; when they are absent, they remain in memory and do not save state. Tabs that want to save their interface declare a `persistence` bridge with `load` and `save`.

`storage-local` provides `state-store` with priority `10`; `storage-session`, with priority `0`. Therefore local storage wins while both are active. `debug` provides `addons.debug.log` and displays its events through its own tab.

### Technical consequences

- the host no longer registers `localStorage` as implicit infrastructure;
- tab names and responses, the counter, search history, and favorites list persist only with an active `state-store`;
- structured logs are emitted by `HostAPI.log` and displayed in real time when Debug is active;
- disabling a provider clears its registry implementation, so another active provider can take over or no state will be saved;
- data already in storage is not erased when the extension is disabled; it is simply no longer read or updated until the extension becomes active again.

## 19. The host preserves its installation list

### Why

Without storing installed URLs, an F5 erases every in-memory instance. It also prevents the host from reactivating `storage-local` before loading consumers, making state persistence across reloads less useful.

### Decision

The host stores a small `localStorage` configuration with installed manifest URLs and disabled URLs. During initial loading, it tries the recorded order and retries add-ons that use services. If the key does not exist, it starts without extensions. The initial retry and later dependency rechecks activate selected providers before their required consumers, one at a time.

### Technical consequences

- removing an extension also removes it from the persisted configuration;
- disabling an extension remains disabled after reloading;
- a URL that cannot be restored is ignored for that session and removed from the persisted list after loading finishes;
- the host configuration does not replace `state-store`: it only rebuilds the extensions that may choose to persist their own data.
- `FetchAddonLoader.loadAll` resolves required dependencies before setup, even
  when the saved manifest list places a consumer first; the list order is not an
  execution priority.
- `App.tsx` uses that same dependency order when it rechecks add-ons after
  restoring installations or changing a provider. It does not clear and reload
  a provider and its consumer concurrently, because the consumer could observe
  the temporary absence and become blocked.
- Optional service use does not create an ordering edge; it never delays a
  provider or blocks activation.

## 20. Every add-on declares its interaction contract

### Why

A person could install an add-on knowing its name and service but could not identify all data it received, state it stored, or HTTP calls it made. This gap prevents an informed choice and allows silent capability changes.

### Decision

Every compatible manifest must include `contract` version `1.0.0`. The block describes provided and consumed services, tab fields and actions, state by key or pattern, incoming and outgoing HTTP, and log events. Data is classified as public, personal, or secret; secret values do not belong in the manifest and must not be shown by the interface.

The host rejects a manifest without a contract. It compares provided services, fields, and mediated actions with the declaration, forwards only fields accepted by the action, and blocks access to undeclared services or state keys. The URL remains the identity, but a contract change at the same URL requires new acceptance before reactivation.

### Technical consequences and current limit

- `AddonManifest.contract` and `validateManifest` form the new canonical contract;
- the host persists the accepted contract fingerprint with its installation configuration;
- HTTP add-ons record method, origin, route template, purpose, and expected input and output;
- outgoing HTTP is not yet mediated, so it remains a transparent declaration rather than a technically enforced permission;
- the change is incompatible with old manifests: they must publish `contract` before installation.

## 21. Global search aggregates declared HTTP resources with pagination

### Why

HTTP servers could already answer searches, but an informational tab did not give a person one place to compare results. Making the host know each extension would solve the screen quickly but recreate the coupling the protocol should avoid.

### Decision

The host keeps a global search field and queries, in parallel, active add-ons
that declare a `search` resource. The internal adapter normalizes each meta into
a row with `type`, `id`, `url`, `name`, and `description`, preserving `emoji` or
`image` when available. Catalog and search may return optional `pagination` with
`limit`, `total`, and an opaque `next` cursor; the host resends that cursor as
`cursor` and offers **Previous page** and **Next page**, with the current page
between them at the beginning and end of the table. Each manifest has a local
page size configurable from one to five hundred. A search resource may declare
`languages`; in that case, the host shows a choice per provider, sends the
selected language as `lang`, and resets pagination when it changes. The host
tolerates an isolated failure, shows the error alongside valid responses, and
lets Enter start the search and Esc clear the results.

### Technical consequences

- `packages/protocol/src/domain/text.ts` exposes `TextPageRequest` and
  `TextPagination`; the fields are optional and do not change the published
  protocol version;
- `packages/host-app/src/search.ts` uses declared HTTP routes without importing
  concrete add-ons;
- the table exists on every route and when no providers are active;
- the `text` resource content URL is a fallback when the meta does not provide a
  URL of its own;
- the page size is applied per add-on in the host and can be adjusted in the
  sidebar or Settings; each response may continue with `pagination.next`, with
  no single pagination scheme imposed on every server;
- `languages` is an optional resource declaration; the selected configuration
  is associated with the manifest URL, and the host does not interpret language
  code meanings;
- content links may preserve `lang` so navigation continues in the search
  language;
- page responses remain compatible with older add-ons: `pagination` is optional,
  and the absence of `next` ends the listing;
- with an active `state-store`, `host:search:results:v1` stores the last query,
  its rows, and its cursors; without that service, results remain in memory;
- current validation guarantees the basic `{ metas: [...] }` shape and validates
  optional `pagination`; complete schemas, catalog, and reading remain outside
  this decision.

## 22. The chord-chart add-ons are independent of the AC projects

### Why

The POC needed a domain with real structure to prove that a catalogue and a
renderer can be two independent add-ons. The AC projects already solved chord
charts: `ac15` stores a `ChordChart` and a viewer, `achorde` publishes the
`tab-renderer` engine, and the AC12 archive holds the text format. Reusing their
code would have created exactly the dependency this repository forbids.

### Decision

The chord-chart add-ons reuse **concepts**, never code, data, or packages:

- the chart text format of the AC archive: chord lines above lyric lines,
  `[section]` titles, and `(...)` annotations;
- the chord grammar of the AC parser, including `7M`, `º`, `m7(b5)`, and slash
  extensions, with the guard that keeps lyric words out of the grammar;
- a semitone table that moves root and bass and leaves the quality untouched;
- the chart record with a checksum and parser versions, published inside
  `content.json` as `chordChart`;
- the viewer settings of `ac15`, with the same names where the meaning survives.

The add-ons own their own implementation, in their own packages, with their own
tests. `addon-chord-catalog` publishes data and metadata; `addon-chord-viewer`
owns the parsing and the rendering. Neither declares the other in
`package.json`, and neither imports the other: the viewer reads the catalogue
through its manifest URL and the protocol routes.

Two behaviours are deliberately different from the reference:

- the viewer uses a **ported copy** of `@achorde/tab-renderer@0.8.5` (MIT) under
  `packages/addon-chord-viewer/src/tab-renderer`, with its license and a
  provenance file, instead of adding a dependency on the other project;
- only the pipeline the rendered view needs was ported; the legacy path that
  depends on `@tonaljs/tonal` was left out;
- charts render as HTML produced by that component; the host inserts the view
  and keeps the text body as the fallback.

The demo catalogue contains original content written for this POC. The AC12
archive is licensed material of another project and is not copied here.

### Technical consequences

- no dependency, alias, or import links this repository to `ac15`, `achorde`, or
  `ac12`; the protocol is the only shared boundary;
- the mapping between reused concepts and their origin is recorded in
  [`CHORD-CHART.md`](CHORD-CHART.md), so a future reader can compare the two
  implementations;
- a change in the AC projects does not change this repository, and a change here
  does not change them;
- the protocol itself was not extended: the chart payload travels as ordinary
  `text` content, and the controls travel as ordinary tab fields and actions.

## 23. The host renders a result through a declared service

### Why

Clicking a search row opened the dedicated page of the result, and that page knew only one shape: the structured article payload of an HTTP text add-on. A row
from another domain — a chord chart, for instance — arrived there and was shown
as an empty article header, because the host had no way to ask anyone to render
it.

Teaching the host about chords would break its boundary. Leaving the page as it
was would make every non-article add-on a second-class result.

### Decision

The host asks a service declared **by convention**, exactly as it already asks
`state-store` for persistence:

```text
id:     host.content-view
method: render({ url, type, name }) -> { html, title? }
```

Any active add-on may provide it. The internal registry decides which provider
wins, by the usual priority rule. The provider receives the content URL of the
result and either returns HTML or returns nothing.

The service name lives under the `host.` namespace so it satisfies the namespaced
identifier rule of contract v1 without changing the published protocol package.
It is a convention between the host and any add-on, not a new protocol version.

### Technical consequences

- `packages/host-app/src/content-view.ts` reads the provider from the registry
  and tolerates every failure: a provider that throws, hangs, or answers with an
  empty string becomes "no view", and the page keeps its own layout;
- the result page tries the view **before** fetching the structured payload, so a
  rendered result costs one request instead of two;
- the page also shows the **control panel of the add-on behind the view**, resolved
  through `registry.providerOf`. It reuses the same tab controller as the add-on
  page, so a change made there renders the result again, which is how the chart
  page of the AC viewer keeps its dial panel beside the chart;
- that panel hides the controls the add-on marks with `source`, because the result
  page already holds the content. Choosing the content belongs to the add-on page;
  changing how it is read belongs to the result page. The host filters by the
  declaration alone (`readingSections` in `packages/host-app/src/tab-view.ts`) and
  never by a control id, so it still knows nothing about chords;
- the live action runs immediately when the controls have been still for one
  pause, and is queued for the rest of the pause only while a drag keeps arriving.
  A fixed pause after the last change made every single adjustment as slow as the
  heaviest drag;
- a control change **paints the view that came with the response**. The action
  already rendered the content with the controls in use, so asking the provider
  again would read the content URL over the network and render the same chart a
  second time on every step of a dragged control. The content view provider is
  asked once, when the page opens;
- the provider that reads a content URL hands the record it read back to its own
  add-on through an optional `adopt` callback. It is what lets the tab render
  from memory, and it keeps the panel beside a result editing the content the
  result opened;
- a control may belong to one piece of content rather than to the person. The
  chord viewer keeps the font size and the transposition of each chart, which is
  the group it declares as the current chart, and everything else global. The
  add-on decides the split from its own field list, so the host still stores
  opaque records;
- the controls open with the values the add-on reports, and the record restored
  from storage only fills the ones it has not reported yet (`restoredValues`).
  Persistence is a cache of the add-on's own state, never an authority over it;
- only a write that is still waiting is flushed when the page goes away. React
  also unmounts a component on purpose to test its effects, and flushing whatever
  the hook held at that moment stored an empty state over the real one;
- the page re-renders on every step of a dragged control, which is unavoidable —
  the values live in React state. What must not repeat is the work: the rendered
  view is a memoized leaf (`RenderedHtmlView`), so the document receives the HTML
  only when the add-on publishes a different view, and the add-on's state reaches
  storage after a pause instead of on every step;
- a provider is expected to decline what it does not understand. The chord viewer
  renders only payloads that declare the `chord-over-lyrics` notation, which is
  why a Wikipedia result still opens as an article;
- the page paints a response view only after a provider accepted the URL, because
  that acceptance is what proves the page belongs to the add-on. A response that
  arrives before it — the add-on restoring the controls of its own tab — cannot
  replace an article with content the person never opened;
- the host stays free of domain rules: it moves an opaque HTML string and a
  title between the add-on and the page;
- a rendered result carries the same trust as a rendered tab: the add-on already
  runs in the host page, so inserting its view adds no privilege;
- the convention is optional. Without a provider, nothing changes.

## 24. Chord editing uses a separate add-on and local drafts

### Why

The catalogue publishes charts, and the viewer renders them. Editing requires a
different responsibility: accepting changes without silently rewriting the
published source. Putting Monaco or chart rules in the host would also make the
host depend on this example's domain.

### Decision

An independent editor add-on opens a chart by its content URL. It asks the
viewer's declared `addons.chords.viewer` service for a live preview and saves a
local draft through the declared `state-store` service. The editor publishes
`addons.chords.drafts`; the viewer may read that service to display a saved
draft. The host asks the optional `host.content-editor` service whether a
result can be edited and presents its view without interpreting chart data.

The editor declares the viewer as a required service consumer. The loader and
the host's dependency rechecks therefore start the renderer first and the
editor second, regardless of the order in which their manifest URLs were
saved.

A draft is identified by the source URL and records the source checksum. A
draft based on a different checksum is shown as a conflict to the editor and
is not silently displayed as the published chart. The HTTP catalogue remains
read-only. The editor uses Monaco as a separately served browser dependency and
falls back to a plain text area if Monaco cannot load. No package imports an
AC project or another add-on.

### Consequences

- the editor needs the viewer and a storage provider to activate; a missing
  required provider leaves it blocked by the existing compatibility rules;
- the host gains one domain-neutral editing convention, while the chart
  vocabulary stays in the add-ons;
- writing to a remote catalogue, publishing a revision, and resolving an
  upstream conflict require separate decisions;
- changes to the public protocol are unnecessary for this delivery.

The cross-add-on interface and the alternatives are recorded in
[`adr/0002-independent-chord-editor.md`](adr/0002-independent-chord-editor.md).

## When to revisit a decision

A decision can change when the POC produces better evidence. The review must update, in the same delivery:

1. the explanation of the problem;
2. the new decision and rejected alternatives;
3. affected code and tests;
4. the architecture, manifest, and glossary when applicable;
5. the corresponding phase status.
