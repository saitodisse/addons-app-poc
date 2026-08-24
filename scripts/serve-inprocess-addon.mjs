import { createServer } from 'node:http';
import { access, mkdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const [addonDirectory, portValue] = process.argv.slice(2);
const port = Number(portValue);
const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const addonRoot = resolve(workspaceRoot, 'packages', addonDirectory ?? '');
const packagesRoot = resolve(workspaceRoot, 'packages');

if (!addonDirectory || !Number.isInteger(port) || port < 1 || relative(packagesRoot, addonRoot).startsWith('..')) {
  throw new Error('Uso: node scripts/serve-inprocess-addon.mjs <diretório-do-addon> <porta>');
}

const entryPoint = resolve(addonRoot, 'src/index.ts');
const outputDirectory = resolve(addonRoot, 'dist');
const bundlePath = resolve(outputDirectory, 'bundle.js');
await access(entryPoint);
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: [entryPoint],
  outfile: bundlePath,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
});

const addonModule = await import(`${pathToFileURL(bundlePath).href}?built=${Date.now()}`);
const manifest = addonModule.manifest;

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, OPTIONS' });
    response.end();
    return;
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && request.url === '/manifest.json') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : JSON.stringify({
      ...manifest,
      entrypoint: `http://${request.headers.host}/bundle.js`,
    }));
    return;
  }

  if ((request.method === 'GET' || request.method === 'HEAD') && request.url === '/bundle.js') {
    const bundle = await readFile(bundlePath);
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : bundle);
    return;
  }

  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[addon] ${addonDirectory} em http://localhost:${port}/manifest.json`);
});
