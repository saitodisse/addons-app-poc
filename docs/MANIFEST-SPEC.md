# Add-on manifest specification

**Status: Delivered · Version 1.0.0**

Implementation examples for each manifest are in the READMEs listed in
[`PACKAGES.md`](PACKAGES.md). The contract on this page is the shared reference
for the host, protocol, and add-ons.

## Why

The host must decide whether it can install an extension before importing its
bundle or calling its server. A complete manifest makes that decision readable
to people and verifiable by code.

## What

The complete manifest URL is the add-on's identity. The legacy format is not
accepted. Every manifest has metadata and one `contract` v1 section. The
contract is a compatibility and governance boundary for trusted plugins; it is
not a sandbox.

## Minimum manifest

```json
{
  "id": "hello",
  "version": "1.0.0",
  "name": "Hello Add-on",
  "description": "Provides a greeting.",
  "author": "AC Team",
  "license": "MIT",
  "entrypoint": "https://example.com/addons/hello/bundle.js",
  "contract": {
    "version": "1.0.0",
    "protocol": { "version": "1.0.0", "range": "^1.0.0" },
    "capabilities": {
      "required": ["registry.services", "ui.tab"],
      "optional": ["logs", "state-store"]
    },
    "services": [{
      "id": "addons.hello.greeter",
      "role": "provides",
      "version": "1.0.0",
      "name": "Greeter",
      "description": "Creates greetings.",
      "methods": [{
        "id": "greet",
        "description": "Greets a name.",
        "receives": { "description": "Name", "schema": { "type": "string", "description": "Name", "classification": "personal" } },
        "returns": { "description": "Greeting", "schema": { "type": "string", "description": "Text", "classification": "personal" } }
      }]
    }],
    "ui": {
      "title": "Hello",
      "body": "Enter a name.",
      "fields": [{ "id": "name", "label": "Your name", "description": "Name used in the greeting.", "required": true, "schema": { "type": "string", "description": "Name", "classification": "personal" } }],
      "actions": [{ "id": "greet", "label": "Greet", "description": "Creates the greeting.", "receives": ["name"], "returns": { "description": "Response", "schema": { "type": "object", "description": "Tab response", "classification": "personal" } } }]
    },
    "state": [],
    "http": [],
    "logs": []
  }
}
```

`entrypoint` exists only for in-process add-ons. An in-process bundle exports
`manifest`, `setup(host)`, and `createTab(host)`. An HTTP add-on omits
`entrypoint` and declares its resources in `contract.resources`, related to the
incoming HTTP interactions from the same `contract`; the server continues to
respond to `GET /manifest.json` and catalog, search, and text routes.

## How the host validates

1. It checks metadata (`id` in kebab-case, `X.Y.Z` version, author, license,
   and description).
2. It checks `contract.version`, the protocol version, and the SemVer range.
3. It checks official capabilities (`registry.services`, `ui.tab`, `logs`,
   `state-store`) or namespaced names.
4. It checks descriptors: each service has an ID, role, version, methods, and
   schemas. A provider publishes an exact version; a consumer may declare a `^`
   or `~` range. Unofficial services use `namespace.name`.
5. It checks UI, state, HTTP, and logs. The JSON Schema subset accepts `string`,
   `number`, `integer`, `boolean`, `null`, `object`, and `array`, plus
   `properties`, `required`, `items`, `enum`, `uri`, and `date-time`.
6. It negotiates the capabilities and required services available in the host.

The canonical validator is `validateManifest` from
`@addons-poc/protocol`. The distributed JSON Schema can be imported from
`@addons-poc/protocol/schema`. The public package does not export
`ServiceRegistry`, the loader, or fallback helpers; those responsibilities live
in the host runtime.

## Services and typed proxy

The add-on does not use the legacy string-based lookup API. It requests the
contract it needs:

```ts
const greeter = host.services.use<Greeter>({
  id: 'addons.hello.greeter',
  version: '1.0.0',
  methods: [{ id: 'greet' }]
});
```

The host only provides a service declared by the consumer or provider. Methods,
inputs, and outputs must remain compatible. Changing the meaning or removing a
method requires a new major service version. Providers are ordered by priority;
fallback is an explicit runtime operation.

The optional official `state-store` service may be provided by the host or an
add-on. A consumer sets `required: true` when it cannot operate without it.
Without a provider, an optional consumer remains in memory.

## UI, state, HTTP, and logs

`contract.ui` declares the title, body, fields, actions, and response schemas.
`contract.state` declares the key or pattern, operations, retention, and
deletion. `contract.http` records incoming and outgoing interactions, with a
method, route template, origin, and purpose. `contract.logs` describes
structured events and their classification.

The host validates actions and state at runtime. Direct external I/O remains
possible for trusted plugins: the HTTP declaration provides transparency and
review, not interception. `onUnload`, sandboxing, and a network proxy are
outside v1.

## Compatibility and states

Before importing a bundle, the host may reject an incompatible contract. A
missing required service leaves the installation blocked, and it is reevaluated
when a compatible provider appears. Required dependency cycles are blocked. A
`setup` failure clears partial registrations and leaves the instance in
`error`.

After human review, the host stores a `contract` fingerprint with the URL. A
change at the same URL requires a new review. The fingerprint is not a
cryptographic signature and does not prove authorship.

## HTTP text profile

Text resources keep this envelope:

```json
{ "texts": [{ "id": "text-1", "url": "https://example.com/text/text-1/content.txt", "lang": "pt-BR", "name": "Primary version" }] }
```

Catalog and search return metadata. Both may accept `limit`, `cursor`, and, when
the resource declares `languages`, `lang` in the query string and return
optional `pagination` with optional `limit`, `total`, and `next`. The cursor is
opaque and should only be reused for the same query. Content is fetched only
when a person opens an option. The server is plain ESM, does not know React,
and does not depend on the host's internal runtime.

`languages` is optional on a resource item and contains language codes accepted
by the add-on. The host displays a per-provider selector and keeps `lang` in
content links when the server offers that behavior.
