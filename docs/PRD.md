# Product requirements

**Status: Partial** · **POC version: 1.2.0** · **Published protocol: 1.0.0**

This document defines what the proof of concept must demonstrate. It does not describe a finished commercial product; it describes the technical questions the experiment must answer and the evidence expected for each answer.

## Why build this POC

Extensible applications usually choose between dependencies compiled with the product and marketplaces controlled by a central authority. Both options are useful, but neither serves an extension that needs to be published and replaced independently particularly well.

This project's hypothesis is simple:

> A host can discover capabilities through a manifest, consume implementations without knowing their details, and keep working when one of them fails.

The POC exists to test this hypothesis with runnable code, not diagrams alone.

## What is being validated

The experiment must prove seven ideas:

1. **Declaration:** a manifest describes an add-on's identity, metadata, and capabilities.
2. **Decoupling:** the host queries services through a contract without depending on an implementation at each point of use.
3. **Replacement:** more than one add-on can provide the same service with predictable priority.
4. **Degradation:** a failure can move the system to an alternative without taking down the rest.
5. **Operational independence:** an add-on can run as an HTTP server outside the host process.
6. **Conscious review:** before activating a URL, a person can read the declared interactions; a later change requires new acceptance.
7. **Public boundary:** hosts and add-ons depend on `@addons-poc/protocol@1.0.0`, while the loader, registry, and adapters remain internal to the host.

## Public contract v1

Every manifest uses one `contract` section with a SemVer range, capabilities,
namespaced service descriptors, declarative UI, state, HTTP, and logs.
`validateManifest` and the published schema reject the legacy format. Service
access is `host.services.use(contract)`, with method and version negotiation.

The host blocks incompatible capabilities, missing required services, and
required cycles before importing a bundle. `state-store` is an official
optional capability. The protocol declares external I/O but does not promise
sandboxing.

The protocol distribution is published as `@addons-poc/protocol@1.0.0`. The
host and add-ons consume this version from the registry; the source package
remains in the workspace for tests and maintenance.

## Who the demonstration serves

| Profile | Question the POC helps answer |
|---|---|
| Protocol maintainer | Is the public boundary small, clear, and testable? |
| Add-on author | Can a capability be provided without knowing the host's internal details? |
| Host maintainer | Can capabilities be activated, queried, and replaced predictably? |
| Architecture reviewer | Can the in-process and HTTP formats coexist without being confused? |

## Demonstrated experience

When starting the project, the reader should be able to open an empty host, install compatible URLs, and follow a complete story defined by the selected add-ons:

1. install an extension by URL;
2. review its contract before activation;
3. use only the fields and actions the extension declared;
4. disable, re-enable, or remove the installation;
5. find the installation again after reloading the page;
6. request a new review when that URL's contract changes.

When active HTTP search add-ons exist, the same screen keeps a search field at
the top. Enter queries the extensions, Esc clears the query, and the central
list gathers responses into rows with type, ID, URL, name, and description. When
a response provides `pagination.next`, a person can load the next page without
restarting the query. A `state-store` provider may preserve the query, rows, and
cursors across reloads.

## Functional requirements

The states mean: **Delivered** when the behavior is implemented in the stated scope; **Partial** when part of it works but a meaningful gap remains; **Planned** when the POC does not implement the requirement yet.

### Protocol core

| ID | Requirement | State | Current evidence |
|---|---|---|---|
| F1.1 | Define a shared manifest | Delivered | `AddonManifest` and `validateManifest` |
| F1.2 | Validate the manifest before consumption | Delivered | Validation tests in `protocol` |
| F1.3 | Register services by identifier | Delivered | `packages/host-app/src/runtime/registry.ts: ServiceRegistry.register` |
| F1.4 | Query one or all implementations | Delivered | `ServiceRegistry.get` and `getAll`, internal to the host |
| F1.5 | Order implementations by priority | Delivered | Descending order in the registry |
| F1.6 | Clear services by add-on | Delivered | `ServiceRegistry.clearAddon`, internal to the host |
| F1.7 | Expose a small `HostAPI` | Delivered | `services`, `registerService`, `onUnload`, and `log` |
| F1.8 | Represent loading and error | Delivered | `AddonInstance` and `AddonStatus` |

