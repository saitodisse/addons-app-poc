# `@addons-poc/protocol`

The agreement between an application and its add-ons.

Version `1.0.0` · [MIT](LICENSE) license · public ESM package.

## In one sentence

The protocol is a set of rules that lets the main application, called the
**host**, understand and run add-ons created separately.

This is the standard for `addons-app-poc`. It is not intended to be a universal
standard.

## Why this protocol exists

Imagine the host as a video game and each add-on as a cartridge. They must agree on the shape of the connection before they can work together.

In this project, that connection must answer simple questions:

- who created the add-on and what version it has;
- what it provides and what it needs;
- which fields and buttons it wants to show;
- which data it wants to store;
- which internet calls it makes;
- which messages it may record.

Without these rules, the host would need to know every add-on in advance. With
the protocol, it reads a public description, checks compatibility, and only then
decides whether it can activate the extension.

## What makes up the protocol

### The manifest is the presentation card

Every add-on publishes a file called `manifest.json`. It states the name,
version, description, authorship, license, and interaction contract.

The add-on's true identity is the complete URL of this manifest, for example:

```text
https://example.com/addons/hello/manifest.json
```

Two manifests at different addresses are treated as two add-ons, even if they
have the same name or `id`.

### The contract is a promise before execution

The manifest contains one `contract` section. It describes everything the add-on
declares that it does:

| Part | Simple explanation |
|---|---|
| `protocol` | Version of the rules the add-on understands |
| `capabilities` | Required or optional resources it expects from the host |
| `services` | Services it provides or wants to use |
| `ui` | Fields, buttons, and responses for its screen |
| `state` | Data it wants to store and allowed operations |
| `http` | Incoming or outgoing internet calls |
| `logs` | Structured messages it may record |
| `resources` | HTTP resources such as a catalog, search, or text |

The official capabilities are `registry.services`, `ui.tab`, `logs`, and
`state-store`. Custom capabilities and services use namespaced names such as
`addons.hello.greeter` to avoid collisions with other projects.

Received and returned information is also classified as:

- `public`: public information;
- `personal`: information related to a person;
- `secret`: sensitive information such as a credential.

The contract describes the data type and classification. Real passwords,
tokens, and other secrets must not be stored in the manifest.

## How installation happens

```text
Person enters the manifest URL
                ↓
Host downloads and validates manifest.json
                ↓
Host shows the contract for review
                ↓
Host checks versions, resources, and services
                ↓
Add-on becomes ready, blocked, or errored
```

The host validates metadata, protocol version, capabilities, services, and data
schemas. A schema is a verifiable description of an information format. v1
accepts strings, numbers, integers, booleans, null values, objects, and arrays.

An instance can pass through these states:

| State | Meaning |
|---|---|
| `loading` | The host is still loading the add-on |
| `ready` | The add-on was validated and is ready |
| `blocked` | The contract is known, but a required dependency is missing |
| `error` | The manifest, bundle, or initialization failed |

Missing required dependencies and cycles between add-ons block activation. When a new provider appears, the host can reevaluate blocked instances.

After human review, the host stores a contract fingerprint with the URL. If the
contract changes at the same address, the person must review it again. This
fingerprint detects changes but is not a digital signature and does not prove
authorship.

## The two add-on formats

### In-process add-on

This is an ESM JavaScript module loaded by the host. Its manifest contains an
`entrypoint` that points to the JavaScript bundle.

The module exports three items:

```ts
manifest
setup(host)
createTab(host)
```

Before executing the bundle, the host checks that the internal manifest has the
same identity, version, and contract as the public manifest. During `setup`, the
add-on receives a small API:

```ts
host.services
host.registerService
host.onUnload
host.log
```

The add-on may register only declared services. The host also checks interactions
that pass through its mediation. If initialization fails, it removes partial
registrations and leaves the instance in `error`.

### HTTP add-on

This is an independent server and has no `entrypoint`. It publishes
`GET /manifest.json` and declares resources such as `catalog`, `search`, and
`text`. A resource may declare `languages` when it accepts a language choice;
the host shows this setting per provider and sends the choice as `lang` in the
query.

Catalog and search return metadata and may split responses into pages. The next
request repeats the route with `limit`, the opaque `cursor` returned in
`pagination.next`, and, when declared, `lang`:

```text
GET /search/page/term.json?limit=20&cursor=...&lang=en
```

A paginated response uses this shape:

```json
{
  "metas": [{ "id": "text-1", "type": "page", "name": "Page" }],
  "pagination": { "limit": 20, "total": 42, "next": "opaque-cursor" }
}
```

`pagination` is optional to preserve compatibility with older add-ons. An
absent `next` field means there is no other page. Full content is fetched only
when a person chooses an option. A text resource uses this envelope:

```json
{
  "texts": [
    {
      "id": "text-1",
      "url": "https://example.com/text/text-1/content.txt",
      "lang": "en-US",
      "name": "Primary version"
    }
  ]
}
```

The add-on should preserve `lang` in content links when the response needs to
keep the language during navigation. The server is plain ESM, does not know
React, and does not load the host's internal runtime.

## Manifest example

This example declares an in-process add-on that provides a greeting service:

