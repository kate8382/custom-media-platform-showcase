// vitest setup file: place global mocks or polyfills here
// Example: make global fetch available (uncomment if needed)
// import 'whatwg-fetch';

// Silence console noise in tests (optional)
// global.console = { ...console, log: () => {} };

// Provide a simple requestAnimationFrame shim for jsdom environment
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

// Ensure scrollTo exists and is a noop to avoid errors in tests
if (typeof globalThis.scrollTo === 'undefined') {
  globalThis.scrollTo = () => {};
}

// Silence noisy console output from application code during tests
// Uncomment or adjust if you want to see logs while debugging tests
globalThis.__originalConsole = globalThis.console;
globalThis.console = {
  ...globalThis.console,
  log: () => {},
  warn: () => {},
  error: () => {},
};
