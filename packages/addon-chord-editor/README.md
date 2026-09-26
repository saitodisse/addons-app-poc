# `@addons/addon-chord-editor`

## Why

The catalogue publishes chord charts and the viewer displays them, but neither
owns a person's edits. Putting an editor in the host would teach the generic
application about chords. This add-on keeps editing independent and leaves the
published catalogue untouched.

## What

Open a catalogue chart from its result page and choose **Edit**. Monaco
edits the chord-over-lyrics text while the chord viewer supplies a live preview.
**Save local draft** stores the revision in this browser. **Back to reading**
shows that draft; **Discard draft** restores the published text. If Monaco
cannot load, a plain text area remains available.

This first version does not publish a revision or synchronize it to another
device. A draft records the checksum of the published text on which it was
based. If the published text changes, the editor warns about the older base;
the viewer does not silently display that draft as current content.

## How

The add-on serves `http://localhost:5309/manifest.json` and its own Monaco
assets. It requires the `addons.chords.viewer` and `state-store` services. The
required viewer dependency makes the host initialize rendering before editing,
even if the editor appears first in the saved installation list. It
provides `host.content-editor`, the generic result-page convention, and
`addons.chords.drafts`, which the viewer may consume. All calls go through the
public protocol's service registry. The editor reads the chart's structured
content URL over HTTP; it imports neither the catalogue nor the viewer.

To try it, run `pnpm dev`. In **Settings**, install the local storage (`5308`),
chord catalogue (`5295`), chord viewer (`5305`), and chord editor (`5309`)
manifests. Open a chart in the catalogue and select **Edit**.

```bash
pnpm --filter @addons/addon-chord-editor test
pnpm --filter @addons/addon-chord-editor serve
```

The code is divided into `catalog.ts` (source loading), `drafts.ts` (local
revisions), `editor-element.tsx` (Monaco and preview), and `index.ts` (service
registration). The design and its limits are recorded in
[`docs/adr/0002-independent-chord-editor.md`](../../docs/adr/0002-independent-chord-editor.md).
