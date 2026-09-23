# addons-app-poc

Imagine an application that gains new capabilities without being rebuilt every time. A developer publishes an extension, provides its address, and the application starts using it. If that extension fails, another one can take over.

The **addons-app-poc** exists to explore this idea. It is a proof of concept, or **POC**: a small, runnable, testable laboratory created to find out whether an architecture works before taking it to a real product.

## The problem we want to solve

Plugins often depend on the main codebase or a central store. In the first case, adding a capability requires changing and rebuilding the application. In the second, an extension author depends on an intermediary's approval and infrastructure.

This project explores a third path: independent add-ons described by a manifest and identified by that manifest's address. The main application, called the **host**, knows the system contracts but does not need to know the details of each implementation.

This idea was inspired by Stremio's add-on protocol. The inspiration lies in the technical boundaries—manifest, HTTP resources, and URL-based discovery—not in the type of content distributed.

## What you can see working

The project demonstrates two add-on formats that coexist under the same protocol:

1. **In-process add-on:** a JavaScript module loaded by the host from the URL declared in the manifest. During initialization, it registers the services allowed by its contract.
2. **HTTP add-on:** an independent server. Example clients query catalogs, searches, and texts through HTTP routes. The host installs its manifest and combines `search` resource responses into a global table without knowing each extension's implementation.

The runtime and tests also demonstrate **priority** and **fallback**. When two add-ons provide the same service, the internal registry orders the implementations and the fallback operation tries the next one when the previous one fails. Fallback helpers are internal to the runtime; the public add-on API remains `host.services.use(contract)`.

In **Settings**, a person can enter a manifest URL, review the protocol contract, and only then install the add-on. The choice, disabled extensions, and contract acceptance survive a page reload. Each active extension gets its own route in the sidebar.

## Quick architecture overview

```text
                        contracts and rules
                    ┌──────────────────────┐
                    │ @addons-poc/protocol │
                    │ contract v1, schema,│
                    │ validation and SDK  │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┴─────────────────┐
             │                                   │
    ┌────────▼────────┐                 ┌────────▼────────┐
    │    Host App     │                 │     Add-ons     │
    │ React, manager  │                 │ in-process or   │
    │ and demos       │                 │ HTTP servers    │
    └─────────────────┘                 └─────────────────┘
```

`@addons-poc/protocol` is the public compatibility boundary. The host runtime (loader, registry, states, and adapters) lives in `packages/host-app/src/runtime`; add-ons do not depend on the host or on one another. HTTP add-ons use `@addons/addon-server`, a Node.js server with no external runtime dependencies.

## How to run

You need Node.js and `pnpm`. From the project root, run:

```bash
pnpm install
pnpm dev
```

The command starts the host at `http://localhost:5280`, two HTTP servers, and five in-process add-ons. Each one publishes its own manifest and bundle; the host does not serve them.

| Port | Add-on | Content source |
|---:|---|---|
| `5294` | Wikipedia | Wikipedia APIs |
| `5295` | Chord chart catalogue | The demo chart data set |

The remaining in-process add-ons use ports `5304`, `5305`, `5306`, `5307`, and `5308`. For example, `http://localhost:5304/manifest.json` publishes the Markdown add-on, and `http://localhost:5305/manifest.json` publishes the chord viewer. Each in-process add-on can be run separately with `pnpm --filter @addons/<name> serve`.

The **Add-on Health** tab queries the seven remaining manifests in the demonstration, measures each server's latency, and shows its name, address, and state.

In WSL2, open `http://localhost:5280` manually in the Windows browser. The server already listens on `0.0.0.0`, and the script avoids trying to open a browser inside Linux.

To stop the processes started by development mode:

```bash
pnpm kill-all
```

### Other useful commands

| Command | What it does |
|---|---|
| `pnpm dev:host` | Starts only the host |
| `pnpm dev:addons` | Starts only the HTTP add-ons |
| `pnpm --filter @addons/addon-markdown serve` | Bundles and serves only the Markdown add-on on `5304` |
| `pnpm test` | Runs tests for all packages |
| `pnpm build:host` | Creates the host production build |

### Protocol published to npm

The public package lives in `packages/protocol` and is available as
`@addons-poc/protocol@1.0.0`. All workspace consumers use this published
version; the lockfile records the registry package, not a local link. To confirm
the artifact and test a consumer:

```bash
npm view @addons-poc/protocol@1.0.0 version dist.tarball
npm install @addons-poc/protocol@1.0.0
```

Before publishing a future version, confirm the account and ownership of the
`@addons-poc` scope before using `npm publish --access public`; there is no
automatic fallback to another name.

## How to explore the host

The host starts without embedded add-ons. In **Settings**, enter a manifest URL:

- review the protocol contract before installing;
- accept the contract to activate the extension;
- open the route created in the sidebar;
- disable, remove, or reload the page to check that the choice persists.

The same screen shows local `manifest.json` URLs as shortcuts. Titles and
descriptions are read generically from each manifest without loading its bundle:
**Copy** fills in the URL field, and **Install** fills in the field and starts
contract review.

