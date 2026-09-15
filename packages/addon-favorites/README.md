# `@addons/addon-favorites`

An in-process add-on that provides `addons.favorites` `1.0.0`.

## Why it exists

It keeps favorites as a domain rule owned by the add-on instead of turning favorites into a global protocol service.

## What it offers

The service exposes `list`, `add({ title, url? })`, and `remove(id)`. The collection and visual state are declared in `contract.state`. The `state-store` provider is optional; without it, the add-on uses an in-memory store.

## How to run and test

```bash
pnpm --filter @addons/addon-favorites test
pnpm --filter @addons/addon-favorites serve
```

The manifest is at `http://localhost:5306/manifest.json`. State mediation goes through `host.services.use`; the favorites helpers are in [`src/bookmarks.ts`](src/bookmarks.ts) and [`src/memory-bookmark-store.ts`](src/memory-bookmark-store.ts).
