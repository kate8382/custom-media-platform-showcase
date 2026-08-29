import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock nodemailer at top level so Vitest hoisting behavior matches expectations.
vi.mock('nodemailer', () => {
  return {
    createTestAccount: async () => ({ user: 'test@ethereal', pass: 'pw' }),
    createTransport: () => ({
      verify: async () => true,
      sendMail: async () => ({})
    }),
    getTestMessageUrl: () => null
  };
});

// Helper to import fresh app with nodemailer mocked
async function getAppWithMockedMailer() {
  vi.resetModules();
  // emulate dev so setupMailer runs, but mock nodemailer to avoid network
  process.env.NODE_ENV = 'development';

  const mod = await import('../server.js');
  return mod.default;
}

describe('Contacts POST /api/contacts', () => {
  beforeEach(() => {
    // ensure clean module state before each test
    vi.resetModules();
  });

  it('accepts valid payload and email', async () => {
    const app = await getAppWithMockedMailer();
    const res = await request(app)
      .post('/api/contacts')
      .send({ name: 'A', email: 'test@example.com', message: 'x'.repeat(30) });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBeTruthy();
  });

  it('rejects invalid email', async () => {
    const app = await getAppWithMockedMailer();
    const res = await request(app)
      .post('/api/contacts')
      .send({ name: 'A', email: 'not-an-email', message: 'x'.repeat(30) });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBeFalsy();
  });

  it('rate-limits after multiple requests from same ip', async () => {
    const app = await getAppWithMockedMailer();
    const ip = '203.0.113.9';
    let last;
    for (let i = 0; i < 11; i++) {
      last = await request(app)
        .post('/api/contacts')
        .set('X-Forwarded-For', ip)
        .send({ name: 'A', email: 'test@example.com', message: 'x'.repeat(30) });
    }
    expect(last.status).toBe(429);
    expect(last.body.ok).toBeFalsy();
  }, 20000);
});
