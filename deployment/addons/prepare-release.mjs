import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { releaseInfo } from './release-utils.mjs';

const info = releaseInfo(process.argv[2]);
if (process.argv.length !== 3) throw new Error('Usage: pnpm addons:prepare <MAJOR.MINOR.PATCH>');
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const output = resolve(root, 'temp', info.project);
for (const file of ['packages/addon-chord-viewer/src/manifest.ts', 'packages/addon-chord-viewer/src/tab-definition.ts', 'packages/addon-chord-editor/src/manifest.ts']) {
  if (!(await readFile(resolve(root, file), 'utf8')).includes(info.origin)) {
    throw new Error(`${file} does not reference ${info.origin}; update its catalogue URL and add-on version first.`);
  }
}
try { await mkdir(output); } catch (error) {
  if (error.code === 'EEXIST') throw new Error(`${output} already exists; choose a new release or inspect the existing directory.`);
  if (error.code !== 'ENOENT') throw error;
  await mkdir(resolve(root, 'temp'), { recursive: true });
  await mkdir(output);
}
const protocol = spawnSync('pnpm', ['build:protocol'], { cwd: root, stdio: 'inherit' });
if (protocol.status !== 0) throw new Error('Protocol build failed. The release directory was retained for inspection.');
const bundled = spawnSync(process.execPath, [resolve(here, 'build.mjs')], { cwd: here, stdio: 'inherit', env: { ...process.env, ADDONS_RELEASE_ORIGIN: info.origin, ADDONS_OUTPUT_DIR: resolve(output, 'public') } });
if (bundled.status !== 0) throw new Error('Add-on build failed. The release directory was retained for inspection.');
await mkdir(resolve(output, 'api'));
await build({ entryPoints: [resolve(here, 'api/catalog.mjs')], outfile: resolve(output, 'api/catalog.mjs'), bundle: true, platform: 'node', format: 'esm' });
const config = JSON.parse(await readFile(resolve(here, 'vercel.json'), 'utf8'));
delete config.buildCommand;
await writeFile(resolve(output, 'vercel.json'), `${JSON.stringify(config, null, 2)}\n`);
await cp(resolve(here, 'README.md'), resolve(output, 'RELEASE-README.md'));
console.log(`Prepared ${info.project} at ${output}\nExpected public origin: ${info.origin}`);
