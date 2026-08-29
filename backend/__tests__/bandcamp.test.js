import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../server.js';

describe('GET /api/bandcamp', () => {
  it('returns generated HTML from track_data.json', async () => {
    const res = await request(app).get('/api/bandcamp');
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
    // response is an object { html: '<li>...</li>' }
    expect(res.body).toBeDefined();
    expect(res.body.html).toBeDefined();
    const html = res.body.html;
    expect(html).toMatch(/<li\s+class="playlist__item"/);
    expect(html).toMatch(/iframe/i);
    expect(html).toMatch(/EmbeddedPlayer/);
  });
});
