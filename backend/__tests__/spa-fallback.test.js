import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Ensure server runs in production mode for the SPA fallback behavior during the test
process.env.SERVER_LIVE = 'true';

// Create a minimal dist/frontend/index.html so the SPA fallback can serve it
const distFrontend = path.join(process.cwd(), 'dist', 'frontend');
const indexHtml = path.join(distFrontend, 'index.html');
let app;

beforeAll(async () => {
  fs.mkdirSync(distFrontend, { recursive: true });
  fs.writeFileSync(indexHtml, '<!doctype html><html><head></head><body>test index</body></html>');
  // create a temporary .env so server.js's dotenv picks up SERVER_LIVE
  fs.writeFileSync(path.join(process.cwd(), '.env'), 'SERVER_LIVE=true\n');
  // dynamically import server after .env and static files are ready
  const mod = await import('../server.js');
  app = mod.default || mod;
});

afterAll(() => {
  try {
    fs.unlinkSync(indexHtml);
    fs.rmdirSync(distFrontend, { recursive: true });
    // remove temp .env
    fs.unlinkSync(path.join(process.cwd(), '.env'));
  } catch (e) { }
});

describe('SPA fallback', () => {
  it('serves index.html for unknown client routes', async () => {
    const res = await request(app).get('/some/deep/link').set('Accept', 'text/html');
    expect(res.status).toBe(200);
    // basic sanity: response contains html doctype or <html
    expect(res.text.includes('<!doctype') || res.text.includes('<html')).toBeTruthy();
  });

  it('returns 404 or static file for asset requests', async () => {
    const res = await request(app).get('/assets/app.js');
    // Either served as static (200) or falls through (404)
    expect([200, 404].includes(res.status)).toBeTruthy();
  });
});
