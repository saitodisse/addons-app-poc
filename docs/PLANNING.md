# The planning journey

This document tells how the architecture took shape. It is a historical narrative, not a list of current rules. To consult the active contracts, use `ARCHITECTURE.md`, `DECISIONS.md`, and `MANIFEST-SPEC.md`.

## Current state after public protocol v1

The historical plan became an implementation compatible with
`@addons-poc/protocol@1.0.0`. The old core mixed the registry, loader, and domain
helpers; today the public package contains only the contract, schema, validators,
and SDK, while the loader, registry, status, and adapters live in
`packages/host-app/src/runtime`. All manifests use one `contract` v1 section,
including HTTP servers, and every add-on has its own README in the [package
index](PACKAGES.md).

`@addons-poc/protocol@1.0.0` was published to npm after confirming the account
and ownership of the `@addons-poc` scope. Consumers now point to the registry
version, with no automatic compatibility with the legacy format and no
publication under another name.

## 1. The initial discomfort

The conversation started with a common problem in modular systems: parts that should have been replaceable were connected by direct dependencies. Replacing an implementation meant changing imports, rebuilding applications, and coordinating many versions at once.

The context that inspired the conversation involved other projects, but the conclusion was to create this POC as an independent laboratory. The `addons-app-poc` is not part of the AC ecosystem and does not depend on it.

## 2. The first idea: request capabilities, not packages

The initial inspiration came from service containers and inversion of control. The technical name matters less than the change in the question.

Instead of writing “import exactly package X,” the consumer says “I need something that fulfills contract Y.” A registry presents the available implementation.

This brought the first design component: `ServiceRegistry`.

```text
consumer ── requests "greeter" ──► registry
                                      ▲
                                      │ registers "greeter"
                                    add-on
```

The registry would solve coupling inside the process. It was still necessary to understand how to publish, discover, and replace extensions independently.

## 3. The manifest enters the story

An add-on needed to introduce itself before executing. The manifest was born: a readable object that declares name, version, authorship, license, and capabilities.

The most important decision was to use the **manifest URL as identity**. The `id` field could remain friendly, but the complete location would be the stable value used by the host.

This choice opened a possibility: the add-on could live outside the repository and be found by address.

## 4. The Stremio lesson

Stremio's protocol showed a useful boundary. The main application does not need to import every add-on; it can communicate with independent servers through a predictable set of resources.

The POC adopted this organization as a technical reference and adapted it for text:

| Media reference | Adaptation in this POC |
|---|---|
| remote manifest | remote manifest |
| item catalog | catalog of texts, quotes, poems, or pages |
| search | search in the add-on's source |
| subtitle options | text options with a content URL |
| content loaded later | plain text loaded on demand |

The goal was not to copy an entire product. It was to learn from the separation between host, contract, and external server.

## 5. The first POC: everything in process

Starting with servers would have mixed networking, protocol, and interface too early. The first step was smaller:

1. define `AddonManifest`;
2. validate the object;
3. create `ServiceRegistry`;
4. define `HostAPI`;
5. load a module with `manifest` and `setup`;
6. prove the flow with a greeting and counter;
7. show the result in a React host.

This order turned every abstraction into something observable. The counter proved state. The greeting proved a simple contract. The host proved that services could reach the interface.

## 6. The grilling: questions that hardened the design

The plan was subjected to difficult questions. The answers became durable decisions:

- How do we distinguish two add-ons with the same name? By manifest URL.
- How do we inspect before executing? By separating `manifest` and `setup`.
- How much of the host should be exposed? Only a small `HostAPI`.
- Where do providers and consumers meet? In `ServiceRegistry`.
- Who wins when there is competition? The highest explicit priority.
- What happens if activation fails? The instance enters an error state.
- What happens if the preferred service fails? Fallback tries the next one.
- Which module format should be used? Native ESM.
- What deserves tests first? The protocol's critical rules.

The complete answers, including current consequences and gaps, are in `DECISIONS.md`.

## 7. Plan B becomes part of the protocol

After two implementations could coexist, an important difference appeared: ordering is not the same as execution.

The registry became responsible only for the ordered list. `withFallback` and `withFallbackAsync` received responsibility for calling each implementation and handling exceptions; they remain internal helpers covered by tests, not exports of the public library.

`addon-hello-pt` made the idea visible. It has higher priority but intentionally fails for the name `error`. At that point, the default greeter takes over.

This demonstration showed that replacement does not need to be a build decision. It can be a runtime decision made at call time.

## 8. The turn toward independent servers

After the in-process flow worked, the project returned to the larger question: can an add-on live anywhere?

The second format appeared. An HTTP add-on omits `entrypoint`, declares `resources`, `types`, and `catalogs` inside the same `contract` section, and responds over HTTP. The host does not execute the server; it makes HTTP requests.

`@addons/addon-server` was created to reduce repetitive work. An add-on supplies four functions, and the framework builds the manifest, catalog, search, text options, and content routes.

Three sources proved different aspects:

- the Library showed content local to the server;
- Web Quotes showed transformation of a simple API;
- Poems showed search and reading from an external API.

Wikipedia later added a fourth source and reinforced that the same contract could hide different source APIs.

## 9. On-demand delivery

Sending complete texts during a search would waste bandwidth. The solution was to adapt the subtitle-options format: the add-on returns metadata and a URL, and the host fetches content when the user opens the item.

```text
search ──► metadata ──► choice ──► text options ──► content
```

This sequence keeps initial responses small and allows more than one version or language in the future.

## 10. Add-ons start collaborating

After proving isolated add-ons, the POC began demonstrating composition:

- the aggregator queries several servers and merges results;
- Favorites uses storage provided by the host;
- Health queries the same servers to measure availability;
- the formatter keeps its pure rules in the add-on that uses it.

The central point is that none of these extensions imports another extension. They know contracts or URLs, and the registry remains the boundary inside the process.

## 11. What implementation taught us

The code revealed differences between a designed architecture and one actually demonstrated. The Settings screen began fetching manifests by URL, displaying the interaction contract before installation, and restoring choices after F5. For in-process modules it calls `FetchAddonLoader`; for HTTP manifests it preserves the declaration and its generic tab.

This evolution also made clear what contract review does and does not do. The accepted fingerprint detects a change at the same URL and blocks reactivation until it is read again, but it does not prove authorship or prevent in-process code from using browser APIs.

Basic cleanup after `setup` failure already exists: the loader calls `onUnload` callbacks, removes registered services, and returns `error` state. It still needs to guarantee recovery when a cleanup callback fails and to run callbacks when disabling or removing an active instance. For HTTP manifests without `entrypoint`, the current tab shows only title and description; catalog, search, and reading still need a generic interface.

Recording these differences is part of the POC's result. An experiment is valuable precisely when it shows which parts of an idea are simple and which need additional design.

## 12. The direction from here

With public protocol v1 delivered, continuation starts with the lifecycle:

1. complete unloading when disabling or removing add-ons and ensure cleanup even when a callback fails;
2. present catalog, search, and HTTP reading generically, with response validation;
3. allow priority editing and improve incompatibility messages;
4. cache manifests and define updates while preserving review of changed contracts;
5. investigate real isolation.

When these steps exist, the POC can answer a more demanding question: not only “does the protocol work?” but “does it remain understandable and safe when add-ons stop being trusted?”

The roadmap and the [2026-09-08 verification record](PHASES.md#verification-on-2026-09-08) are in `PHASES.md`, and the corresponding requirements are in `PRD.md`.
