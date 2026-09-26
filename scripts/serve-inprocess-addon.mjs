import { createServer } from 'node:http';
import { access, mkdir, readFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const [addonDirectory, portValue] = process.argv.slice(2);
const port = Number(portValue);
const workspaceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const addonRoot = resolve(workspaceRoot, 'packages', addonDirectory ?? '');
const packagesRoot = resolve(workspaceRoot, 'packages');

if (!addonDirectory || !Number.isInteger(port) || port < 1 || relative(packagesRoot, addonRoot).startsWith('..')) {
  throw new Error('Usage: node scripts/serve-inprocess-addon.mjs <addon-directory> <port>');
}

const entryPoint = resolve(addonRoot, 'src/index.ts');
const outputDirectory = resolve(addonRoot, 'dist');
const bundlePath = resolve(outputDirectory, 'bundle.js');
const monacoRoot = resolve(addonRoot, 'node_modules', 'monaco-editor', 'min', 'vs');
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
  // Add-ons may ship TSX and expect the automatic JSX runtime.
  jsx: 'automatic',
});

const addonModule = await import(`${pathToFileURL(bundlePath).href}?built=${Date.now()}`);
const manifest = addonModule.manifest;

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  // The bundle is rebuilt on every start and this server is for development, so
  // a cached copy would keep a browser on the previous contract.
  response.setHeader('Cache-Control', 'no-store');
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

  // An add-on that depends on Monaco serves its own editor assets. The host
  // keeps no asset list or dependency on that add-on.
  if ((request.method === 'GET' || request.method === 'HEAD') && request.url?.startsWith('/monaco/vs/')) {
    try {
      const assetName = decodeURIComponent(new URL(request.url, 'http://localhost').pathname.slice('/monaco/vs/'.length));
      const assetPath = resolve(monacoRoot, assetName);
      const withinRoot = relative(monacoRoot, assetPath);
      if (!withinRoot || withinRoot.startsWith('..') || withinRoot.startsWith('/')) throw new Error('Invalid asset path');
      const asset = await readFile(assetPath);
      const contentType = {
        '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
        '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
      }[extname(assetPath)] ?? 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(request.method === 'HEAD' ? undefined : asset);
      return;
    } catch {
      response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'asset_not_found' }));
      return;
    }
  }

  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[addon] ${addonDirectory} at http://localhost:${port}/manifest.json`);
});
