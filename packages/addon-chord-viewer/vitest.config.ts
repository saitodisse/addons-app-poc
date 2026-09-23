import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The add-on renders React components, so the JSX runtime must be automatic.
  esbuild: { jsx: 'automatic' },
});
