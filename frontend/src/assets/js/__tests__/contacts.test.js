import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import ContactsForm from '../contacts.js';

function makeFormHtml() {
  return `
    <form id="contactsForm" data-contact-endpoint="/api/contacts">
      <label for="recipient">Send to:</label>
      <select name="recipient">
        <option value="" disabled>Select recipient</option>
        <option value="hiranwatson@gmail.com">David</option>
        <option value="e.sevciuc82@gmail.com" selected>Kate</option>
      </select>
      <input name="name" value="Test User" />
      <input name="email" value="test@example.com" />
      <textarea name="message">This is a valid message with enough length.</textarea>
      <div id="contactsFormStatus" class="contacts__form-status"></div>
      <button id="contactsFormSend" type="submit">Send</button>
    </form>
  `;
}

describe('ContactsForm', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    document.body.innerHTML = makeFormHtml();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('shows validation error for short message', async () => {
    const form = document.getElementById('contactsForm');
    form.querySelector('[name="message"]').value = 'short';
    const handler = new ContactsForm('#contactsForm');
    handler.init();

    const spy = vi.fn();
    global.fetch = spy;

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    const status = document.getElementById('contactsFormStatus');
    expect(status.textContent).toContain('Message is too short');
    expect(spy).not.toHaveBeenCalled();
  });

  it('posts to backend and shows success on ok response', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true }));
    const handler = new ContactsForm('#contactsForm');
    handler.init();

    const form = document.getElementById('contactsForm');
    form.querySelector('[name="message"]').value =
      'This message is long enough to pass validation.';

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    // wait a tick for async handler
    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = document.getElementById('contactsFormStatus');
    expect(status.textContent).toContain('Message sent');
    expect(global.fetch).toHaveBeenCalled();
    const calledWith = global.fetch.mock.calls[0][0];
    expect(calledWith).toBe('/api/contacts');
    const options = global.fetch.mock.calls[0][1];
    const body = JSON.parse(options.body);
    expect(body.recipient).toBe('e.sevciuc82@gmail.com');
  });

  it('shows error when backend responds with error payload', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'rate limit' }) })
    );
    const handler = new ContactsForm('#contactsForm');
    handler.init();

    const form = document.getElementById('contactsForm');
    form.querySelector('[name="message"]').value =
      'This message is long enough to pass validation.';

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = document.getElementById('contactsFormStatus');
    expect(status.textContent).toContain('Failed to send');
  });
});
