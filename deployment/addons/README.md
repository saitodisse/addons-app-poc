# Published add-on releases

Each release uses a separate Vercel project and public domain, so a later release does not replace its manifests, bundles, catalogue API, or Monaco assets. Release 1.15.0 is hosted at `https://addons-poc-release-1-15-0.vercel.app`. Its project is disconnected from Git. The manifest URL is the add-on identity, so installing a later release creates a separate identity and may require removing the previous installation.

To prepare a new release, choose a new project and domain for that release, update the published URLs in the host, add-on manifests and `build.mjs`, and update the add-on versions when their behavior changes. From the repository root:

```sh
pnpm build:protocol
(cd deployment/addons && node build.mjs && node prepare.mjs)
```

Copy `temp/addons-deploy/public`, `api`, and `vercel.json` to a new empty directory for the new release. Create a new Vercel project from that directory using its local `vercel.json`, then disconnect its automatic Git integration. Do not deploy to an existing release project or reassign its domain. Verify each manifest and bundle, catalogue routes, and the Monaco loader before updating the host. Vercel project owners can still modify or delete a release, so preservation depends on maintaining this policy.

The catalogue function serves the public demo data. Imported catalogues and drafts remain in the browser.
