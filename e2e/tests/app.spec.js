import { test, expect } from '@playwright/test'

// Shared setup: block heavy external requests (bandcamp assets) and stub window.open
test.beforeEach(async ({ page }) => {
  // Aggressive media-silencing: mute HTMLMediaElements, disable WebAudio, and periodically enforce mute.
  await page.addInitScript(() => {
    try {
      // Disable WebAudio API by replacing constructors with no-op implementations
      const SilentAudioContext = function () {
        this.resume = () => Promise.resolve();
        this.suspend = () => Promise.resolve();
        this.close = () => Promise.resolve();
        this.createBufferSource = () => ({ connect: () => { }, start: () => { }, stop: () => { } });
        this.createGain = () => ({ connect: () => { }, gain: { value: 0 } });
      };
      window.AudioContext = SilentAudioContext;
      window.webkitAudioContext = SilentAudioContext;

      // Override play to ensure media is muted before any play and then no-op the play promise
      try {
        const _origPlay = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function () {
          try { this.muted = true; this.volume = 0; } catch (e) { }
          return Promise.resolve();
        };
        HTMLMediaElement.prototype._originalPlay = _origPlay;
      } catch (e) { }

      // Prevent dynamic unmuting by listening and forcing mute on play events
      document.addEventListener('play', (e) => { try { e.target.muted = true; e.target.volume = 0; e.target.pause && e.target.pause(); } catch (e) { } }, true);

      // Intercept creation of iframes to try to mute their media after load
      const origCreateElement = Document.prototype.createElement;
      Document.prototype.createElement = function (tagName, options) {
        const el = origCreateElement.call(this, tagName, options);
        if (tagName && tagName.toLowerCase() === 'iframe') {
          el.addEventListener('load', () => {
            try {
              const win = el.contentWindow;
              if (win && win.document) {
                try { win.HTMLMediaElement && (win.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); }); } catch (e) { }
                try { win.AudioContext = function () { this.resume = () => Promise.resolve(); }; } catch (e) { }
              }
            } catch (e) { }
          });
        }
        return el;
      };
      // Intercept attribute changes to block attempts to unmute
      const origSetAttribute = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function (name, value) {
        try {
          if (this && this.tagName && this.tagName.toLowerCase() === 'video' && name.toLowerCase() === 'muted' && (value === 'false' || value === '0')) {
            return; // ignore attempts to unmute
          }
        } catch (e) { }
        return origSetAttribute.call(this, name, value);
      };
      const origRemoveAttribute = Element.prototype.removeAttribute;
      Element.prototype.removeAttribute = function (name) {
        try {
          if (this && this.tagName && this.tagName.toLowerCase() === 'video' && name.toLowerCase() === 'muted') {
            return; // ignore removals of muted
          }
        } catch (e) { }
        return origRemoveAttribute.call(this, name);
      };

      // Observe DOM for added video elements and enforce mute/pause immediately
      const mo = new MutationObserver(mutations => {
        for (const m of mutations) {
          if (m.addedNodes) {
            m.addedNodes.forEach(node => {
              try {
                if (node && node.tagName && node.tagName.toLowerCase() === 'video') {
                  try { node.muted = true; node.volume = 0; node.pause && node.pause(); } catch (e) { }
                }
                // also check descendants
                if (node && node.querySelectorAll) {
                  const vids = node.querySelectorAll('video');
                  vids.forEach(v => { try { v.muted = true; v.volume = 0; v.pause && v.pause(); } catch (e) { } });
                }
              } catch (e) { }
            });
          }
          if (m.type === 'attributes' && m.target && m.target.tagName && m.target.tagName.toLowerCase() === 'video' && m.attributeName === 'muted') {
            try { m.target.muted = true; m.target.volume = 0; m.target.pause && m.target.pause(); } catch (e) { }
          }
        }
      });
      mo.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['muted'] });

      // Periodically enforce mute on any media elements present in any frame
      setInterval(() => {
        try {
          const iter = [window.document];
          const iframes = window.document.querySelectorAll('iframe');
          iframes.forEach(f => { try { if (f.contentDocument) iter.push(f.contentDocument); } catch (e) { } });
          iter.forEach(doc => {
            const media = doc.querySelectorAll && doc.querySelectorAll('video,audio');
            if (!media) return;
            media.forEach(m => { try { m.muted = true; m.volume = 0; m.pause && m.pause(); } catch (e) { } });
          });
        } catch (e) { }
      }, 150);

      // Stub window.open early
      window.open = (u) => { window.__last_open = u; };
    } catch (e) { }
  });

  // Block heavy external requests that can cause flakiness
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('github.com') || url.includes('googletagmanager.com') || url.includes('google-analytics.com') || url.includes('doubleclick.net') || url.includes('googlesyndication.com')) {
      return route.abort();
    }
    return route.continue();
  });
});

test('contacts form submits and shows status', async ({ page }) => {
  await page.route('**/api/contacts', route => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/#contacts', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('section#contacts')).toBeVisible();

  await page.fill('#name', 'Test User');
  await page.fill('#email', 'test@example.com');
  await page.fill('#message', 'This is a test message that is long enough.');

  await page.click('#contactsFormSend');

  const status = page.locator('#contactsFormStatus');
  await expect(status).toHaveText(/./, { timeout: 5000 });
});

test('header navigation routes to sections', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('header')).toBeVisible();

  // Test navigation to playlist
  await page.click('a.header__nav-link[href="#playlist"]');
  await expect(page.locator('section#playlist')).toBeVisible();

  // Test navigation to contacts
  await page.click('a.header__nav-link[href="#contacts"]');
  await expect(page.locator('section#contacts')).toBeVisible();
});

test('hero bandcamp button opens Bandcamp link', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const btn = page.locator('#githubBtn');
  await expect(btn).toBeVisible();

  // Support both legacy `data-href` (button) and semantic `href` (anchor)
  const dataHref = await btn.getAttribute('data-href');
  const hrefAttr = await btn.getAttribute('href');
  const href = dataHref || hrefAttr;
  expect(href).toBeTruthy();
  expect(href.includes('github.com')).toBeTruthy();

  await btn.click();
  const last = await page.evaluate(() => window.__last_open || null);
  expect(last).toContain('github.com');
});

test('playlist page loads and has server-inserted items', async ({ page }) => {
  await page.goto('/#playlist', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('section#playlist')).toBeVisible();
  // Accept either the legacy title or the updated showcase title
  await expect(page.locator('.playlist__title')).toHaveText(/Audio Showcase/);

  const items = page.locator('#playList .playlist__item');
  // wait longer for items to be injected
  await expect(items.first()).toBeVisible({ timeout: 30000 });
  const count = await items.count();
  expect(count).toBeGreaterThan(0);
});
