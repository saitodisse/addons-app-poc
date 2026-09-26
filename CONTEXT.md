# Add-on protocol

This context defines the language used by independent extensions and the host that installs them. It separates what an extension declares from what the host can verify and allow.

The public contract lives in `packages/protocol` and is distributed as
`@addons-poc/protocol@1.0.0`. The loader, registry, and adapters are internal to
`packages/host-app`; implementations and servers live in the other packages.
The [package index](docs/PACKAGES.md) points to each package README.

## Language

**Published chord chart**:
The chart text and metadata delivered by a catalogue at a content URL. It remains the source version even when a person edits a local copy.
_Avoid_: editable catalogue record

**Local chord draft**:
A person's saved revision of a published chord chart, identified by its source content URL and the checksum of the source text it was based on.
_Avoid_: published chart, catalogue update

**Interaction declaration**:
The part of the manifest that describes an add-on's inputs, outputs, storage, and other interactions. For interactions mediated by the host, it is also the rule the host uses to allow or block access.
_Avoid_: implicit permissions, hidden capabilities

**Protocol contract**:
The required `contract` block in a manifest. It gathers protocol version/range,
capabilities, services, UI, state, HTTP, and logs; there is no legacy parser.
_Avoid_: a contract separated by format, manual registration in the host

**Effective state destination**:
The persistence mechanism selected by the host for a state key declared by an add-on. It may be `localStorage`, `sessionStorage`, or memory, and it is not part of the add-on's identity or implementation.
_Avoid_: a physical destination declared by the add-on

**Interaction schema**:
A documented subset of JSON Schema used in the interaction contract to describe the data received and returned by an operation.
_Avoid_: free-form format descriptions, an unvalidated schema

**Compatible manifest**:
A manifest that contains a valid v1 contract, meets the host's capability
profile, and does not depend on a missing required service. The host refuses to
install incompatible manifests.
_Avoid_: a missing contract, silent compatibility

**Declared external interaction**:
A query or transmission made outside the host and described in the contract for transparency. In the current architecture, the host displays it but does not yet intercept or block it.
_Avoid_: an external interaction mediated by the host

**Declared external request**:
An external interaction that states its origin, method, route template, purpose, transmitted fields, and response schema. The route template describes variables without revealing a person's values.
_Avoid_: a URL containing user data, a destination without a purpose

**Data classification**:
The `public`, `personal`, or `secret` label assigned to a received, persisted, or transmitted field. The contract describes the data, but `secret` values are not displayed or recorded by the host.
_Avoid_: a secret in a manifest, a secret in a log

**State declaration**:
The contract part that describes a state's key or key pattern, schema, allowed operations, retention, and deletion trigger. A writer declares a concrete key; a storage provider may declare a pattern that it accepts.
_Avoid_: state without a key, implicit retention

**Service proxy**:
The object returned by `host.services.use(contract)`. It exposes only the
declared descriptor and validates the method, input, and output at runtime.
_Avoid_: a merely illustrative contract, an undeclared mediated capability

**Contract review**:
The state in which an installation waits for new acceptance because the interaction contract changed at the same manifest URL. The extension remains disabled until review is complete.
_Avoid_: a silent capability expansion, automatic reactivation
