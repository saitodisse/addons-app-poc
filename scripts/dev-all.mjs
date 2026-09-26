/**
 * Starts host-app and each add-on as an independent process.
 * Usage: pnpm dev
 * Ports: host-app :5280 · HTTP add-ons :5294, :5295 · in-process add-ons :5304-5309
 *
 * When a project with a `serve` script is added, removed, or changes its port,
 * update this list and synchronize `PORTS` and the orphan patterns in
 * `scripts/kill-all.mjs`.
 */
import { spawn } from 'node:child_process';

const OPEN_BROWSER = process.argv.includes('--open');

// WSL has no GUI browser; the browser runs on Windows.
// Detect WSL and open the browser only outside it (Linux with a desktop).
const isWSL = Boolean(
  process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP || process.env.WSLENV,
);

// All remaining executable demonstration packages. Contract packages and
// shared libraries are excluded because they have no own server.
// Keep this list synchronized with PORTS/patterns in kill-all.mjs.
const ADDON_SERVERS = [
  { packageName: '@addons/addon-text-wikipedia', port: 5294 },
  { packageName: '@addons/addon-chord-catalog', port: 5295 },
  { packageName: '@addons/addon-markdown', port: 5304 },
  { packageName: '@addons/addon-chord-viewer', port: 5305 },
  { packageName: '@addons/addon-favorites', port: 5306 },
  { packageName: '@addons/addon-health', port: 5307 },
  { packageName: '@addons/addon-storage-local', port: 5308 },
  { packageName: '@addons/addon-chord-editor', port: 5309 },
];

const children = [
  spawn(
    'pnpm',
    [
      '--filter',
      '@addons/host-app',
      'dev',
      ...(OPEN_BROWSER && !isWSL ? ['--', '--open'] : []),
    ],
    { stdio: 'inherit', shell: true },
  ),
  ...ADDON_SERVERS.map(({ packageName }) => spawn(
    'pnpm',
    ['--filter', packageName, 'serve'],
    { stdio: 'inherit', shell: true },
  )),
];

if (isWSL) {
  console.log('[dev] WSL detected — open a Windows browser at:');
  console.log('[dev]   http://localhost:5280/  (📄 Text tab)');
}

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

for (const child of children) {
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[dev] process exited with code ${code}`);
    }
  });
}
