import { build } from 'esbuild';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve('../..');
const origin = process.env.ADDONS_RELEASE_ORIGIN;
const output = process.env.ADDONS_OUTPUT_DIR;
if (!origin || !output) throw new Error('Use pnpm addons:prepare <version> to provide the release origin and output directory.');
for (const name of ['chord-editor', 'chord-viewer', 'storage-local', 'chord-catalog']) {
  const dir = resolve(output, name);
  await mkdir(dir, { recursive: true });
  const entry = resolve(root, `packages/addon-${name}/src/${name === 'chord-catalog' ? 'browser.js' : 'index.ts'}`);
  await build({ entryPoints: [entry], outfile: resolve(dir, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic' });
  const { manifest } = await import(`${pathToFileURL(resolve(dir, 'bundle.js')).href}?build=${Date.now()}`);
  await writeFile(resolve(dir, 'manifest.json'), JSON.stringify({ ...manifest, entrypoint: `${origin}/${name}/bundle.js` }, null, 2));
}
await cp(resolve(root, 'packages/addon-chord-editor/node_modules/monaco-editor/min/vs'), resolve(output, 'chord-editor/monaco/vs'), { recursive: true });
await cp(resolve(root, 'packages/addon-chord-catalog/assets/artists'), resolve(output, 'artists'), { recursive: true });

process.exit(0);
