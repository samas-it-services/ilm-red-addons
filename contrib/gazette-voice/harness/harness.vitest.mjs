import { defineConfig } from 'vitest/config';

/** Harness only: renders the screens to static pages. Not part of `npm test`. */
export default defineConfig({
  test: { include: ['gazette-voice/harness/render.tsx', 'gazette-voice/harness/render-manager.tsx'], environment: 'node', globals: true },
  esbuild: { jsx: 'automatic' },
});
