import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,
    // Escuta em todas as interfaces (0.0.0.0) para funcionar no WSL2:
    // o localhost-forwarding do Windows só repassa IPv4.
    host: '0.0.0.0',
  },
});
