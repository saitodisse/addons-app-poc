# Packages

This index explains the role of each package after separating the public protocol from the host runtime.

## Why this division exists

The host must install and review add-ons without knowing concrete implementations. For that purpose, there is one shared boundary: `@addons-poc/protocol`. The host keeps the loader, registry, state, and adapters internally; each add-on keeps its own domain.

## What each package does

| Package | Format | Responsibility | Documentation |
| --- | --- | --- | --- |
| [`@addons-poc/protocol`](../packages/protocol/README.md) | public library | Contract v1, JSON Schema, SemVer, validators, and SDK | [`packages/protocol`](../packages/protocol/README.md) |
| [`@addons/host-app`](../packages/host-app/README.md) | web application | Loader, negotiation, registry, status, installation persistence, and generic UI | [`packages/host-app`](../packages/host-app/README.md) |
| [`@addons/addon-server`](../packages/addon-server/README.md) | Node.js ESM library | HTTP server with no external runtime dependencies | [`packages/addon-server`](../packages/addon-server/README.md) |
| [`@addons/addon-markdown`](../packages/addon-markdown/README.md) | in-process add-on | Local Markdown and HTML formatting | [`packages/addon-markdown`](../packages/addon-markdown/README.md) |
| [`@addons/addon-favorites`](../packages/addon-favorites/README.md) | in-process add-on | Adding, listing, and removing favorites | [`packages/addon-favorites`](../packages/addon-favorites/README.md) |
| [`@addons/addon-health`](../packages/addon-health/README.md) | in-process add-on | HTTP provider health checks | [`packages/addon-health`](../packages/addon-health/README.md) |
| [`@addons/addon-storage-local`](../packages/addon-storage-local/README.md) | in-process provider | `state-store` backed by `localStorage`, priority 10 | [`packages/addon-storage-local`](../packages/addon-storage-local/README.md) |
| [`@addons/addon-text-wikipedia`](../packages/addon-text-wikipedia/README.md) | HTTP server | Wikipedia summaries and searches in Portuguese | [`packages/addon-text-wikipedia`](../packages/addon-text-wikipedia/README.md) |
| [`@addons/addon-chord-catalog`](../packages/addon-chord-catalog/README.md) | HTTP server | Chord-chart catalogue: listing, search, and chart delivery | [`packages/addon-chord-catalog`](../packages/addon-chord-catalog/README.md) |
| [`@addons/addon-chord-viewer`](../packages/addon-chord-viewer/README.md) | in-process add-on | Renders chord charts with controls | [`packages/addon-chord-viewer`](../packages/addon-chord-viewer/README.md) |

All add-ons and the host directly depend on `@addons-poc/protocol@1.0.0`,
installed from npm. The lockfile keeps the published artifact's integrity; there
is no local protocol link during workspace installation. The four in-process
add-ons publish their own bundles through their `serve` commands. The remaining
HTTP add-on depends on `@addons/addon-server`; domain add-ons do not depend on
one another.

## How to use this documentation

Start with the [protocol README](../packages/protocol/README.md) when creating or reviewing a manifest. Consult the [host README](../packages/host-app/README.md) when a change involves installation, negotiation, or runtime. For a specific implementation, the package README describes the service, local port, and test command.

The complete rules are in [`docs/MANIFEST-SPEC.md`](MANIFEST-SPEC.md), [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), and [`docs/DECISIONS.md`](DECISIONS.md).

## Demonstration ports

| Port | Package |
| --- | --- |
| 5280 | web host |
| 5294 | text-wikipedia |
| 5295 | `addon-chord-catalog` |
| 5304 | `addon-markdown` |
| 5305 | `addon-chord-viewer` |
| 5306 | `addon-favorites` |
| 5307 | `addon-health` |
| 5308 | `addon-storage-local` |

These ports are local demonstration conventions. When installing by URL, the
identity remains the complete `manifest.json` URL.
