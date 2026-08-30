import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { imagetools } from 'vite-imagetools';
import fs from 'fs';
import path from 'path';

// The post-build copy plugin was removed because it duplicated generated
// source files into `dist/assets/.../generated`. Generated source files
// are created before the Vite build (see `npm run build`) so Vite already
// emits optimized, hashed copies into `dist/assets`. Copying the raw
// `frontend/src/assets/*/generated` folder into `dist` caused unwanted
// duplicate files. Keep the build output clean by relying on Vite's
// asset handling instead of duplicating the folder here.

export default defineConfig({
  // Serve files from frontend/src where index.html currently lives
  root: 'frontend/src',
  // For CI/GitHub Pages builds set a repo-aware base path so built assets
  // reference the correct subpath (e.g. `/owner/repo/`). Locally we keep
  // `/` for dev server HMR.
  base: process.env.VITE_BASE || (process.env.CI && process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : '/'),
  // ensure Vite/Vitest cache is stored in the repository-level node_modules
  // (prevents creating a separate `frontend/src/node_modules` when tests run with
  // the project root set to `frontend/src`). This path is relative to the
  // repository root where this config lives.
  cacheDir: '../../node_modules/.vite',
  server: {
    open: true,
    port: 5173,
    // dev proxy: forward /api requests to local backend server
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/api/, '/api')
      }
    }
  },
  resolve: {
    alias: {
      // allow imports like import X from '@/js/foo'
      '@': fileURLToPath(new URL('./frontend/src', import.meta.url))
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        // add project scss folder to include paths so imports can be shorter
        includePaths: [fileURLToPath(new URL('./frontend/src/assets/scss', import.meta.url))]
      }
    }
  },
  build: {
    // place final build in repository-level dist frontend folder
    outDir: '../../dist/frontend',
    emptyOutDir: true,
    sourcemap: true
    // rollupOptions or other build-time options can be added here
  },
  preview: {
    allowedHosts: []
  },
  plugins: [
    imagetools(),
  ]
});
