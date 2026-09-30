# Source Catalog imports form a browser-owned chart library

**Status: Delivered**

The chord catalogue needs to make imported charts available when source servers are unreachable. Each configured URL identifies a Source Catalog root that can publish several artists and their charts. A manual **Update catalogue** action downloads and verifies a complete source snapshot, then stores its charts in IndexedDB on the user's device. The catalogue add-on serves its normal search and content resources from that local library. A host service worker retains the production application shell and installed add-on manifests and bundles, so search and reading continue offline.

Updates are independent per source. A failed import leaves that source's previous snapshot intact, and a successful import replaces it atomically. Source identity and chart record identity keep variants from different sources separate. Removing a URL stops future updates and leaves its snapshot in place; a separate action deletes a downloaded source. The project assumes all songs are licensed by default.

This keeps domain data in the catalogue add-on and leaves the host with a generic settings group and resource-client service convention. It adds no host dependency on add-on packages and no public protocol package changes. The tradeoff is that sources must allow browser cross-origin requests, and offline add-on execution depends on each installed add-on publishing a self-contained browser bundle.