### In-process add-ons

| ID | Requirement | State | Current evidence |
|---|---|---|---|
| F2.1 | Export `manifest`, `setup`, and `createTab` | Delivered | Local example add-ons |
| F2.2 | Load the manifest and bundle by URL | Delivered | `FetchAddonLoader` and mock-based tests |
| F2.3 | Install an arbitrary URL through the interface | Delivered | Settings validates the manifest, requests review, offers local URLs with generically read `name`/`description`, and uses `FetchAddonLoader` when `entrypoint` exists |
| F2.4 | Keep a setup failure from taking down the host | Delivered | Loader returns an `error` instance when cleanup finishes without exception; cleanup failure is F2.8 |
| F2.5 | Remove partial registrations after setup failure | Delivered | Loader test proves `clearAddon` after setup failure without cleanup callbacks; callback failure is F2.8 |
| F2.6 | Run unload callbacks | Partial | Loader calls callbacks when activation fails; disabling or removing active instances still does not run them |
| F2.7 | Demonstrate greeting and counter services | Partial | Greeting and counter examples were removed; the host remains decoupled from implementations |
| F2.8 | Finish cleanup even when a callback fails | Planned | An exception in `unloadAll` can prevent later callbacks, `clearAddon`, and returning an `error` instance |

### Priority, fallback, and composition

| ID | Requirement | State | Current evidence |
|---|---|---|---|
| F3.1 | Try synchronous implementations in order | Delivered | Internal fallback helper covered by protocol tests |
| F3.2 | Try asynchronous implementations in order | Delivered | Internal fallback helper covered by protocol tests |
| F3.3 | Gather failures when no option works | Delivered | `AggregateFallbackError` covered by protocol tests |
| F3.4 | Define TypeScript descriptors for services | Delivered | `ServiceInteraction`, input/output schemas, and `services.use` |
| F3.5 | Allow infrastructure provided by the host | Delivered | Optional `state-store`, with priority between providers |
| F3.6 | Allow composition without direct imports | Delivered | Favorites, aggregator, and health check |

### HTTP text add-ons

| ID | Requirement | State | Current evidence |
|---|---|---|---|
| F4.1 | Declare `resources`, `types`, and `catalogs` inside `contract` | Delivered | Remaining canonical Wikipedia HTTP manifest |
| F4.2 | Serve the manifest and resources through stable routes | Delivered | `@addons/addon-server` |
| F4.3 | Allow browser access from the host | Delivered | CORS headers and `OPTIONS` response |
| F4.4 | Consume catalog, search, and text options | Delivered | Local HTTP clients for the aggregator and health add-ons |
| F4.5 | Deliver content on demand by URL | Delivered | `texts` payload and `content.txt` route |
| F4.6 | Demonstrate embedded content | Delivered | Text Library |
| F4.7 | Demonstrate external processing | Delivered | Quotes, PoetryDB, and Wikipedia |
| F4.8 | Tolerate an unavailable source in aggregated search | Delivered | `Promise.allSettled` in the aggregator |
| F4.9 | Cache the manifest | Planned | The client fetches it again |
| F4.10 | Explore HTTP resources installed through the generic interface | Delivered | `SearchResultsTable` and `search.ts` query `search` resources from active add-ons; per-add-on limits, optional cursor pagination, Enter/Esc, and `state-store` persistence |
| F4.11 | Validate HTTP resource responses beyond the manifest | Partial | The host rejects search payloads without `metas`; complete catalog, text, and content schemas are still pending |

### Management, compatibility, and isolation

