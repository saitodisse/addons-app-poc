import { build } from 'esbuild';
import { mkdir, cp, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve('../..');
for (const name of ['chord-editor', 'chord-viewer', 'storage-local', 'chord-catalog']) {
  const dir = resolve('public', name);
  await mkdir(dir, { recursive: true });
  const entry = resolve(root, `packages/addon-${name}/src/${name === 'chord-catalog' ? 'browser.js' : 'index.ts'}`);
  await build({ entryPoints: [entry], outfile: resolve(dir, 'bundle.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic' });
  const { manifest } = await import(`${pathToFileURL(resolve(dir, 'bundle.js')).href}?build=${Date.now()}`);
  await writeFile(resolve(dir, 'manifest.json'), JSON.stringify({ ...manifest, entrypoint: './bundle.js' }, null, 2));
}
await cp(resolve(root, 'packages/addon-chord-editor/node_modules/monaco-editor/min/vs'), resolve('public/chord-editor/monaco/vs'), { recursive: true });
await cp(resolve(root, 'packages/addon-chord-catalog/assets/artists'), resolve('public/artists'), { recursive: true });

process.exit(0);
