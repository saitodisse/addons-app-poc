# ADR 0002 — Independent chord editor and local drafts

**Status:** Delivered
**Date:** 2026-09-25

## Why

A chart is currently published by one add-on and rendered by another. Editing
it in the host would teach the host about chords. Writing edits into the HTTP
catalogue would turn a read-only demonstration into a publishing system without
an owner, conflict policy, or authorization model.

## Decision

Add a third add-on for editing. It reads a chart through the published content
URL, uses the viewer's service for the preview, and stores a revision through
`state-store`. It provides a draft service that the viewer can consume. The
host only knows an optional `host.content-editor` convention for a result page.
The editor serves Monaco from its own origin and offers a text area fallback.
Its required `addons.chords.viewer` dependency makes both initial loading and
later dependency rechecks initialize the renderer before the editor, regardless
of manifest installation order. Rechecks clear their selected services
together, then reload add-ons sequentially in required-dependency order so the
editor cannot be caught between the viewer's removal and reactivation.

## Considered options

- Put the editor in `host-app`: shorter first integration, but a direct chord
  dependency in the generic host.
- Import the viewer or catalogue package from the editor: convenient shared
  code, but it would tie independent add-ons to one another's implementation.
- Write directly to the HTTP catalogue: it requires a separate publication and
  conflict design that the POC does not currently have.

## Consequences

The editor requires a viewer and a storage provider. Local drafts are keyed by
the content URL and retain the source checksum. A changed source is visible as
a conflict instead of being replaced silently. Neither the published protocol
package nor the catalogue's HTTP routes change.