| ID | Requirement | State | Current evidence |
|---|---|---|---|
| F5.1 | Show active add-ons and their states | Delivered | Host management area |
| F5.2 | Activate and remove add-ons installed by URL | Delivered | `AddonManager` |
| F5.3 | Persist selected add-ons | Delivered | `addons:host-installations:v1` preserves URLs, disabled extensions, and accepted contracts |
| F5.4 | Choose providers by explicit priority | Delivered | `priority` in the descriptor and deterministic ordering in the internal registry |
| F5.5 | Negotiate protocol version and capabilities | Delivered | `checkContractCompatibility` before `import()` |
| F5.6 | Isolate code in a Worker or iframe | Planned | In-process add-ons share the host context |
| F5.7 | Apply a trust and permission policy | Planned | There is no signature, authorization, or per-capability consent |
| F5.8 | Give each active extension its own route | Delivered | Hash encodes the manifest URL in `#/addons/<url>` |
| F5.9 | Request a new review when the contract changes | Delivered | Contract fingerprint blocks reactivation until new acceptance |
| F5.10 | Mediate declared internal interactions | Delivered | Proxy validates service, input, output, fields, actions, state, and logs |
| F5.11 | Edit priorities through the interface | Planned | Current order comes from descriptors; the host has no editor |
| F5.12 | Define a manifest update policy | Planned | Persisting URLs and accepted contracts is not an update policy |

The [2026-09-08 verification record](PHASES.md#verification-on-2026-09-08)
documents the tests, build, and limits of the local review. The next work order
is also in `PHASES.md`.

## Non-functional requirements

### Protocol clarity

A person should be able to understand an add-on's path by reading the manifest, the public `HostAPI`, and the host's internal `ServiceRegistry` description. Documentation starts simply and deepens progressively.

### Testability

Core rules must work without a real network. Fetch and storage functions must be injectable or replaceable in tests.

### Controlled dependencies

`@addons-poc/protocol` must not depend on React or Vite. `@addons/addon-server` must remain free of external runtime dependencies.

### Compatibility

In-process add-ons use ESM. The demonstration host depends on modern browsers capable of running the React application and using `fetch` and `localStorage`.

### Operational honesty

Failures, security, and isolation must be described according to current behavior. A planned capability must not appear delivered merely because its type or intention already exists.

## Use cases

### Create an in-process add-on

A person chooses or defines a service descriptor inside `contract`, creates a manifest with `entrypoint`, exports `setup`, and registers the implementation through `HostAPI`. They then create an ESM bundle and host it alongside the manifest.

The **Settings** screen accepts an HTTP or HTTPS URL, validates the manifest, shows the contract, and calls `FetchAddonLoader` to import the ESM bundle after acceptance. `host-app` has no implementation dependency, embedded catalog, or special path for workspace add-ons. For local development, each in-process package can publish `manifest.json` and `bundle.js` with its own `serve` command.

### Create an HTTP add-on

A person writes a manifest with `contract.resources`, implements catalog, search, text, and content handlers, and passes them to `createAddonServer`. The host needs only the base URL to start the conversation. If the manifest declares `search`, the host's global search queries the extension without add-on-specific code.

### Use fallback

Two implementations register the same service. The internal runtime orders them by highest priority, and the tested internal fallback helper tries the next one when the previous one throws. The public add-on API remains `host.services.use(contract)`; the consumer does not import the registry or helper.

### Read a remote text

The host fetches the manifest, queries a search, and shows metadata in the central table. For full reading, the future flow will fetch a catalog or option from `/text/...json` and only then download the content URL. The source server may query another API before responding without changing the contract seen by the host.

## POC success criteria

The main hypothesis is considered demonstrated when all of this evidence remains true:

- two add-ons provide `greeter` with different priorities;
- fallback uses the alternative after a simulated failure;
- a loading error becomes an observable state instead of closing the host;
- a service can consume host infrastructure through the registry;
- a compatible HTTP server is discovered through a manifest;
- catalog, search, text options, and content work end to end through the protocol HTTP client;
- at least one external source is transformed into the shared contract;
- aggregated search remains useful when one source fails;
- global search queries Web Quotes, Poems, and Wikipedia and preserves rows when one source fails;
- results can be preserved by an active `state-store`;
- a compatible URL can be reviewed, installed, and restored after reloading;
- a contract change at the same URL keeps the extension disabled until new acceptance;
- undeclared services, action fields, and state are rejected before host use;
- package tests pass without relying on real external servers.

## Out of current scope

- marketplace or public catalog with a backend;
- authentication and authorization;
- add-on auditing or cryptographic signatures;
- automatic npm publication without organization credentials;
- Service Worker or WebAssembly support;
- production-ready sandboxing;
- availability guarantees for example public APIs;
- ranking, caching, and sophisticated search;
- cryptographic origin verification, network permissions, and in-process code sandboxing;
- final product visual design.
