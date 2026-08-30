# Custom Media Platform Showcase

[![CI](https://github.com/kate8382/custom-media-platform-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/kate8382/custom-media-platform-showcase/actions)
[![Pages](https://github.com/kate8382/custom-media-platform-showcase/actions/workflows/deploy-gh-pages.yml/badge.svg)](https://github.com/kate8382/custom-media-platform-showcase/actions)

A high-performance, responsive single-page web architecture designed for audio streaming, dynamic Bandcamp integration, and custom media showcases.

<p align="center">
  <img src="frontend/src/assets/img/banner.png" alt="Banner" />
</p>

> Legacy client notes (redacted): [documentation/legacy-client-notes.md](documentation/legacy-client-notes.md)

> Testing & QA guide: [TESTS.md](TESTS.md)

### Project Goal

This repository is an engineering showcase and portfolio piece demonstrating modern frontend architecture, automated build pipelines, optimized media streaming, and modular component design.

### Project History & Origins

- Originally initiated as a client-based media platform to deliver custom digital storefronts and streaming capabilities.
- Redesigned and refactored into a full open-source architecture showcase by **David H. Watson** ([@dEhiN](https://github.com/dEhiN)) and **Ecaterina Sevciuc** ([@kate8382](https://github.com/kate8382)).
- **David** served as the Project Lead, Systems Architect, and Backend Developer.
- **Ecaterina** served as the Lead Frontend Architect, UI/UX Developer, and Test Integration Lead.

### Project Resources

1. **Audio Integration & Assets**

- Seamless Bandcamp player integration using dynamic JSON payload parsers and `iframe` embeds.
- Support for custom HTML5 audio fallback components and responsive media pipelines.

2. **Design System & Assets**

- Custom design system built with modular SCSS, CSS `clamp()` for fluid typography, and responsive media layouts.

### Project Structure

- `/` — repository root and configuration.
- `/build-tools` — Node.js scripts for automated image optimization and video transcoding used during the build.
- `/design` — design artifacts and Figma references.
- `/dist` — production build output (git-ignored).
- `/documentation` — architecture specs and testing guidelines.
- `/frontend` — frontend client source and assets.
  - `/frontend/src` — development source files (`index.html`, `assets/`, `scss/`, `js/`).
- `/scripts` — utility scripts for asset processing and data extraction.
- `/testing` — QA frameworks and test suites.

### Development — Local setup

1. **Node.js Environment**

- Recommended: Node.js 22.19.x or 24.x (LTS).
- Using `nvm` (or `nvm-windows`) is recommended to manage versions:
  ```bash
  nvm install 22.19.0
  nvm use 22.19.0
  ```

2. **Install dependencies**

```bash
rm -rf node_modules package-lock.json
npm ci
```

3. **Common npm scripts**

```bash
npm run dev:frontend   # Vite dev server (HMR)
npm run dev:all        # Start backend (nodemon) + frontend dev server concurrently
npm run build:frontend # Build frontend production output
npm run build:backend  # Build backend output
npm run build:all      # Build both frontend and backend
npm run start:all      # Start preview/backend (or dev:all during development)
npm run lint           # Run ESLint
npm run format         # Run Prettier
```

4. **Husky (git hooks)**

```bash
npm run prepare
```

5. **Asset pipelines (images, audio & video)**

- Put high-resolution source images in `frontend/src/assets/img/originals/`, audio in `frontend/src/assets/audio/`, and videos in `frontend/src/assets/video/`.
- Generate responsive image and video assets:

  ```bash
  npm run gen:images
  npm run gen:videos
  ```

- Audio generation & verification
  - Generate WAV previews from source MP3s:
    - POSIX: `npm run gen:audio`
    - Windows (cmd/PowerShell): `npm run gen:audio` (use `set` to set env vars, see examples below)
  - Force regeneration (overwrite existing generated files):
    - POSIX: `FORCE=1 npm run gen:audio`
    - Windows: `set FORCE=1&& npm run gen:audio`
  - Skip writing into `dist/` when you only need source-side generated files:
    - POSIX: `SKIP_DIST=1 npm run gen:audio`
    - Windows: `set SKIP_DIST=1&& npm run gen:audio`
  - Control verification step (ffprobe checks):
    - To skip ffprobe verification: `VERIFY=0 npm run gen:audio` (POSIX) or `set VERIFY=0&& npm run gen:audio` (Windows).
  - Generate a JSON report summarising source MP3 vs generated WAV files:
    ```bash
    node ./build-tools/report-audio.cjs
    ```
  - To remove generated audio files (cross-platform):
    ```bash
    npx rimraf frontend/src/assets/audio/generated dist/assets/audio
    ```

- Video cleaning & verification
  - Quick clean of generated videos folder:
    ```bash
    node ./build-tools/gen-videos.cjs clean
    # or via npm: npm run gen:videos -- clean
    ```
  - Force re-transcode all source videos:
    - POSIX: `FORCE=1 npm run gen:videos`
    - Windows: `set FORCE=1&& npm run gen:videos`
  - `gen-videos` writes transcode logs to `frontend/src/assets/video/generated/logs/` and verifies durations (it will error on significant duration mismatches).

- Images: to clean generated images

  ```bash
  node ./build-tools/gen-images.cjs clean
  # or: npm run gen:images -- clean
  ```

- Notes:
  - Use `FORCE=1` when you changed source media and want to overwrite generated artifacts.
  - Use `SKIP_DIST=1` during development to avoid writing into `dist/` when only source-side `generated/` files are needed.
  - When working on Windows and setting multiple env vars, separate them with `&&` as shown above.

### Collaboration Workflow

1. **Main branch** — stable, production-ready releases only.
2. **Feature branches** — use descriptive prefixes: `feature/`, `bug-fix/`, `documentation/`.
3. **Pull requests** — require code review and passing CI before merging.

### Tech Stack

- Frontend: HTML5, SCSS (CSS clamp), JavaScript (ES6+), Vanilla SPA router
- Tooling & Build: Vite, Node.js, Express, FFmpeg, Sharp
- Testing & QA: Vitest, Playwright, ESLint, Prettier

### Engineering Highlights (summary)

- Refactored legacy server-side path resolution and environment management to improve local development and deployment reliability.
- Implemented a CLI media pipeline (Node.js + `fluent-ffmpeg`) for automated audio preview generation and lightweight streaming.
- Built a zero-dependency Vanilla JS SPA router with lifecycle hooks and a11y focus management.
- Integrated a testing setup (Vitest) with isolation for I/O and reduced flakiness in CI runs.

## Additional developer notes (configuration, gotchas, and recommendations)

### Ports & dev servers

- Frontend (Vite) default dev server: `http://localhost:5173` (HMR enabled).
- Backend (Express) default dev port: `3000` (can be overridden with `PORT` in `.env`).
- When running locally with `npm run dev:all` the frontend and backend run concurrently; ensure `FRONTEND_URL` is set in backend `.env` or the server allows `http://localhost:5173` in CORS during development.

### Environment and SMTP behaviour

- The backend reads runtime configuration from `backend/.env` (copy from `backend/.env.example`).
- In development, if no SMTP credentials are provided the server creates an Ethereal test account and does NOT forward emails to real inboxes — Ethereal provides a preview URL where the message can be inspected. To send real email, populate `EMAIL_FROM_USER`, `EMAIL_FROM_PASSWORD`, and `EMAIL_SERVICE_NAME` in `.env`, and set `SERVER_LIVE=true` for production behaviour.
- Allowed recipients are controlled by `EMAIL_RECIPIENTS` (semicolon-separated). If set, the backend will only forward to addresses listed there for safety.

### Contact form behaviour & debugging

- The frontend contact form sends JSON to `POST /api/contacts` with `{ name, email, message, recipient }` when a recipient is selected. When no backend is configured the frontend falls back to `mailto:` as a client-side fallback.
- Common local CORS issue: if the backend's CORS whitelist doesn't include `http://localhost:5173` (or `FRONTEND_URL`), the browser will block the POST. Set `FRONTEND_URL=http://localhost:5173` in `backend/.env` or run the backend in dev mode where localhost:5173 is allowed by default.

### Tests & CI notes

- Unit tests (frontend) — run `npm test` (Vitest, jsdom). Backend-specific tests: `npm run test:backend`.
- E2E tests — `npm run test:e2e` uses Playwright. On Windows, WebKit may fail due to host library issues (libcurl); CI workflows skip or run selective browsers. See `e2e/playwright.config.cjs` for details.
- When adjusting tests that depend on environment variables, set them before running (examples in vitest backend config files).

### What we changed to prepare for public release

- Replaced personal developer emails in contact tests and backend README with placeholders.
- Added `backend/.env.example` and documented publishing checklist to avoid committing secrets.
- Adjusted `build-tools/gen-videos.cjs` to be more tolerant of small duration differences when generating WebM output.
- Redacted other sensitive notes into `documentation/legacy-client-notes.md` with guidance to keep original archives offline.

## License

- **Codebase:** Distributed under the [MIT License](LICENSE).
- **Media & Assets:** All visual assets, video demos (`presentation.mp4` / `.webm`), audio samples, and screenshots are copyright © 2026 David H. Watson & Ecaterina Sevciuc. All rights reserved. Not licensed for reuse or redistribution without explicit permission.

For performer/licensing information related to embedded tracks (Bandcamp releases), see the Bandcamp metadata in `backend/bandcamp_embeds.txt` or the official release pages.

---

Last Updated: August 2026