The host has a fixed search field at the top. Press **Enter** to query all
active HTTP add-ons that declare `search`; press **Esc** to clear the field and
table. With the field empty the same table lists what the active add-ons publish
instead: the first catalogue each add-on declares, page by page, through the same
**Previous page** and **Next page** buttons and the same `page` URL parameter.
Only add-ons that declare a `catalog` resource contribute to that listing. The home page keeps only the search listing; every extension is
configured in **Settings**, which also opens the page of each installed add-on
in the form `#/addons/<encoded-manifest>`. Each normalized row shows type, ID,
name, and description; clicking a name loads the content URL on a dedicated
page, with an emoji or image when the manifest or response provides one. In
Settings, each search add-on can set its result limit
between 1 and 500. The host offers **Previous page** and **Next page** when the
add-on returns a continuation cursor; changing pages replaces the table with
that page's items. The `q` term and `page` number stay in the URL through
`nuqs`, allowing searches to be shared and restored. Wikipedia uses pages of up
to 20 articles (the extracts API limit) and stops at 500 records; each article's
extract appears directly in the **Description** column. With an active
`state-store` provider, the query, page, rows, and cursors are persisted.

The HTTP server started by `pnpm dev` remains available as an independent example at `http://localhost:5294/manifest.json`; the host neither knows it in advance nor includes it in its build.

## Project packages

| Package | Responsibility |
|---|---|
| [`@addons-poc/protocol`](packages/protocol/README.md) | Contract v1, JSON Schema, SemVer, service descriptors, validators, and authoring SDK |
| [`@addons/host-app`](packages/host-app/README.md) | Generic React application that installs and presents add-ons by URL |
| [`@addons/addon-server`](packages/addon-server/README.md) | HTTP server for text add-ons |
| [`@addons/addon-markdown`](packages/addon-markdown/README.md) | Namespaced Markdown service |
| [`@addons/addon-favorites`](packages/addon-favorites/README.md) | Namespaced favorites service |
| [`@addons/addon-health`](packages/addon-health/README.md) | Remote server health checks |
| [`@addons/addon-storage-local`](packages/addon-storage-local/README.md) | Optional official `state-store` service using `localStorage` |
| [`@addons/addon-text-wikipedia`](packages/addon-text-wikipedia/README.md) | HTTP Wikipedia summaries and searches |
| [`@addons/addon-chord-catalog`](packages/addon-chord-catalog/README.md) | HTTP chord-chart catalogue with listing, search, and chart delivery |
| [`@addons/addon-chord-viewer`](packages/addon-chord-viewer/README.md) | In-process chord-chart renderer with controls |

## Where to continue reading

All documentation follows the same progression: it starts with the simplest explanation and goes deeper only afterward.

1. [`docs/PLANNING.md`](docs/PLANNING.md) tells how the problem and solution evolved.
2. [`docs/PRD.md`](docs/PRD.md) defines what the POC must prove.
3. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) explains the components, flows, and current limitations.
4. [`docs/DECISIONS.md`](docs/DECISIONS.md) records decisions and their consequences.
5. [`docs/MANIFEST-SPEC.md`](docs/MANIFEST-SPEC.md) specifies the two manifest formats.
6. [`docs/PHASES.md`](docs/PHASES.md) shows what has been delivered and what is still planned.
7. [`docs/GLOSSARY.md`](docs/GLOSSARY.md) defines the terms used in the project.
8. [`docs/PACKAGES.md`](docs/PACKAGES.md) gathers each package's README and command.
9. [`docs/CHORD-CHART.md`](docs/CHORD-CHART.md) explains the chord-chart data
   format, its controls, and what was reused from the AC projects.

## Public contract v1

Every manifest has a single `contract` section with protocol version, SemVer
range, capabilities, service descriptors, declarative UI, state, HTTP, and
logs. The publishable schema is in `@addons-poc/protocol/schema`. Services that
are not official use namespaced names such as `addons.hello.greeter`.

`host.services.use({ id, version, methods })` returns a typed, mediated proxy.
Declared input and output are checked at the point of use. The host chooses
providers by priority and makes fallback explicit. A missing required service
blocks installation until a compatible provider appears; required cycles are
also blocked.

## Current limits

This POC proves the protocol, but it is not yet a production-ready platform. Each add-on must publish its own manifest and bundle or HTTP server. Complete unload when disabling or removing add-ons, generic catalog and reading for HTTP resources, complete response validation, priority editing, manifest caching and updates, sandboxing, and network proxying are still missing.

Version `1.2.0` keeps the previous version's global search and per-add-on limits, uses the full width available on the home page, opens the live demo in a gear-triggered modal, and turns each result name into a content link. Active extensions use dedicated detail routes in the form `#/addons/<encoded-manifest>`. The [state inspection verification from 2026-09-08](docs/PHASES.md#state-inspection-verification-on-2026-09-08) records initial loading, opening Local and Session details, and hiding the panel in other tabs. The [global search verification](docs/PHASES.md#global-search-verification-on-2026-09-08) records the table, per-add-on limits, and persistence. The recommended next step is to complete unload, including failures in cleanup callbacks, and then finish generic HTTP catalog and reading support.

Plugins are trusted and may call global APIs. The manifest records external I/O
for review, but v1 does not provide sandboxing, a network proxy, mediated
`onUnload`, or direct `fetch` blocking. These limits are intentional and are
explained in the documentation.

## License

MIT.
