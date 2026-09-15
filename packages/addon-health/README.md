# `@addons/addon-health`

An in-process add-on that provides `addons.health.health-check` `1.0.0`.

## Why it exists

It makes add-on state observable without coupling the host to a list of services.

## What it offers

The **Add-on Health** tab queries the 14 manifests from the demonstration's local servers, measures each response, and returns its name, address, and state. These `GET /manifest.json` calls are declared in `contract.http`. The tab state is optional and uses `state-store` when available.

## How to run and test

```bash
pnpm --filter @addons/addon-health test
pnpm --filter @addons/addon-health serve
```

The manifest is at `http://localhost:5307/manifest.json`. The network client is in [`src/http-client.ts`](src/http-client.ts); the I/O declaration is in [`src/index.ts`](src/index.ts).
