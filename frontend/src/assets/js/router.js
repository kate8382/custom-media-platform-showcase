// Simple client-side Router class with hash-routing fallback.
// Usage: import Router from './router.js';
// const router = new Router(routes, { useHash: true }); router.init();

export default class Router {
  constructor(routes = {}, options = {}) {
    this.routes = routes;
    this.useHash = options.useHash !== undefined ? options.useHash : true;
    this.root = options.root || '/';
    this._onLinkClick = this._onLinkClick.bind(this);
    this._onPopState = this._onPopState.bind(this);
  }

  // Initialize the router: set up event listeners and route to the initial path
  init() {
    document.addEventListener('click', this._onLinkClick);
    if (this.useHash) {
      window.addEventListener('hashchange', this._onPopState);
    } else {
      window.addEventListener('popstate', this._onPopState);
    }
    // Route to initial path and normalize history state so back/forward behaves
    // predictably. We replace the initial entry with a state object containing
    // the current path, then future navigations push a `{ path }` state.
    const initialPath = this._getPath();
    this._routeTo(initialPath);
    try {
      history.replaceState({ path: initialPath }, '', window.location.href);
      // eslint-disable-next-line no-unused-vars, prettier/prettier
    } catch (err) { }
  }

  // Clean up event listeners when the router is no longer needed
  destroy() {
    document.removeEventListener('click', this._onLinkClick);
    if (this.useHash) window.removeEventListener('hashchange', this._onPopState);
    else window.removeEventListener('popstate', this._onPopState);
  }

  // Programmatically navigate to a path
  navigate(path) {
    if (!path) path = '/';
    if (this.useHash) {
      const hash = path.startsWith('#')
        ? path
        : '#' + (path.startsWith('/') ? path.slice(1) : path);
      // Use pushState to update URL without causing native anchor jump
      try {
        history.pushState({ path: path }, '', hash);
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        // fallback to location.hash if pushState is not available
        window.location.hash = hash;
      }
      // Immediately route to new path
      try {
        this._routeTo(this._getPath());
      } catch (err) {
        console.error('[router] navigate error', err);
      }
    } else {
      if (!path.startsWith('/')) path = '/' + path;
      history.pushState({ path: path }, '', path);
      this._routeTo(this._getPath());
    }
  }

  // Get the current path from the URL, depending on routing mode
  _getPath() {
    if (this.useHash) {
      const h = window.location.hash || '#/';
      let p = h.startsWith('#') ? h.slice(1) : h;
      if (p === '' || p === '/') return '/';
      if (!p.startsWith('/')) p = '/' + p;
      return p;
    }
    const p = window.location.pathname || '/';
    return p;
  }

  // Route to the given path: call the handler and update active links
  _routeTo(path) {
    console.log('[router] route to', path);
    const handler = this.routes[path] || this.routes['/'] || this.routes['/404'];
    if (typeof handler === 'function') {
      try {
        handler(path);
      } catch (err) {
        console.error('[router] handler error', err);
      }
    } else {
      console.warn('[router] no handler for', path);
    }
    this._updateActiveLink(path);
  }

  // Handle click events on links: intercept internal links and navigate without full page reload
  _onLinkClick(e) {
    const anchor = e.target.closest && e.target.closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    // ignore external links and anchors that open new tabs
    if (href.startsWith('http') || href.startsWith('mailto:') || anchor.target === '_blank') return;

    // internal link — intercept
    if (this.useHash) {
      // allow normal anchor behaviour if it's only a fragment on the same page
      e.preventDefault();
      let path = href;
      if (href.startsWith('#')) path = href.slice(1) || '/';
      this.navigate(path);
    } else {
      // history mode
      e.preventDefault();
      let path = href.startsWith('#') ? href.slice(1) : href;
      if (!path.startsWith('/')) path = '/' + path;
      this.navigate(path);
    }
  }

  // Handle back/forward navigation
  _onPopState(e) {
    // Prefer path stored in history.state if present — this avoids relying on
    // URL parsing alone and prevents a double-back situation where a popstate
    // is emitted but the URL hasn't been normalized yet.
    const statePath = e && e.state && e.state.path;
    if (statePath) return this._routeTo(statePath);
    return this._routeTo(this._getPath());
  }

  // Update the active link based on the current path
  _updateActiveLink(path) {
    const links = document.querySelectorAll('.header__nav-link');
    links.forEach((link) => {
      const href = link.getAttribute('href') || '';
      let linkPath = href;
      if (this.useHash) {
        if (href.startsWith('#')) linkPath = href.slice(1) || '/';
      }
      // normalize
      if (!linkPath.startsWith('/'))
        linkPath = linkPath.startsWith('/') ? linkPath : '/' + linkPath.replace(/^#/, '');
      const normPath = path.startsWith('/') ? path : '/' + path.replace(/^#/, '');
      // treat '/' and '/home' as equivalent so the Home link becomes active on default load
      const equivalent =
        linkPath === normPath ||
        (normPath === '/' && linkPath === '/home') ||
        (normPath === '/home' && linkPath === '/');
      if (equivalent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }
}
