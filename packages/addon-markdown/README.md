# `@addons/addon-markdown`

An in-process add-on that provides `addons.markdown.text-formatter` `1.0.0`.

## Why it exists

It keeps a domain helper inside the add-on and demonstrates that text formatting is not a global host API.

## What it offers

The `format({ title, content })` method produces Markdown and HTML locally. The tab declares its fields and action in the contract; its state may use `state-store` and falls back to memory when the service does not exist. There is no external I/O.

## How to run and test

```bash
pnpm --filter @addons/addon-markdown test
pnpm --filter @addons/addon-markdown serve
```

The manifest is at `http://localhost:5304/manifest.json`. The service is obtained through `host.services.use` with the `addons.markdown.text-formatter` descriptor.

Implementation and tests: [`src/index.ts`](src/index.ts) and [`src/formatting.ts`](src/formatting.ts).
