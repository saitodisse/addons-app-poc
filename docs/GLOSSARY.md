# Glossary

This glossary explains the technical names used in the project. Read the short definition first; the second sentence goes deeper when necessary.

| Term | Progressive definition |
|---|---|
| **Adapter** | Host-internal code that connects a rule to a concrete technology. Adapters are not part of the public package. |
| **Add-on** | An independent extension that provides a capability to the host. It may be a module executed by the host or a server queried over HTTP. |
| **AddonInstance** | A record of a load result. It contains the manifest, identity URL, state, optional error, and services reported as loaded. |
| **AddonLoader** | Host-internal runtime that turns a manifest URL into an `AddonInstance`. |
| **AddonTab** | Executable description of an active add-on's tab. It contains a title, body, fields, actions, and the function that produces a response. |
| **state-store** | Optional official service that stores a serializable value by key. `storage-local` and `storage-session` provide it; without it, an add-on keeps only its current state in memory. |
| **API** | A contract used by two components to communicate. In this project, it may be a TypeScript interface or a set of HTTP routes. |
| **Bundle** | JavaScript file ready for execution. The loader imports the ESM bundle indicated by `entrypoint`. |
| **Global search** | Fixed host field that queries `search` HTTP resources from all active add-ons. The response is combined in the central table without add-on-specific code. |
| **Catalog** | Browsable collection announced by an HTTP add-on. The catalog route returns items in the `metas` field. |
| **Service composition** | Building a service from other services in the registry. Favorites, for example, query `state-store` without importing the host. |
| **Data classification** | A `public`, `personal`, or `secret` label for declared data. It explains the expected handling without placing the real value in the manifest. |
| **Protocol contract** | The required `contract` v1 block in a manifest. It explains the version, capabilities, services, UI, state, HTTP, and logs an add-on declares. |
| **Service proxy** | Object returned by `host.services.use(contract)`. It exposes only the declared capability and validates calls at runtime. |
| **CORS** | Browser rule for requests between different origins. The local server enables CORS so the host on port `5280` can query port `5294`. |
| **Domain** | The area containing pure rules. The public package avoids dependencies on React, the network, and concrete storage. |
| **Endpoint** | Combination of an HTTP method and route. `GET /manifest.json` is an endpoint. |
| **Entrypoint** | URL of an in-process add-on's ESM bundle. `FetchAddonLoader` uses it with `import()`. |
| **ESM** | Modern JavaScript module format, short for ECMAScript Modules. It uses `import` and `export`. |
| **Fallback** | Explicit attempt at an alternative after a failure. The runtime walks through services by priority; the helpers that do this are internal and are not exported by the public protocol. |
| **HTTP format** | An add-on executed as an independent server. It declares routes and schemas in `contract.http`. |
| **In-process format** | An add-on executed in the same JavaScript process as the host. It declares services in `contract`, points to an `entrypoint`, and exports `manifest`, `setup`, and `createTab`. |
| **Handler** | Function that responds to a server operation. `addon-server` receives catalog, search, text, and content handlers. |
| **Host** | Application that activates add-ons and uses their services. The current `@addons/host-app` contains no add-on implementation and imports none. |
| **HostAPI** | Small API delivered to an add-on during `setup`: `services`, `registerService`, `onUnload`, and `log`. |
| **Identity** | Value used to tell whether two references point to the same add-on. In this protocol, it is the complete manifest URL. |
| **Persisted installation** | Local host configuration with installed URLs and disabled extensions. It allows the add-on set to be rebuilt after reloading without automatically persisting each add-on's state. |
| **Contract fingerprint** | Local identifier calculated from the accepted contract. It detects changes at the same URL but is not a signature or proof of authorship. |
| **Lazy loading** | Loading performed only when needed. The host downloads full text only after a user opens a result. |
| **Manifest** | Document that presents an add-on before use. It declares metadata and capabilities in a JSON-compatible format. |
| **Tab response** | Declarative result of an add-on action, with state, text, and optional items displayed by the host. An item may include `details`, the full JSON that the host reveals only after a click. |
| **Contract review** | State in which an installation remains disabled until the person accepts a new interaction declaration found at the same URL. |
| **Tab persistence** | Bridge declared by the tab itself with `load` and `save`. It lets the host restore fields and responses without knowing what the data means. |
| **Metas** | List of metadata returned by a catalog or search. Each item contains at least `id`, `type`, and `name`. |
| **Result row** | Normalized form displayed by the host table for a search meta: type, ID, URL, name, and description, with optional emoji or image. |
| **Search limit** | Maximum number of rows the host accepts from each add-on in a query. The value is configurable per manifest and does not change the remote API. |
| **Resource language** | Code declared in `resources[].languages` that states which languages an HTTP resource accepts. The host sends the choice in `lang` and lets the add-on decide how to query its source. |
| **Pagination** | Splitting a listing into smaller pages. `limit` selects the requested size, and `cursor`/`next` continues the same query without exposing the provider's implementation. |
| **Port** | Interface that describes a need. Do not confuse it with a TCP port such as `5294`. |
| **Priority** | Number that orders implementations of the same service. The higher the number, the earlier it is queried. |
| **External processing** | Work an add-on delegates to another API. The Poems and Wikipedia add-ons transform public responses into this POC's contract. |
| **POC** | Proof of concept. An experiment used to validate an idea, not a promise of production readiness. |
| **Resource** | Capability declared by an HTTP add-on, such as `catalog`, `search`, or `text`. Each resource corresponds to a family of routes. |
| **Registry** | Host-internal registry. It is the meeting point between service providers and consumers; it is not exported by the public protocol. |
| **Sandbox** | Isolated environment that limits what code can access. The in-process add-ons in this POC do not have one yet. |
| **SemVer** | Versioning convention using major, minor, and patch parts, such as `2.4.1`. Providers publish `X.Y.Z`; consumers may also request simple ranges such as `^X.Y.Z` or `~X.Y.Z`. |
| **Service descriptor** | Declaration in `contract.services` with a namespaced identifier, role, version, methods, and schemas. |
| **Service** | Capability provided by an add-on or the host. `addons.hello.greeter` and `state-store` are examples. |
| **Setup** | Function that activates an in-process add-on. It receives `HostAPI` and normally registers one or more implementations. |
| **Texts** | List of content options returned by the `text` resource. Each item states `id`, `url`, `lang`, and `name`. |
| **Validation** | Structural check performed before consumption. It reduces invalid inputs but does not prove security, availability, or truthfulness. |

The operational map of all packages is in [`PACKAGES.md`](PACKAGES.md).
