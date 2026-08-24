import { describe, it, expect, beforeEach, vi } from 'vitest';
import Router from '../router.js';

beforeEach(() => {
  // reset DOM and location between tests
  document.body.innerHTML = '';
  history.replaceState({}, '', '/');
  window.location.hash = '';
});

describe('Router basic behaviours', () => {
  it('._getPath() reads hash path when useHash=true', () => {
    window.location.hash = '#/about';
    const r = new Router({}, { useHash: true });
    expect(r._getPath()).toBe('/about');
  });

  it('._getPath() returns root for empty hash', () => {
    window.location.hash = '';
    const r = new Router({}, { useHash: true });
    expect(r._getPath()).toBe('/');
  });

  it('._updateActiveLink sets aria-current on matching links (hash mode)', () => {
    document.body.innerHTML = `
      <nav>
        <a class="header__nav-link" href="#/about">About</a>
        <a class="header__nav-link" href="#/playlist">Playlist</a>
      </nav>
    `;
    const r = new Router({}, { useHash: true });
    r._updateActiveLink('/about');
    const a = document.querySelector('a[href="#/about"]');
    expect(a.getAttribute('aria-current')).toBe('page');
    const b = document.querySelector('a[href="#/playlist"]');
    expect(b.hasAttribute('aria-current')).toBe(false);
  });

  it('navigate() calls the route handler (history mode)', () => {
    const aboutHandler = vi.fn();
    const routes = { '/about': aboutHandler };
    const r = new Router(routes, { useHash: false });

    r.navigate('/about');

    expect(aboutHandler).toHaveBeenCalled();
  });

  it('_routeTo() calls correct handler even when route missing', () => {
    const rootHandler = vi.fn();
    const routes = { '/': rootHandler };
    const r = new Router(routes, { useHash: false });

    r._routeTo('/non-existent');
    expect(rootHandler).toHaveBeenCalled();
  });

  it('popstate uses history.state.path and navigates back once', () => {
    const handlers = { '/': vi.fn(), '/a': vi.fn(), '/b': vi.fn() };
    const r = new Router(handlers, { useHash: false });
    r.init();

    // programmatic navigation should push states with { path }
    r.navigate('/a');
    r.navigate('/b');

    // Simulate a back navigation: popstate with state.path = '/a'
    const pop = new PopStateEvent('popstate', { state: { path: '/a' } });
    window.dispatchEvent(pop);
    expect(handlers['/a']).toHaveBeenCalled();

    // Another back to root
    const pop2 = new PopStateEvent('popstate', { state: { path: '/' } });
    window.dispatchEvent(pop2);
    expect(handlers['/']).toHaveBeenCalled();

    r.destroy();
  });
});
