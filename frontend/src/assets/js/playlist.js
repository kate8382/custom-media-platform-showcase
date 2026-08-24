const renderApiURL = import.meta.env.VITE_API_URL || "";

export class Playlist {
  constructor(root = null, options = {}) {
    this.root = root || document.getElementById('playList');
    // number of fixed rows to show when collapsed
    this.rows = options.rows || 2;
    this.toggleClass = options.toggleClass || 'playlist__toggle';
    this._expanded = false;
    this._resizeHandler = null;
  }

  // Initialize the playlist by fetching HTML from the backend and inserting it into the root element.
  init() {
    const endpointURL = `${renderApiURL}/api/bandcamp`;

    console.log("In Playlist init...");
    console.log(`Render API URL: ${renderApiURL}`);
    console.log(`Default endpoint: ${endpointURL}`)

    if (!this.root) return;
    // fetch HTML from backend and insert
    // return the fetch promise so callers/tests can await completion
    // increase retry attempts/delay to cope with slow backend startup
    return this._fetchWithRetry(endpointURL, 5, 300)
      .then((data) => {
        // Support three response shapes:
        // 1) { html: '...' } or raw string '...' (legacy)
        // 2) JSON data object with `Tracks` array (preferred)
        if (!data) {
          this.enhance(); // still attempt to enhance if static markup present
          return;
        }

        if (typeof data === 'string' || (typeof data === 'object' && typeof data.html === 'string')) {
          const html = typeof data === 'string' ? data : data.html;
          if (html) this.root.innerHTML = html;
          this.normalizeIframes();
          this.enhance();
          return;
        }

        // Prefer server-provided HTML. If structured data arrives, log and skip to avoid duplicating markup/styling.
        if (data.Tracks || data.tracks) {
          console.warn('playlist: received structured data; server should return HTML. Skipping build to avoid duplicating markup.');
          this.enhance();
          return;
        }

        // Fallback: try to insert whatever arrived
        const fallback = data.html || data;
        if (fallback) this.root.innerHTML = fallback;
        this.normalizeIframes();
        this.enhance();
      })
      .catch((err) => {
        // Log the error but continue gracefully — do not break the page
        // (network races can happen during dev when backend restarts)
        console.warn('playlist: failed to load /api/bandcamp, falling back to static markup', err && err.message ? err.message : err);
        this.normalizeIframes();
        this.enhance();
      });
  }

  // Fetch helper with retry/backoff to handle transient backend startup races
  // Robust fetch with retries and exponential backoff that returns null on persistent failure
  _fetchWithRetry(url, attempts = 3, delay = 200) {
    const doFetch = (n, wait) => fetch(url, { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) {
          const err = new Error(`Fetch failed: ${res.status}`);
          err.status = res.status;
          throw err;
        }
        // try to parse JSON safely
        return res.json().catch(() => {
          // if response isn't JSON, return raw text
          return res.text().then((t) => t);
        });
      })
      .catch((err) => {
        if (n <= 1) return Promise.reject(err);
        // small jitter to avoid stampeding
        const jitter = Math.floor(Math.random() * 80);
        return new Promise((resolve) => setTimeout(resolve, wait + jitter)).then(() => doFetch(n - 1, Math.min(wait * 2, 2000)));
      });

