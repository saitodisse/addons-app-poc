# Published add-ons

The add-ons share a Vercel project, while each manifest retains its own URL. The catalogue uses a serverless function for its public demo data. Imported catalogues remain in the browser.

From the repository root, prepare a deployable directory:

```sh
pnpm build:protocol
(cd deployment/addons && node build.mjs && node prepare.mjs)
pnpm exec vercel link --cwd temp/addons-deploy
pnpm exec vercel deploy --cwd temp/addons-deploy --local-config temp/addons-deploy/vercel.json --prod
```

Link to the existing `addons-poc-addons` project. The project is intentionally disconnected from Git because deployment uses the generated directory. Verify all four manifests, bundles, the catalogue routes, and the editor's Monaco assets after deployment. The add-on manifest URL is its identity, so changing the domain requires reinstalling it in the host.
