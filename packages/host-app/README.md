# `@addons/host-app`

Host runtime and interface for the add-on POC.

## Why this package exists

The host must load add-ons by URL without importing known implementations. The separation keeps the public protocol stable and keeps execution decisions—loader, registry, state, and adapters—inside the application.

## What it offers

The host fetches and validates `manifest.json`, negotiates protocol version and
capabilities, reviews the contract, imports in-process ESM bundles, and presents
HTTP servers. The interface is generic: the package has no embedded catalog,
alias, or dependency on `@addons/addon-*`. In Settings, the local list queries
only `name` and `description` from manifests to make filling the form easier.
Global search queries `search` HTTP resources declared by active add-ons and
normalizes responses into one table.

Canonical host capabilities:

- `registry.services`: mediated service registry;
- `ui.tab`: declarative tab;
- `logs`: structured logs;
- `state-store`: optional serializable-state provider.

The search field stays fixed in the header: **Enter** starts the query and
**Esc** clears the field and results. `src/search.ts` is an internal adapter
that queries `/search/<type>/<query>.json`, applies the per-add-on configured
limit as page size, isolates source failures, and produces rows with type, ID,
URL, name, description, and optional visual metadata. The table remains visible
even without extensions. Page size can be adjusted in the extension sidebar or
Settings, between 1 and 500 results. The default is 10, including when the
field is empty. Resources that declare `languages` also show a language selector
per add-on; the choice is persisted by manifest URL, sent as `lang`, and carried
by content links. When a response includes `pagination.next`, the host keeps a
cursor per provider and shows **Previous page** and **Next page**, with the
current page between the buttons at the beginning and end of the table. Changing
pages replaces rows with the requested page instead of accumulating the previous
page. The search term and page are controlled in the URL through `nuqs` (`q` and
`page`). When an active `state-store` exists, the host stores the query, rows, and
cursors under `host:search:results:v1`.

On the home page, the table uses all available width. Extensions are managed in
**Settings**, which opens the detail route of an installed add-on in the form
`#/addons/<encoded-manifest>`; the detail route does not repeat the search
listing. The visual URL column is hidden: clicking a result name
navigates to a dedicated page, fetches its `content.json`, and renders the image,
description, summary, and original link. Metadata, headers, metrics,
observability, and complete JSON remain available in traffic and debug output
without taking over the main view. `content.txt` remains available as compatible
text content and a fallback for older add-ons.

The internal registry orders providers by priority and add-on name. Missing required services leave an installation blocked; when a provider appears, the host can reevaluate it. Required dependency cycles are also blocked.

## How it works

The runtime is in [`src/runtime`](src/runtime):

- [`loader.ts`](src/runtime/loader.ts) implements `FetchAddonLoader`, validates the manifest before `import()`, and checks that the bundle contract matches the reviewed contract. The public manifest URL is the source of `entrypoint`, so a local bundle may export a relative build path without invalidating the installation;
- [`registry.ts`](src/runtime/registry.ts) keeps implementations and their priorities;
- [`dependency-graph.ts`](src/runtime/dependency-graph.ts) orders providers and detects cycles;
- [`logger.ts`](src/runtime/logger.ts) centralizes host log output.

The package depends directly only on `@addons-poc/protocol` and the interface's own libraries. Add-ons do not import this package.

## Development

From the repository root:

```bash
pnpm --filter @addons/host-app dev
pnpm --filter @addons/host-app test
pnpm build:host
pnpm check:host-boundary
```

The local host server uses port `5280`. `pnpm dev` starts the host and the four HTTP demonstration servers; in-process add-ons are served by `scripts/serve-inprocess-addon.mjs` and discovered through their manifest URLs.

## Limits

Add-ons are trusted in this POC. The host validates declared contracts, inputs,
outputs, state, actions, and logs but does not promise sandboxing, global API
blocking, or a network proxy. External I/O must appear in `contract.http` and
pass review.

The loader runs `onUnload` callbacks when activation fails and then removes
registered services. A callback exception can interrupt that cleanup. When
disabling or removing an active instance, the host removes its services but does
not yet run the callbacks. The complete unload cycle is the next task in the
[roadmap](../../docs/PHASES.md#recommended-order-for-the-next-work).

HTTP manifests without `entrypoint` receive a tab with title and description,
the complete contract, and, when they declare `debug-traffic`, one link to the
history of real requests and responses. The host continues reading debug data in
the background and printing every response in the browser console even when the
history has not changed. Generic search already covers the `search` resource;
catalog, reading, caching, and complete HTTP response validation are still
planned.

See the [manifest specification](../../docs/MANIFEST-SPEC.md) and the [package index](../../docs/PACKAGES.md).
