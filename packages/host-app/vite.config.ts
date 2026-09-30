import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  plugins: [react(), {
    name: 'offline-application',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((name) => !name.endsWith('.map'));
      const assets = ['/index.html', '/manifest.webmanifest', '/icon.svg', ...files.map((name) => `/${name}`)];
      const version = createHash('sha256').update(Object.values(bundle).map((entry) => entry.type === 'chunk' ? entry.code : String(entry.source)).join('')).digest('hex').slice(0, 12);
      const worker = readFileSync(new URL('./offline-worker.js', import.meta.url), 'utf8').replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify([...new Set(assets)]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker });
    },
  }],
  server: {
    port: 5280,
    // Listen on every interface (0.0.0.0) for WSL2 compatibility:
    // Windows localhost forwarding only passes through IPv4.
    host: '0.0.0.0',
  },
});
