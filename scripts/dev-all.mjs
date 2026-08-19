/**
 * Sobe o host-app E os servidores dos add-ons de texto juntos.
 * Uso: pnpm dev
 * Portas: host-app :5280 · biblioteca :5291 · citações :5292 · poemas :5293
 */
import { spawn } from 'node:child_process';

const OPEN_BROWSER = process.argv.includes('--open');

const children = [
  spawn('pnpm', ['--filter', '@addons/host-app', 'dev', ...(OPEN_BROWSER ? ['--', '--open'] : [])], {
    stdio: 'inherit',
    shell: true,
  }),
  spawn('pnpm', ['--filter', '@addons/addon-text-biblioteca', 'serve'], { stdio: 'inherit', shell: true }),
  spawn('pnpm', ['--filter', '@addons/addon-text-citacoes', 'serve'], { stdio: 'inherit', shell: true }),
  spawn('pnpm', ['--filter', '@addons/addon-text-poemas', 'serve'], { stdio: 'inherit', shell: true }),
];

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
