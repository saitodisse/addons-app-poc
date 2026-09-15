import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,
    // Listen on every interface (0.0.0.0) for WSL2 compatibility:
    // Windows localhost forwarding only passes through IPv4.
    host: '0.0.0.0',
  },
});
