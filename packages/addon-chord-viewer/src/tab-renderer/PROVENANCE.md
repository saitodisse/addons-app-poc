# PROVENANCE

This directory is a **ported subset** of the `@achorde/tab-renderer` package, copied from the `achorde` project so it can be used independently inside `addons-app-poc`.

## Origin

- Source repository: <https://github.com/saitodisse/achorde>
- Package: `@achorde/tab-renderer`
- Version: `0.8.5`
- License: MIT (see `LICENSE` in this directory — the original, unmodified license file)

## Port date

2026-09-21

## Adaptations

Besides the import rewrites, the debug log labels that the source project writes
in Portuguese were translated in `core/observe.ts` and in `core/parseTab.ts`,
because this repository keeps every file in English. No behaviour changes: those
strings only appear in debug logs.

## What was ported

The port keeps the same relative structure under this directory, with three adaptations:

1. Every import of `@achorde/musical-domain` was rewritten to a relative path into
   `domain/...` (also ported from `packages/musical-domain/src/`).
2. `core/index.ts` only re-exports what was actually ported; the exports for files that
   were deliberately left out were removed.
3. Every file begins with a provenance comment line:
   `// Ported from @achorde/tab-renderer@0.8.5 (MIT). See PROVENANCE.md.`

### `core/`

- `types.ts`
- `parseTab.ts`
- `transposeChordSymbol.ts`
- `transposeParsedTab.ts`
- `collectDiagrammableChords.ts`
- `observe.ts`
- `preparedTypes.ts`
- `prepareSongFromParsedTab.ts`
- `index.ts`
- `parser/parseChordSymbol.ts`
- `parser/tokenizeContentWord.ts`
- `parser/tokenizeRawLine.ts`
- `parser/types.ts`
- `parser/extractor/extractChordLineMarkers.ts`
- `parser/extractor/parseChord.ts`
- `parser/pairer/lineAligner.ts`
- `renderer/generateBarList.ts`
- `transposer/chordToText.ts`

### `react/`

- `Tab.tsx`, `TabRoot.tsx`, `TabSection.tsx`, `TabLine.tsx`, `TabChord.tsx`,
  `TabLyric.tsx`, `TabDecoration.tsx`, `index.ts`, `types.ts`
- `styled/buildTabNodes.tsx`, `styled/chordSpanStyle.ts`,
  `styled/TabStyledContainer.tsx`, `styled/TabStyledSection.tsx`,
  `styled/defaultTabStyle.ts`

### `domain/` (vendored from `packages/musical-domain/src/`)

- `tab-ast.ts`
- `chord-symbol.ts`
- `diagnostics.ts`

These three files import one another with `.js`-relative paths; the explicit `.js`
extensions were dropped in the port so the relative imports resolve in this
TypeScript tree.

## Deliberately left out

The following files were **not** ported, because they depend on `@tonaljs/tonal`,
are legacy, or are tests/fixtures. Keeping them out avoids introducing new runtime
dependencies.

- `core/prepareSong.ts`
- `core/parser/splitSections.ts`
- `core/parser/pairer/pairLines.ts`
- `core/parser/pairer/chordLineDetector.ts`
- `core/parser/pairer/removeThings.ts`
- `core/parser/pairer/index.ts`
- `core/parser/extractor/extractChords.ts`
- `core/parser/extractor/index.ts`
- `core/transposer/transposeUp.ts`
- `core/transposer/transposeDown.ts`
- `core/transposer/transposeSection.ts`
- `core/transposer/replaceChordText.ts`
- all `*.test.*`, `__tests__/`, `*.stories.*`, `test/` directories, and `stub`/fixtures

Because `react/Tab.tsx`, `react/types.ts` and the `react/styled/*` files reach into
`core` via sibling-relative imports, they only reference the ported core surface; no
unported file is reachable.

## Synchronization obligation

This directory is a **manual, frozen copy**. There is no tooling that re-syncs it from
`github.com/saitodisse/achorde`. If the upstream `@achorde/tab-renderer` changes, the
changes must be re-applied here by hand — following the same rule: do not edit files
outside this `tab-renderer/` directory, and make sure any new ported file keeps the
provenance comment and the no-`@tonaljs`/no-`node:*` constraint.