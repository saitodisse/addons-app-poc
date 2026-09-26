# addons-app-poc architecture

**Status: Partial · Protocol 1.0.0 published**

The operational README for each package is collected in [`PACKAGES.md`](PACKAGES.md). This document explains the boundary; the READMEs explain how to run each implementation.

## Why

The host must accept independent extensions without turning every example into an application dependency. The solution is to separate the public compatibility boundary from the runtime that executes the host.

## What

There are three areas, with one-way dependency flow:

```text
in-process add-on ─┐
HTTP add-on -------┼──► @addons-poc/protocol (contract and SDK)
host-app/runtime ---┘
          host-app ──► protocol
```

The host does not import add-ons, catalog embedded metadata, or declare any
`addon-*`. Each add-on declares its contract and publishes a manifest URL. The
Settings screen offers a convenience list of local `manifest.json` URLs and
reads only `name` and `description` to present each row; it does not import
bundles or know specific services. Add-ons do not import other add-ons.

Chord editing is a concrete example of that boundary. The catalogue publishes
chart content over HTTP; the viewer exposes `addons.chords.viewer` and may
consume `addons.chords.drafts`; the editor provides that draft service and
consumes the viewer and `state-store`. The host's optional
`host.content-editor` convention accepts a result URL and returns an editing
view. It does not parse chart text, import Monaco, or know which add-on provides
the editor. The first release stores drafts only in the browser and does not
write to the published catalogue.

The package was published to npm and tested in a clean consumer. Consumer
packages use `@addons-poc/protocol@1.0.0` from the registry, while the source in
`packages/protocol` remains in the workspace for tests and new versions.

| Area | Responsibility | May depend on |
|---|---|---|
| `packages/protocol` | Types, JSON Schema, SemVer, validators, descriptors, and SDK | pure rules only |
| `packages/host-app/src/runtime` | ESM loader, registry, status, negotiation, priority, and adapters | protocol and platform APIs |
| `packages/host-app/src/components` | Management, review, and generic UI | protocol and local runtime |
| `packages/addon-*` | Domain implementations and examples | protocol; HTTP also uses `addon-server` |

The protocol's public API is the `packages/protocol/src/index.ts` entry point,
and the distribution contains `dist`, schema, README, license, and
`package.json`. Auxiliary sources kept in the workspace for migration tests do
not represent an export and do not put runtime or domain helpers back into the
public boundary.

## The public contract

`AddonManifest` contains metadata, an optional `entrypoint` URL, and one
`contract` v1 section. The contract records:

- protocol range and required/optional capabilities;
- provided or consumed services with versions, methods, and schemas;
- declarative UI (`ui.tab`), state, HTTP, and logs;
- data classification: `public`, `personal`, or `secret`.

`validateManifest` rejects a missing contract, invalid capabilities,
non-namespaced services, incompatible methods, and undescribed HTTP resources.
The equivalent JSON Schema is packaged in `@addons-poc/protocol/schema`.

## Host internal runtime

### Loader and states

`FetchAddonLoader` fetches the manifest, validates the protocol and capabilities,
imports the ESM bundle only after validation, and checks that the exported
`manifest` has the same contract fingerprint as the remote manifest. An import
failure becomes an `error` instance. If `setup` or tab creation fails, the
loader calls `onUnload` callbacks, removes services for that URL with
`clearAddon`, and returns an `error` instance.

This recovery still has a limit: `unloadAll` does not catch callback exceptions.
If one fails, it interrupts the remaining callbacks and prevents `clearAddon`
and the normal error-instance return. The test
[`loader.test.ts`](../packages/host-app/src/runtime/loader.test.ts) proves
registration removal after a `setup` failure without cleanup callbacks; it does
not prove recovery when cleanup itself fails.

Disabling or removing an instance in `App.tsx` clears its services and
reevaluates dependencies, but does not call `onUnload` callbacks. Completing
this unload cycle is the next task recorded in [PHASES.md](PHASES.md).

### Registry and priority

`ServiceRegistry` lives in `packages/host-app/src/runtime/registry.ts`. It
stores implementations by identifier, source add-on, and priority. Ordering is
deterministic (highest priority first). The registry does not know React, HTTP,
or domain details.

### Service proxy

The SDK provides `host.services.use({ id, version, methods })`. The host only
provides a service that appears in the consumer's contract and applies the
`state-store` guard to declared keys. Required calls without a provider leave
the installation blocked and are reevaluated after a new activation. Required
dependency cycles are blocked; fallback is explicit in the runtime.

### Review and persistence

Settings stores URLs, disabled state, and the accepted fingerprint in
`addons:host-installations:v1`. The same URL with a changed contract returns to
review. The host does not mix this configuration with add-on state storage.

On startup and whenever a provider changes, the host reloads the affected
add-ons in required-dependency order. It first clears the selected instances,
then activates their required providers before their consumers. Clearing and
reloading those add-ons in parallel could make a consumer see a provider only
while it is temporarily absent and incorrectly leave the consumer blocked.
Optional dependencies do not create an ordering edge.

The result limit for each add-on that offers search is also stored in this
configuration and associated with the manifest URL. Resources that declare
accepted languages receive a language choice in the same configuration; the
host sends the selected value as `lang` in HTTP routes and preserves the choice
in content URLs. Search results do not belong in this key: when a `state-store`
provider exists, the host stores the query, rows, and cursors under
`host:search:results:v1`, following the same optional persistence boundary used
by add-ons.

