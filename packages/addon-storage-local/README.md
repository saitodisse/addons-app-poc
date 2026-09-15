# `@addons/addon-storage-local`

`state-store` provider `1.0.0` using `localStorage`.

## Why it exists

It provides state persistence as a replaceable add-on. The host does not choose embedded storage; it selects providers through the contract and priority.

## What it offers

It implements `get`, `set`, `remove`, `listKeys`, and `clear` for JSON values under the physical `addons:state:` namespace. Its declared priority is `10`, above the session provider. Each consumer's state remains limited by the keys and operations declared in the consumer contract. When the tab opens, all states are listed automatically; each name can open the complete JSON in the details panel.

## How to run and test

```bash
pnpm --filter @addons/addon-storage-local test
pnpm --filter @addons/addon-storage-local serve
```

The manifest is at `http://localhost:5308/manifest.json`. The adapter implementation is in [`src/browser-state-store.ts`](src/browser-state-store.ts).
