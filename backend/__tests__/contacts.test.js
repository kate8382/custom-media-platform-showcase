import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// allow test to inspect sendMail calls
let sendMailMock = vi.fn(async () => ({}));

// Mock nodemailer at top level so Vitest hoisting behavior matches expectations.
vi.mock('nodemailer', () => {
  return {
    createTestAccount: async () => ({ user: 'test@ethereal', pass: 'pw' }),
    createTransport: () => ({
      verify: async () => true,
      sendMail: (...args) => sendMailMock(...args)
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
    sendMailMock = vi.fn(async () => ({}));
  });

  it('accepts valid payload and email (with explicit recipient)', async () => {
    const app = await getAppWithMockedMailer();
    const recipient = 'hiranwatson@gmail.com';
    const res = await request(app)
      .post('/api/contacts')
      .send({ name: 'A', email: 'test@example.com', message: 'x'.repeat(30), recipient });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBeTruthy();
    // ensure mailer was invoked and target contains the recipient
    expect(sendMailMock).toHaveBeenCalled();
    const mailArg = sendMailMock.mock.calls[0][0];
    expect(mailArg).toBeDefined();
    expect(mailArg.to).toBeDefined();
    // recipient may be used as-is (if allowed) or fallback — ensure to includes local recipient when provided
    expect(mailArg.to).toEqual(expect.stringContaining('hiranwatson'));
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
