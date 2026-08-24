import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    environment: 'jsdom',
    include: ['frontend/src/assets/js/**/__tests__/**/*.test.{js,ts}', 'frontend/src/assets/js/**/?(*.)+(test|spec).{js,ts}'],
    setupFiles: ['frontend/src/assets/js/__tests__/vitest.setup.js', 'frontend/src/assets/js/__tests__/vitest.setup.js'],
    reporters: ['default'],
    // Use a built-in provider supported by this Vitest version.
    // 'c8' is not a built-in provider for Vitest v4.1.5 and causes an import error.
    // Use 'istanbul' to get lcov + text reports, or 'v8' for V8-native coverage.
    coverage: { provider: 'istanbul', reporter: ['text', 'lcov'] }
  }
});
