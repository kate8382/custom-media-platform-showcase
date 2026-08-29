/** Playwright config (CommonJS) */
const isCI = !!process.env.CI;

const startCommand = isCI
  ? 'npm run build:frontend && npx concurrently "node backend/server.js" "npm run start:frontend"'
  : 'npx concurrently "node backend/server.js" "npx vite --port 5173 --strictPort --host 127.0.0.1"';

module.exports = {
  testDir: './tests',
  // Increase timeouts to reduce flakes on slower CI/hosts
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  use: {
    headless: true,
    // use localhost so local dev server (often bound to localhost) is detected
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Disable automatic video recording to save time and disk during normal runs.
    // Set PLAYWRIGHT_VIDEO=retain-on-failure to override when debugging.
    video: process.env.PLAYWRIGHT_VIDEO || 'off',
    launchOptions: {
      // keep headless; per-project args set below (WebKit doesn't accept --disable-dev-shm-usage)
    }
  },
  // Automatically start the dev servers when running tests locally
  webServer: {
    // Start both backend and frontend via existing npm script. Playwright will
    // wait for the configured `url` to be available before running tests.
    // Start backend and frontend explicitly, binding Vite to 127.0.0.1
    command: startCommand,
    url: 'http://localhost:5173',
    reuseExistingServer: !!process.env.CI_REUSE_SERVERS || !process.env.CI,
    // increase wait time for CI environments where installs/builds are slower
    timeout: isCI ? 300000 : 240000,
  },
  projects: (() => {
    const base = [
      { name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: ['--disable-dev-shm-usage'] } } },
      { name: 'firefox', use: { browserName: 'firefox', launchOptions: { args: ['--disable-dev-shm-usage'] } } }
    ];

    // WebKit often requires extra host libraries on Windows (libcurl etc.).
    // Exclude WebKit on Windows to avoid local developer failures while
    // keeping it in CI (Linux/macOS) where dependencies are installed.
    const isWindows = process.platform === 'win32';
    if (!isWindows) {
      base.push({ name: 'webkit', use: { browserName: 'webkit' } });
    }

    return base;
  })()
}
