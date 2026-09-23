# Guide for AI agents

This file exists so that any agent can work on the project without having to rediscover its boundaries. Preserve the central idea first: this is an independent proof of concept. Then use the technical rules below to keep the experiment coherent.

Always respond in **Brazilian Portuguese**.

## Before changing anything

The **addons-app-poc** is not part of the AC ecosystem, the `achorde` monorepo, or `ac15`. It may have originated in earlier discussions, but it is now an independent repository. Do not move code between these projects or create dependencies on them.

Inspect the code and documentation before proposing structural changes. Preserve existing user changes and ignore differences unrelated to the task.

## How the project is divided

Think of the system as three areas with clearly separated responsibilities:

| Area | Role | Dependency rule |
|---|---|---|
| `packages/protocol/` | Public contract, schema, validators, and SDK | This is the published compatibility boundary |
| `packages/host-app/` | Host application and internal runtime | It may depend on `protocol`, but never on an `addon-*` |
| `packages/addon-*/` | Implementations and examples | They depend directly on `@addons-poc/protocol` or, in HTTP format, also on `addon-server` |

No add-on may import from `host-app`, and `host-app` must not import, declare in `package.json`, or alias an `addon-*`. Add-ons must not create direct dependencies on one another either: collaboration happens through the public protocol and the manifest URL.

A convenience list of local `manifest.json` URLs is allowed on the Settings screen when titles and descriptions come generically from those manifests, without an embedded catalog, imports, or add-on execution.

Run `pnpm check:host-boundary` when changing `host-app`, dependencies, or imports. The check prevents add-on implementations from returning to the host build.

The public protocol contains only contracts and pure rules. The host runtime follows a lightweight hexagonal architecture:

- `packages/protocol/src/domain/` contains contract types and pure rules.
- `packages/host-app/src/runtime/` contains the loader, registry, status, and internal adapters.

Text add-ons and `@addons/addon-server` use plain ESM JavaScript. The server validates the manifest through the already-built public package; it does not load the host runtime.

## Decisions that must remain explicit

The rationale and consequences are in [`docs/DECISIONS.md`](docs/DECISIONS.md). When changing one of them, update the code, specification, and corresponding decision.

1. The manifest URL is the add-on's unique identity.
2. An in-process add-on exports `manifest` and `setup` separately.
3. `HostAPI` exposes only `services`, `registerService`, `onUnload`, and `log`.
4. Implementations of the same service are ordered by explicit priority.
5. A `setup` failure leaves the add-on instance in an error state.
6. `withFallback` and `withFallbackAsync` try implementations in priority order.
7. In-process add-ons use ESM modules loadable with `import()`.
8. Critical protocol rules are tested in `@addons-poc/protocol`.
9. Every manifest contains complete metadata and one `contract` v1 section.
10. Unofficial services use namespaced identifiers and SemVer descriptors.
11. An add-on can also be an HTTP server following the Stremio protocol style.
12. The `text` resource responds with `{ texts: [{ id, url, lang, name }] }` and delivers content on demand.
13. The add-on HTTP server remains free of external runtime dependencies.
14. The host chooses providers by priority; missing required dependencies and cycles block activation.

## How to work with the documentation

Every explanation must follow the same order:

1. **Why:** what problem exists and why it is worth solving.
2. **What:** the idea in simple language.
3. **How:** which contracts, flows, states, and files implement the idea.

Write so that an intelligent 16-year-old can follow along. Explain technical terms at first use, prefer short sentences, and use tables or lists when there are three or more items.

Any change to `protocol` requires reviewing `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/MANIFEST-SPEC.md`, and `docs/GLOSSARY.md` according to its impact.

## Project commands

| Command | Use |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm test` | Run all tests |
| `pnpm dev` | Start the host, two HTTP add-ons, and five in-process add-ons |
| `pnpm kill-all` | Stop development-mode processes |
| `pnpm dev:addons` | Start only the HTTP servers |
| `pnpm --filter @addons/host-app dev` | Start only the host |
| `pnpm --filter @addons/addon-text-wikipedia serve` | Start only the Wikipedia add-on |

Start with the narrowest check related to the change. Before finishing a protocol change, also run `pnpm test`.

## Conventions

- Use strict-mode TypeScript in TypeScript packages.
- Name packages `@addons/<name>`.
- Place Vitest tests next to the code, using `file.test.ts` or `file.test.js`.
- Keep comments sparse and useful for explaining non-obvious decisions.
- Avoid new dependencies, generic abstractions, and changes outside the scope.
- Use descriptive commit messages in English when authorized to create commits.
- Do not publish packages to npm without explicit authorization.

## Project states

Use only these states in planning documents:

- **Planned:** work has not started.
- **In Progress:** active work exists, but the result is not complete.
- **Delivered:** it works and has been validated in the declared scope.
- **Partial:** a meaningful part works, but known requirements remain.
- **Deactivated:** it stopped operating by explicit decision.
- **Replaced:** it was exchanged for another solution recorded elsewhere.

## Quick map

| Document | When to consult |
|---|---|
| `README.md` | To understand and run the POC |
| `docs/PLANNING.md` | To learn the proposal's history and evolution |
| `docs/PRD.md` | To check scope and success criteria |
| `docs/ARCHITECTURE.md` | Before any structural change |
| `docs/DECISIONS.md` | Before revisiting an existing decision |
| `docs/MANIFEST-SPEC.md` | When creating or changing an add-on |
| `docs/PHASES.md` | To distinguish delivered work from future plans |
| `docs/GLOSSARY.md` | When encountering an unfamiliar term |
| `docs/PACKAGES.md` | When working on a package or looking for its README |
| `docs/CHORD-CHART.md` | When changing the chord-chart add-ons, their data format, or their controls |
| `CHANGELOG.md` | To understand changes between versions |