```ts
import {
  defineAddonManifest,
  validateManifest,
} from '@addons-poc/protocol';

export const manifest = defineAddonManifest({
  id: 'hello',
  version: '1.0.0',
  name: 'Hello Add-on',
  description: 'Creates a greeting for the provided name.',
  author: 'AC Team',
  license: 'MIT',
  entrypoint: 'https://example.com/addons/hello/bundle.js',
  contract: {
    version: '1.0.0',
    protocol: { version: '1.0.0', range: '^1.0.0' },
    capabilities: {
      required: ['registry.services', 'ui.tab'],
      optional: ['logs', 'state-store'],
    },
    services: [{
      id: 'addons.hello.greeter',
      role: 'provides',
      version: '1.0.0',
      name: 'Greeting',
      description: 'Produces personalized greetings.',
      methods: [{
        id: 'greet',
        description: 'Greets a person by name.',
        receives: {
          description: 'Person name.',
          schema: {
            type: 'string',
            description: 'Name used in the greeting.',
            classification: 'personal',
          },
        },
        returns: {
          description: 'Produced message.',
          schema: {
            type: 'string',
            description: 'Greeting text.',
            classification: 'personal',
          },
        },
      }],
    }],
    ui: {
      title: 'Greeting',
      body: 'Enter a name to receive a greeting.',
      fields: [{
        id: 'name',
        label: 'Name',
        description: 'Name used to create the message.',
        required: true,
        schema: {
          type: 'string',
          description: 'Person name.',
          classification: 'personal',
        },
      }],
      actions: [{
        id: 'greet',
        label: 'Greet',
        description: 'Creates the greeting.',
        receives: ['name'],
        returns: {
          description: 'Response displayed by the host.',
          schema: {
            type: 'object',
            description: 'Action result.',
            classification: 'personal',
          },
        },
      }],
    },
    state: [],
    http: [],
    logs: [],
  },
});

const result = validateManifest(manifest);
if (!result.valid) throw new Error(result.errors.join('; '));
```

## How services communicate

An add-on does not request a service by name alone. It also states the version and methods it expects:

```ts
const greeter = host.services.use<{ greet(name: string): string }>({
  id: 'addons.hello.greeter',
  version: '^1.0.0',
  methods: [{ id: 'greet' }],
});
```

In the contract, `provides` means “offers this service,” and `consumes` means
“needs to use this service.”

The provider declares an exact version such as `1.0.0`. The consumer may accept
a range such as `^1.0.0`. The host compares the identifier, version, methods,
inputs, and outputs before connecting them.

When several compatible providers exist, the host chooses the one with the
highest priority. A missing required service blocks the consumer; an optional
service may let it continue, for example by using memory only.

The official `state-store` service provides serializable storage. The contract
limits which keys and operations, such as reading or writing, each add-on may
use.

## Three versions that must not be confused

| Version | Example | What it represents |
|---|---|---|
| npm package | `@addons-poc/protocol@1.0.0` | The library distribution |
| Contract | `contract.version: 1.0.0` | Compatibility rules between host and add-on |
| Add-on | `manifest.version: 1.0.0` | The version of that specific extension |

Updating an add-on does not necessarily mean updating the protocol. An incompatible protocol change requires a new major version. Removing a method or changing its meaning also requires a new major version of that service.

## What this package publishes

The main exports are in [`src/index.ts`](src/index.ts): contract types,
`defineAddonManifest`, validators, SemVer negotiation, mediated service access,
tab persistence, and `HostAPI` types.

The equivalent schema is in
[`schema/addon-contract.schema.json`](schema/addon-contract.schema.json) and can
be imported from `@addons-poc/protocol/schema`.

The package distributes ESM JavaScript, TypeScript declarations, JSON schema,
README, license, and `package.json` metadata. Auxiliary files used only in
workspace tests are not part of the public API.

The package does not export a loader, service registry, add-on catalog, or
runtime fallback helpers. Those responsibilities live in
`packages/host-app/src/runtime`. Add-ons also do not depend on the host or other
add-ons: collaboration happens through the public protocol.

## Version 1 limits

The protocol provides validation and transparency, but it is not a complete
security barrier:

- it does not run the add-on in an isolated environment;
- it does not technically block internet calls;
- it does not prove who published the manifest;
- the fingerprint is not a cryptographic signature;
- `onUnload` accepts callbacks, but complete unloading when disabling or removing an instance is not finished;
- complete HTTP validation, caching, and automatic updates are outside this version.

Therefore, v1 is designed for trusted add-ons. The `contract.http` declaration
provides transparency for review, but it is not yet a technically enforced
network permission.

## How to install and validate

```bash
npm install @addons-poc/protocol@1.0.0
```

In the repository:

```bash
pnpm --filter @addons-poc/protocol test
pnpm --filter @addons-poc/protocol build
cd packages/protocol
npm pack --dry-run
```

`@addons-poc/protocol@1.0.0` is already published to npm. To confirm the distributed version, run:

```bash
npm view @addons-poc/protocol@1.0.0 version dist.tarball
```

A future version requires an authenticated account and confirmed ownership of
the `@addons-poc` scope. There is no automatic fallback to another name.

## Continue reading

Read the [manifest specification](../../docs/MANIFEST-SPEC.md), the
[architecture](../../docs/ARCHITECTURE.md), and the [package index](../../docs/PACKAGES.md)
when you need deeper technical details.
