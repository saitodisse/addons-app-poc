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

The live demo opens from the gear icon in a responsive modal; selecting an
active extension navigates to a dynamic detail route in the form
`#/addons/<encoded-manifest>` without repeating the home listing. To reduce the
listing width, the presentation does not create a `URL` column: the row name
receives the hyperlink to the URL preserved in the result model.

The adapter lives in `packages/host-app/src/search.ts` and calls `fetch`
directly, without adding the host runtime to the public protocol. The header
keeps a fixed search field: **Enter** starts the query and **Esc** clears the
field and results. The table exists even when no add-ons are installed. The
basic `{ metas: [...] }` form and optional `pagination` shape are checked in the
host; complete validation of all HTTP resources, catalog, and reading remains
pending.

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
