// Contacts form handler implemented as a class to enable unit testing and re-use.
const renderApiURL = import.meta.env.VITE_API_URL || '';

export class ContactsForm {
  constructor(selector = '#contactsForm', options = {}) {
    this.selector = selector;
    this.form = typeof selector === 'string' ? document.querySelector(selector) : selector;
    this.options = options || {};
    this.statusEl = null;
    this.submitBtn = null;
    this.defaultEndpoint = this.options.defaultEndpoint || `${renderApiURL}/api/contacts`;
    this._clearTimer = null;
  }

  init() {
    console.log('In ContactsForm init...');
    console.log(`Render API URL: ${renderApiURL}`);
    console.log(`Default endpoint: ${this.defaultEndpoint}`);

    if (!this.form) return false;
    try {
      this.form.noValidate = true;
    } catch {}

    // Disable native required/minlength for the message field so JS shows a consistent message
    try {
      const msgField = this.form.querySelector('[name="message"]');
      if (msgField) {
        msgField.required = false;
        msgField.minLength = 0;
        if (msgField.removeAttribute) msgField.removeAttribute('minlength');
      }
    } catch {}

    console.debug && console.debug('[ContactsForm] init:', !!this.form);

    this.statusEl =
      this.form.querySelector('#contactsFormStatus') ||
      this.form.querySelector('.contacts__form-status');
    this.submitBtn = this.form.querySelector('#contactsFormSend');
    this.form.addEventListener('submit', this.handleSubmit.bind(this));
    return true;
  }

  setStatus(message, ok) {
    if (!this.statusEl) return;
    // debug

    console.debug && console.debug('[ContactsForm] setStatus:', message, ok);
    if (this._clearTimer) {
      clearTimeout(this._clearTimer);
      this._clearTimer = null;
    }
    this.statusEl.textContent = message;
    this.statusEl.classList.remove('success', 'error');
    this.statusEl.classList.add(ok ? 'success' : 'error');
    this.statusEl.classList.add('form-status');
    if (ok) {
      const timeout = this.options.successTimeout || 5000;
      this._clearTimer = setTimeout(() => this.clearStatus(), timeout);
    }
  }

  clearStatus() {
    if (!this.statusEl) return;
    this.statusEl.textContent = '';
    this.statusEl.classList.remove('form-status', 'success', 'error');
    if (this._clearTimer) {
      clearTimeout(this._clearTimer);
      this._clearTimer = null;
    }
  }

  attachClearOnField(fieldName) {
    if (!this.form || !fieldName) return;
    const field = this.form.querySelector(`[name="${fieldName}"]`);
    if (!field) return;
    const handler = () => {
      this.clearStatus();
      field.removeEventListener('focus', handler);
      field.removeEventListener('input', handler);
    };
    field.addEventListener('focus', handler);
    field.addEventListener('input', handler);
  }

  async handleSubmit(e) {
    e.preventDefault();

    console.debug && console.debug('[ContactsForm] handleSubmit start');
    const form = this.form;

    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector(':invalid');
      if (firstInvalid) {
        firstInvalid.focus();
        if (firstInvalid.name === 'name') {
          this.setStatus('Please enter your name.', false);
          this.attachClearOnField('name');
          return;
        } else if (firstInvalid.name === 'email') {
          if (firstInvalid.validity && firstInvalid.validity.valueMissing) {
            this.setStatus('Please enter your email address.', false);
          } else {
            this.setStatus('Please enter a valid email address.', false);
          }
          this.attachClearOnField('email');
          return;
        } else if (
          firstInvalid.name === 'message' &&
          firstInvalid.validity &&
          firstInvalid.validity.tooShort
        ) {
          // fallback to our custom message handling below — do NOT return here
        } else {
          this.setStatus(firstInvalid.validationMessage || 'Please complete the form.', false);
          return;
        }
      }
    }

    const name = form.querySelector('[name="name"]').value.trim();
    const email = form.querySelector('[name="email"]').value.trim();
    const recipientField = form.querySelector('[name="recipient"]');
    const recipient = recipientField ? recipientField.value.trim() : '';
    const message = form.querySelector('[name="message"]').value.trim();

    if (message.length < 20) {
      // focus first, then attach clear handler to avoid immediately clearing the status
      form.querySelector('[name="message"]').focus();
      this.attachClearOnField('message');
      this.setStatus('Message is too short — please enter at least 20 characters.', false);
      return;
    }

    const backendEndpoint = form.getAttribute('data-contact-endpoint') || this.defaultEndpoint;

    if (this.submitBtn) this.submitBtn.disabled = true;
    this.setStatus('Sending...', true);

    try {
      if (backendEndpoint) {
        const res = await fetch(backendEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, message, recipient }),
        });

        if (res.ok) {
          this.setStatus('Message sent — thank you!', true);
          form.reset();
        } else {
          // show a generic failure message (tests expect a generic 'Failed to send')
          try {
            await res.json();
          } catch {}
          this.setStatus('Failed to send', false);
        }
      } else {
        const to = recipient || '';
        const subject = encodeURIComponent('Frontend message from ' + name);
        const body = encodeURIComponent('From: ' + name + ' <' + email + '>\n\n' + message);
        const mailto = 'mailto:' + encodeURIComponent(to) + '?subject=' + subject + '&body=' + body;
        window.location.href = mailto;
        this.setStatus('Opened mail client as fallback.', true);
      }
    } catch (err) {
      console.error('Contact send error', err);
      this.setStatus('Failed to send message. You can also email directly.', false);
    } finally {
      if (this.submitBtn) this.submitBtn.disabled = false;
    }
  }
}

// Auto-init for runtime
document.addEventListener('DOMContentLoaded', () => {
  try {
    const handler = new ContactsForm('#contactsForm');
    handler.init();
  } catch {}
});

export default ContactsForm;