The same limit and language can be edited in the extension sidebar during the
demo and on the Settings screen; both controls update the same per-URL
configuration.

## Two add-on formats

### In process

The manifest points to an HTTP(S) `entrypoint`. The bundle exports `manifest`,
`setup`, and `createTab`. `HostAPI` is deliberately small: `services`,
`registerService`, `onUnload`, and `log`. The host renders the tab without
knowing its internal rules.

### HTTP

`@addons/addon-server` publishes `manifest.json`, catalog, search, text options,
and content. The server and the remaining HTTP example use plain ESM. They
validate with the public protocol but do not import the host's TypeScript
runtime. External I/O must appear in `contract.http`; v1 makes the declaration
visible but does not intercept direct `fetch` calls.

In the public text profile, `TextPageRequest` carries `limit` and `cursor`,
while `TextPagination` returns the page size, known total, and next opaque
cursor. These fields are optional so older add-ons can continue responding with
only `{ metas: [...] }`. A resource may declare `languages` when it offers a
language choice; the host forwards that choice in the `lang` query parameter,
and the add-on must preserve it in content links when necessary.

When installing a manifest without an `entrypoint`, the loader creates a tab
with its title and description. The host's global interface detects declared
`search` resources, queries all active add-ons, and turns each `metas` response
into a row with `type`, `id`, `url`, `name`, and `description`, plus `emoji` or
`image` when available. The content URL generated by the server acts as a
fallback when the meta does not provide one. A response may include
`pagination.next`; in that case, the host preserves one cursor per provider and
offers **Previous page** and **Next page**, with the current page between them,
at the beginning and end of the table. Changing pages replaces the rows with
the requested page without accumulating the previous one. A per-add-on limit
defines the requested page size; the absence of `next` from a provider ends its
listing. A source failure is shown in the table and does not prevent other
responses. The search term and page remain in the URL through `nuqs` (`q` and
`page`). On the home page, the table uses the full available width.

An empty search term does not empty the page: the host reads the first catalogue
each active add-on declares (`catalog` resource plus `catalogs` entries) and
lists those items with the same page size, cursor, pagination buttons, and `page`
parameter. One catalogue per add-on, because a domain that publishes several
views of the same items would repeat every row.

The **Settings** page is the only place that configures add-ons, and it opens the
detail route of an installed add-on in the form `#/addons/<encoded-manifest>`
without repeating the search listing. To reduce the listing width, the
presentation does not create a `URL` column: the row name receives the hyperlink
to the URL preserved in the result model.

The adapter lives in `packages/host-app/src/search.ts` and calls `fetch`
directly, without adding the host runtime to the public protocol. The header
keeps a fixed search field: **Enter** starts the query and **Esc** clears the
field and results. The table exists even when no add-ons are installed. The
basic `{ metas: [...] }` form and optional `pagination` shape are checked in the
host; complete validation of all HTTP resources, catalog, and reading remains
pending.

## Two add-ons collaborating without importing each other

The chord-chart pair is the working example of decision 16. The catalogue
(`addon-chord-catalog`) is an HTTP add-on that publishes a data set with
`catalog`, `search`, and `text` resources. The viewer (`addon-chord-viewer`) is
an in-process add-on that renders a chart with controls.

The viewer knows the catalogue only by its manifest URL. It reads
`/text/chart/{id}.json` and then the content URL that the catalogue returns, so
the flow is the same two-stage delivery used by the host, and either add-on can
be replaced by another that publishes the same routes. The host contains no
knowledge of chords: it shows search rows from the `search` resource, prints the
response body when there is no view, and inserts the HTML view when the add-on
publishes one. The format and the controls are described in
[`CHORD-CHART.md`](CHORD-CHART.md).

## The add-on interface

An add-on page puts the controls in a panel that stays visible while the response
scrolls, the way the AC viewer keeps its dial panel beside the chart. The layout
is generic: the host renders the declared fields and actions in `AddonTabView`,
uses the optional `group` of each control as a heading, and renders the declared
control kind — slider, toggle, colour, or text. An action marked `live` runs
again after the person stops moving a control, and an action may return `values`
to move the controls it rewrote. The panel is sticky on wide screens and moves
above the response on narrow ones.

## Rendering a result page

A rendered result uses the whole window: it is a panel, not prose, and a wider
chart wraps fewer lines. The article layout keeps its readable width, so only the
page that an add-on rendered loses the cap.

The dedicated page of a search result used to know only the article payload. It
now asks the active add-ons for a rendered view first, through the service
declared by convention as `host.content-view`: the provider receives the content
URL and returns HTML or nothing. The chord viewer provides it, which is why
clicking a chart row opens the rendered chart instead of an empty article
header, while a Wikipedia result keeps its own layout. The page also renders the **control panel of the add-on behind the view** — the
same component the add-on page uses — so a change made beside the chart renders
it again. That is the shape of the AC viewer's version page: chart and dial panel
side by side. The convention is recorded in
[decision 23](DECISIONS.md#23-the-host-renders-a-result-through-a-declared-service).

## Optional official capability

`state-store` is the standard persistence service. `storage-local` provides
`localStorage` with priority 10; `storage-session` provides `sessionStorage`
with priority 0. Consumers declare the dependency in their contract and remain
in memory when it is optional and unavailable.

## Trust limits

This POC accepts trusted plugins in the same process. The contract provides
governance and compatibility, not isolation. Sandboxing, iframe/Worker
execution, a network proxy, cryptographic signatures, and global API blocking
are outside v1.
