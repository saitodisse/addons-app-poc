# Source Catalog imports form a browser-owned chart library

**Status: Delivered**

The chord catalogue needs to make imported charts available when source servers are unreachable. Each configured URL identifies a Source Catalog root that can publish several artists and their charts. A manual **Update catalogue** action downloads and verifies a complete source snapshot, then stores its charts in IndexedDB on the user's device. The catalogue add-on serves its normal search and content resources from that local library. A host service worker retains the production application shell and installed add-on manifests and bundles, so search and reading continue offline.

Updates are independent per source. A failed import leaves that source's previous snapshot intact, and a successful import replaces it atomically. Source identity and chart record identity keep variants from different sources separate. Removing a URL stops future updates and leaves its snapshot in place; a separate action deletes a downloaded source. The project assumes all songs are licensed by default.

This keeps domain data in the catalogue add-on and leaves the host with a generic settings group and resource-client service convention. It adds no host dependency on add-on packages. The encrypted archive format uses a small generic extension to the protocol's runtime tab-field type; the Artist Portal generator remains independent. The tradeoff is that sources must allow browser cross-origin requests, and offline add-on execution depends on each installed add-on publishing a self-contained browser bundle.

## Archive sources

Scraper exports contain chart text and provenance already, so requiring a
separate generator would add an unnecessary preparation step. The same manual
update accepts ZIP or TAR.ZST URLs alongside catalogue roots. The catalogue add-on unpacks
one Source Catalog or converts scraper `.txt` + `.source.json` pairs to its
internal chart representation, preserving text, source dates and original
metadata. This is a file contract; the repositories remain independent.

The ZIP or TAR.ZST URL identifies the snapshot and each original song URL identifies a
chart within it. Validation completes before the existing atomic store write.
A failed download or conversion preserves the previous snapshot. `fflate` and `fzstd` are
bundled only in the catalogue browser module; the generic add-on HTTP server
remains unchanged. Extraction has explicit download,
expanded-size, entry-size and entry-count limits, plus path validation. Signed
URLs are supported but a changed query identifies a different source. See
`docs/CHORD-CHART.md` for the file contract and operational limits.

For private distribution the catalogue accepts `.tar.zst.enc`. The browser
downloads only ciphertext and decrypts it with a selected local certificate.
The host marks the certificate and passphrase values sensitive, so it excludes
them from tab storage and clears them after the update action. The passphrase
and private key stay in the browser; the first version supports one certificate
shared among trusted devices. This relies on trusting the add-on code and does
not provide a browser sandbox.

Large snapshots are split into small IndexedDB records within one transaction.
This avoids Chromium's per-record serialization limit while preserving atomic
replacement. Existing snapshots are retained during the storage upgrade.
