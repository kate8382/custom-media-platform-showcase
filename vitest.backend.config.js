import { defineConfig } from 'vitest/config';

// Ensure tests know where to find the built frontend by default. This can be
// overridden by setting FRONTEND_DIST_DIR in the environment (useful for CI
// or local runs that output to dist/frontend).
process.env.FRONTEND_DIST_DIR = process.env.FRONTEND_DIST_DIR || 'dist/frontend';

export default defineConfig({
  test: {
    root: '.',
    environment: 'node',
    include: ['backend/**/?(*.)+(test|spec).{js,ts}'],
    reporters: ['default']
  }
});
