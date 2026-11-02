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
      const brandAssets = ['/peekmosaic-icon.svg', '/peekmosaic-logo-horizontal.svg', '/peekmosaic-app-icon-1024.png'];
      const assets = ['/index.html', '/manifest.webmanifest', ...brandAssets, ...files.map((name) => `/${name}`)];
      const hash = createHash('sha256').update(Object.values(bundle).map((entry) => entry.type === 'chunk' ? entry.code : String(entry.source)).join(''));
      for (const name of brandAssets) hash.update(readFileSync(new URL(`./public${name}`, import.meta.url)));
      const version = hash.digest('hex').slice(0, 12);
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