    // ensure the returned promise resolves to null on persistent failure
    return doFetch(attempts, delay).catch(() => null);
  }

  // Note: DOM building from structured `Tracks` has been intentionally removed to avoid duplicating server markup and SCSS.
  // The server returns ready-to-insert HTML (string) which preserves existing classes and styles.

  // Enhance an existing list (useful for tests or server-rendered markup)
  enhance() {
    if (!this.root) return;
    // Ensure any inline width/height attributes set by the server are removed
    // so CSS can fully control iframe sizing.
    this.normalizeIframes();
    const items = Array.from(this.root.querySelectorAll('.playlist__item'));
    if (!items.length) return;

    // store content container reference (may be .playlist__content or root)
    this.content = this.root.querySelector('.playlist__content') || this.root;

    // Avoid creating duplicate toggle buttons if enhance() runs multiple times
    if (this.root.nextElementSibling && this.root.nextElementSibling.classList && this.root.nextElementSibling.classList.contains(this.toggleClass)) {
      return;
    }

    // Create toggle control (but don't insert until we know it's needed)
    let btn = this.root.nextElementSibling;
    if (!(btn && btn.classList && btn.classList.contains(this.toggleClass))) {
      btn = document.createElement('button');
      btn.className = this.toggleClass;
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'See more';
      btn.addEventListener('click', () => this._toggle(items, btn));
      this.root.insertAdjacentElement('afterend', btn);
    }

    // Ensure the content container has an id so aria-controls can reference it
    if (this.content && !this.content.id) {
      this.content.id = 'playlist-content-' + Math.random().toString(36).slice(2, 9);
    }
    if (btn && this.content && this.content.id) {
      btn.setAttribute('aria-controls', this.content.id);
    }

    // Ensure we have a resize handler that recalculates visible items
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
    this._resizeHandler = this._debounce(() => this._updateVisibility(items, btn), 100);
    window.addEventListener('resize', this._resizeHandler);

    // Initial visibility (and set collapsed height CSS variable)
    this._expanded = false;
    this._updateVisibility(items, btn);

    // Re-run visibility after a short delay to account for iframe render/layout shifts
    setTimeout(() => this._updateVisibility(items, btn), 120);

    // Recompute visibility when iframe contents finish loading (helps when covers change heights)
    try {
      const iframes = Array.from(this.content.querySelectorAll('iframe'));
      iframes.forEach((f) => {
        // attach a one-time load listener
        const onload = () => {
          // eslint-disable-next-line no-unused-vars
          try { this._updateVisibility(items, btn); } catch (e) { /* ignore */ }
          f.removeEventListener('load', onload);
        };
        f.addEventListener('load', onload);
      });
      // eslint-disable-next-line no-unused-vars
    } catch (e) { /* ignore */ }
  }

  // Remove inline width/height attributes and styles from Bandcamp iframes
  // so that responsive CSS variables can take effect without needing !important.
  normalizeIframes() {
    // operate even if this.root is not inside document (tests append iframe to body)
    const insideRoot = this.root ? Array.from(this.root.querySelectorAll('iframe.playlist__iframe, iframe')) : [];
    const globalMatches = Array.from(document.querySelectorAll('iframe.playlist__iframe'));
    // merge unique frames
    const set = new Set([...insideRoot, ...globalMatches]);
    const iframes = Array.from(set);
    iframes.forEach((frame) => {
      try {
        frame.removeAttribute('width');
        frame.removeAttribute('height');
        if (frame.style) {
          frame.style.removeProperty('width');
          frame.style.removeProperty('height');
        }
        // eslint-disable-next-line no-unused-vars
      } catch (e) {
        // ignore any CORS/readonly errors and continue
      }
    });
  }

  _toggle(items, btn) {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      this._expanded = false;
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'See more';
    } else {
      // expand: show all (remove collapsed constraint)
      this._expanded = true;
      btn.setAttribute('aria-expanded', 'true');
      btn.textContent = 'See less';
    }
    // update classes / styles
    this._updateVisibility(items, btn);

    if (this._expanded) {
      // Refresh iframes that were previously clipped to ensure covers load
      const revealed = items.slice(this._computeVisibleCount(items));
      setTimeout(() => this._refreshIframes(revealed), 60);
    }
  }

  // Compute how many items fit in a single row based on current layout
  _computeItemsPerRow(items) {
    // Robust method: count how many items share the top position of the first item
    if (!items || !items.length) return 1;
    const firstTop = items[0].getBoundingClientRect().top;
    let count = 0;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (Math.abs(r.top - firstTop) <= 3) count++; else break;
    }
    return Math.max(1, count);
  }

  // Compute visible count for `rows` rows
  _computeVisibleCount(items) {
    const perRow = this._computeItemsPerRow(items) || 1;
    return perRow * (this.rows || 2);
  }

  // Update visibility of items and toggle based on computed values
  _updateVisibility(items, btn) {
    if (!items || !items.length) return;
    const total = items.length;
    const visible = this._computeVisibleCount(items);

    // compute collapsed height precisely using the bottom edge of the last
    // visible item and the top edge of the content container. This avoids
    // off-by-one/rounding issues when items have varying heights, gaps or
    // when subpixel rounding shows a fragment of the next row.
    const contentRect = this.content.getBoundingClientRect();
    const lastVisibleIndex = Math.min(visible - 1, items.length - 1);
    const lastRect = items[lastVisibleIndex].getBoundingClientRect();
    // add a small buffer to include box-shadow and avoid clipping the shadow
    const shadowBuffer = 15; // px
    const collapsedHeightPx = Math.floor(lastRect.bottom - contentRect.top) + shadowBuffer;
    if (this.content && collapsedHeightPx > 0) {
      this.content.style.setProperty('--collapsed-height', `${collapsedHeightPx}px`);
    }

    if (visible >= total) {
      // all items fit — remove collapsed constraint and hide toggle
      if (this.content) {
        this.content.classList.remove('playlist__content--collapsed');
        this.content.classList.remove('playlist__content--expanded');
      }
      if (btn && btn.parentNode) btn.style.display = 'none';
      this._expanded = false;
      return;
    }

    // not all fit
    if (btn) btn.style.display = '';
    if (!this._expanded) {
      // collapsed: apply collapsed class which uses --collapsed-height
      if (this.content) {
        this.content.classList.add('playlist__content--collapsed');
        this.content.classList.remove('playlist__content--expanded');
      }
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = 'See more';
    } else {
      // expanded: remove collapsed constraint
      if (this.content) {
        this.content.classList.remove('playlist__content--collapsed');
        this.content.classList.add('playlist__content--expanded');
      }
      btn.setAttribute('aria-expanded', 'true');
      btn.textContent = 'See less';
    }
  }

  // simple debounce util
  _debounce(fn, wait = 100) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  // Replace iframe nodes with clones to force re-render/loading of their contents.
  // Operates on an array of list items (only those just revealed).
  _refreshIframes(revealedItems = []) {
    // Clone each iframe with a tiny stagger to avoid overloading the renderer
    revealedItems.forEach((item, i) => {
      setTimeout(() => {
        try {
          const iframe = item.querySelector('iframe.playlist__iframe, iframe');
          if (!iframe) return;
          const parent = iframe.parentNode;
          if (!parent) return;
          const clone = iframe.cloneNode(true);
          // keep scroll/focus position stable by replacing in-place
          parent.replaceChild(clone, iframe);
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          // ignore any errors (e.g., if DOM changed concurrently)
        }
      }, i * 30);
    });
  }
}

// Auto-init removed: initialization should be done from `main.js` (router) to avoid double-inits

export default Playlist;
