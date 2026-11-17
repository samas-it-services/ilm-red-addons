import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/tests/**/*.test.{mjs,ts,tsx}'],
    exclude: ['node_modules/**'],
  },
  esbuild: { jsx: 'automatic' },
});
