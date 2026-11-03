# Publishing a fixed add-on release

A fixed release keeps its own manifest, bundle, catalogue function and Monaco files. The host identifies an installation by its manifest URL, so installing a new release creates a separate installation. Remove the old one in Settings when appropriate. A Vercel project owner can still overwrite or delete a release: preserve it by never redeploying to its project or reassigning its domain.

Settings exposes branded manifest URLs under `https://www.peekmosaic.com/addons/<version>/...`. The host project proxies those paths to each fixed release project. Keep the original `https://addons-poc-release-<version>.vercel.app` origins active because published manifests and older installed add-ons still use them directly. A host rebrand does not overwrite or move a release; add a matching proxy rule when publishing a new version. Old installation URLs are normalized to the branded alias only for the Settings display. The stored manifest URL remains unchanged, preserving installation identity.

The current host shows the newest available version per add-on and keeps older unique versions inside an accordion. Production suggestions include release 1.17.0; local servers remain on localhost. The older 1.15.0 catalogue has a known failure in its plain-text content route; its structured JSON route works. The issue is corrected in 1.16.0. Do not overwrite preserved releases.

## Prepare

1. Choose a new stable `MAJOR.MINOR.PATCH` release number and a new Vercel project named `addons-poc-release-MAJOR-MINOR-PATCH`. Check that the project and its `.vercel.app` domain do not already exist. Never select an existing release project.
2. Update the release origin in the viewer manifest and placeholder and editor manifest. Update each add-on's own manifest version when its behavior or contract changes. Do not change the host suggestions until the release has been deployed and verified.
3. Run `pnpm addons:prepare 1.17.0` with the chosen version. The command builds the protocol, bundles the four add-ons and catalogue function, and writes a standalone Vercel directory at `temp/addons-poc-release-1-17-0`. It refuses an existing directory and rejects an origin mismatch. A failed preparation leaves its directory for inspection; move it aside before retrying.

## Publish and verify

1. Create a new Vercel project from the prepared directory. For example, after verifying the account and project name:

   ```sh
   pnpm exec vercel deploy --yes --name addons-poc-release-1-17-0 --cwd temp/addons-poc-release-1-17-0 --local-config temp/addons-poc-release-1-17-0/vercel.json
   pnpm exec vercel git disconnect --cwd temp/addons-poc-release-1-17-0 --yes
   ```

   The first deployment is production. Confirm that the assigned public domain matches the origin printed by the preparation command. The disconnect prevents Git pushes from rebuilding the release project.
2. Run `pnpm addons:verify 1.17.0`. This checks public HTTP access, CORS, protocol validation, exact bundle URLs, catalogue listing and plain-text content, and the Monaco loader. It does not replace an end-to-end browser test: install all four manifests in the host, open a chart and check the editor and preview.
3. Add the new release version to the branded rewrite rules in the root `vercel.json` and to `PUBLISHED_RELEASE_VERSIONS` in `packages/host-app/src/local-manifest-suggestions.ts`. Point the current published suggestions at that release. Verify the branded manifest and bundle routes before deploying the host. Localhost suggestions must remain local; production should show the branded URLs. Record version changes in the changelog.

The demo catalogue is public. Imported catalogues and drafts remain in the browser. `pnpm addons:verify` performs read-only network requests; `pnpm addons:prepare` writes only to a new directory under `temp/` and does not publish anything.
