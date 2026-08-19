/**
 * Sobe o host-app E os servidores dos add-ons de texto juntos.
 * Uso: pnpm dev
 * Portas: host-app :5280 · biblioteca :5291 · citações :5292 · poemas :5293
 */
import { spawn } from 'node:child_process';

const OPEN_BROWSER = process.argv.includes('--open');

// No WSL não há navegador com GUI — o browser fica no Windows.
// Detecta WSL e só abre o navegador fora dele (Linux com desktop).
const isWSL = Boolean(
  process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP || process.env.WSLENV,
);

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
  spawn('pnpm', ['--filter', '@addons/addon-text-biblioteca', 'serve'], { stdio: 'inherit', shell: true }),
  spawn('pnpm', ['--filter', '@addons/addon-text-citacoes', 'serve'], { stdio: 'inherit', shell: true }),
  spawn('pnpm', ['--filter', '@addons/addon-text-poemas', 'serve'], { stdio: 'inherit', shell: true }),
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
