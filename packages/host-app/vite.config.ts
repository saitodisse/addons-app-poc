import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const workspaceRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '/packages/addon-hello': path.resolve(workspaceRoot, 'addon-hello'),
      '/packages/addon-hello-pt': path.resolve(workspaceRoot, 'addon-hello-pt'),
      '/packages/addon-counter': path.resolve(workspaceRoot, 'addon-counter'),
    },
  },
  server: {
    port: 5280,
    // Escuta em todas as interfaces (0.0.0.0) para funcionar no WSL2:
    // o localhost-forwarding do Windows só repassa IPv4.
    host: '0.0.0.0',
    fs: {
      allow: [workspaceRoot],
    },
  },
});