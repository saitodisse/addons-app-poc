/**
 * Sobe o host-app e cada add-on como processo independente.
 * Uso: pnpm dev
 * Portas: host-app :5280 · add-ons HTTP :5291-5294 · add-ons em processo :5301-5310
 *
 * Quando um projeto com script `serve` for adicionado, removido ou mudar de
 * porta, atualize esta lista e sincronize `PORTS` e os padrões de órfãos em
 * `scripts/kill-all.mjs`.
 */
import { spawn } from 'node:child_process';

const OPEN_BROWSER = process.argv.includes('--open');

// No WSL não há navegador com GUI — o browser fica no Windows.
// Detecta WSL e só abre o navegador fora dele (Linux com desktop).
const isWSL = Boolean(
  process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP || process.env.WSLENV,
);

// Todos os pacotes executáveis da demonstração. Pacotes de contrato e
// bibliotecas compartilhadas não entram porque não têm um servidor próprio.
// Mantenha esta lista sincronizada com PORTS/padrões em kill-all.mjs.
const ADDON_SERVERS = [
  { packageName: '@addons/addon-text-biblioteca', port: 5291 },
  { packageName: '@addons/addon-text-citacoes', port: 5292 },
  { packageName: '@addons/addon-text-poemas', port: 5293 },
  { packageName: '@addons/addon-text-wikipedia', port: 5294 },
  { packageName: '@addons/addon-hello', port: 5301 },
  { packageName: '@addons/addon-hello-pt', port: 5302 },
  { packageName: '@addons/addon-counter', port: 5303 },
  { packageName: '@addons/addon-markdown', port: 5304 },
  { packageName: '@addons/addon-aggregator', port: 5305 },
  { packageName: '@addons/addon-favorites', port: 5306 },
  { packageName: '@addons/addon-health', port: 5307 },
  { packageName: '@addons/addon-storage-local', port: 5308 },
  { packageName: '@addons/addon-storage-session', port: 5309 },
  { packageName: '@addons/addon-debug', port: 5310 },
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
  console.log('[dev] WSL detectado — abra o navegador do Windows em:');
  console.log('[dev]   http://localhost:5280/  (aba 📄 Textos)');
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
      console.error(`[dev] processo encerrou com código ${code}`);
    }
  });
}
