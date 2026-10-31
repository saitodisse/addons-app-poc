import { validateManifest } from '../../packages/addon-server/node_modules/@addons-poc/protocol/dist/index.js';
import { releaseInfo } from './release-utils.mjs';

const info = releaseInfo(process.argv[2]);
if (process.argv.length !== 3) throw new Error('Usage: pnpm addons:verify <MAJOR.MINOR.PATCH>');
async function get(path) {
  const response = await fetch(`${info.origin}${path}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  if (response.headers.get('access-control-allow-origin') !== '*') throw new Error(`${path}: missing public CORS header`);
  return response;
}
for (const name of ['chord-catalog', 'chord-viewer', 'storage-local', 'chord-editor']) {
  const manifest = await (await get(`/${name}/manifest.json`)).json();
  const validation = validateManifest(manifest);
  if (!validation.valid || manifest.id !== name || manifest.entrypoint !== `${info.origin}/${name}/bundle.js`) throw new Error(`${name}: invalid manifest or unexpected entrypoint: ${validation.errors.join(', ')}`);
  const bundle = await get(`/${name}/bundle.js`);
  if (!(await bundle.text()).includes('setup')) throw new Error(`${name}: bundle does not expose setup`);
  console.log(`${name} ${manifest.version}: manifest and bundle OK`);
}
const catalog = await (await get('/chord-catalog/catalog/chart/recent.json?limit=1')).json();
if (!catalog.metas?.[0]?.url?.startsWith(`${info.origin}/chord-catalog/`)) throw new Error('Catalogue did not return a release-local chart URL.');
const chartUrl = new URL(catalog.metas[0].url);
if (!(await (await get(chartUrl.pathname)).text()).trim()) throw new Error('Chart content is empty.');
await get('/chord-editor/monaco/vs/loader.js');
console.log('Catalogue content and Monaco loader OK');
