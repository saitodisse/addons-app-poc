# ADR 0001 — Separate the public protocol and host runtime

**Status:** Delivered
**Date:** 2026-08-23

## Why

The private core package mixed the contract, domain examples, registry, loader,
and adapters. An add-on that only needed to declare compatibility ended up
importing host execution details, and the boundary could not be published
clearly.

## Decision

The package published as `@addons-poc/protocol@1.0.0` under MIT contains
contract v1, JSON Schema, SemVer/capability validators, service descriptors,
`HostAPI` types, and the authoring SDK. The host keeps the loader, registry,
status, and adapters in `packages/host-app/src/runtime`. Domain helpers belong
to the add-ons that use them.

Every manifest uses only `contract`. The host validates compatibility before
importing a bundle. Custom services use namespaced names and are queried through
`host.services.use(contract)`.

## Consequences

- hosts and add-ons have a direct, explicit dependency on the public package;
- the host has no catalog or dependency on add-on implementations;
- breaking a service method requires a new major version;
- the contract allows human review and required-dependency blocking but is not a sandbox;
- consumers can install the package without bringing the host runtime.

## Evidence and validation

`pnpm check:host-boundary`, `pnpm test`, `pnpm build:host`, and
`npm pack --dry-run` form the local proof. The published version was queried
with `npm view` and installed in a clean consumer after confirming the account
and ownership of the `@addons-poc` scope.
