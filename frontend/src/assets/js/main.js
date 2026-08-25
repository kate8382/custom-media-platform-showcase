// Placeholder handler for external app button interactions
// This file is intentionally small — replace the placeholder logic
// with the real deep-linking / app-launch code when available.

import { Playlist } from './playlist.js';
import './contacts.js';
import Router from './router.js';

class App {
  constructor() {
    this.router = null;
    this.onResize = this.onResize.bind(this);
    this.playlist = null; // Store playlist instance to avoid re-initialization
  }

  // set manual scroll restoration to avoid browser auto-jump on history navigation
  static initScrollRestoration() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }

  // Update the CSS variable for header height, used for scroll offset when navigating to sections
  updateHeaderHeight() {
    const header = document.getElementById('header');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty('--header-height', headerHeight + 'px');
    return headerHeight;
  }

  // Handle window resize to update header height for scroll offset calculations
  onResize() {
    this.updateHeaderHeight();
  }

  // Bandcamp button click handler — opens URL from `data-href` (preferred) or inner <a>
  setupBandcamp() {
    const githubBtn = document.getElementById('githubBtn');
    if (!githubBtn) return;

    githubBtn.addEventListener('click', (e) => {
      // Determine the target URL from multiple possible markup variants:
      // 1) `data-href` on the control (preferred)
      // 2) if the control is an <a>, use its `href`
      // 3) otherwise, look for an inner <a> and use its href
      const url =
        githubBtn.dataset?.href ||
        githubBtn.getAttribute?.('href') ||
        githubBtn.querySelector?.('a')?.href;
      if (!url) return;
      e.preventDefault();
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
        // eslint-disable-next-line no-unused-vars
      } catch (err) {
        // fallback: navigate
        window.location.href = url;
      }
    });
  }

  // Get the current path from the URL, normalizing for hash or history mode
  setupBurger() {
    const burger = document.getElementById('headerBurger');
    const header = document.getElementById('header');
    if (!burger || !header) return;

    const toggleMenu = () => {
      const expanded = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-expanded', String(!expanded));
      header.classList.toggle('header--open');
    };

    if (window.PointerEvent) {
      burger.addEventListener('pointerup', (e) => {
        if (e.button && e.button !== 0) return;
        toggleMenu();
      });
    } else {
      burger.addEventListener('click', toggleMenu);
    }

    // Close nav when clicking outside or pressing Escape
    document.addEventListener('click', (e) => {
      if (!header.classList.contains('header--open')) return;
      if (header.contains(e.target)) return;
      burger.setAttribute('aria-expanded', 'false');
      header.classList.remove('header--open');
    });

    // Close nav on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (!header.classList.contains('header--open')) return;
        burger.setAttribute('aria-expanded', 'false');
        header.classList.remove('header--open');
      }
    });
  }

  // Navigate to a given path programmatically
  showSection(id) {
    const sections = document.querySelectorAll('main > section');
    const target = document.getElementById(id);
    if (!target) return;

    sections.forEach((s) => {
      if (s === target) {
        // show target and use CSS-only fade-in by toggling .is-hidden
        s.hidden = false;
        s.style.display = '';
        s.removeAttribute('aria-hidden');
        s.classList.add('is-hidden');
        // force reflow so removal will animate

        s.getBoundingClientRect();
        requestAnimationFrame(() => s.classList.remove('is-hidden'));

        try {
          const headerHeight = this.updateHeaderHeight();
          const rect = s.getBoundingClientRect();
          const top = Math.max(0, window.scrollY + rect.top - headerHeight);
          window.scrollTo({ top, behavior: 'smooth' });
        } catch (err) {
          console.error('[router] scroll to section error', err);
        }

        s.setAttribute('tabindex', '-1');
        try {
          s.focus({ preventScroll: true });
          // eslint-disable-next-line no-unused-vars
        } catch (e) {
          s.focus();
        }
        s.removeAttribute('tabindex');
        // initialize playlist when section becomes visible
        if (target.id === 'playlist') {
          try {
            const listEl = document.getElementById('playList');
            // If the playlist section contains a list, initialize the Playlist functionality on it.
            if (listEl) {
              if (!this.playlist) {
                this.playlist = new Playlist(listEl);
                this.playlist.init();
              } else {
                try {
                  this.playlist.enhance();
                } catch (e) {
                  console.error('[playlist] enhance error', e);
                }
              }
            }
          } catch (err) {
            console.error('[playlist] init error', err);
          }
        }
      } else {
        s.hidden = true;
        s.style.display = 'none';
        s.setAttribute('aria-hidden', 'true');
        s.classList.remove('is-hidden');
      }
    });
  }

  // Get the current path from the URL, normalizing for hash or history mode
  setupRouter() {
    const routes = {
      '/': () => this.showSection('hero'),
      '/home': () => this.showSection('hero'),
      '/about': () => this.showSection('about'),
      '/playlist': () => this.showSection('playlist'),
      '/gallery': () => this.showSection('gallery'),
      '/contacts': () => this.showSection('contacts'),
    };

    this.router = new Router(routes, { useHash: true });

    // initial visibility
    const allSections = document.querySelectorAll('main > section');
    allSections.forEach((s) => {
      if (s.id !== 'hero') {
        s.hidden = true;
        s.style.display = 'none';
        s.setAttribute('aria-hidden', 'true');
      } else {
        s.hidden = false;
        s.style.display = '';
        s.removeAttribute('aria-hidden');
      }
    });

    // Set initial header height for scroll offset calculations
    this.updateHeaderHeight();
    window.addEventListener('resize', this.onResize);

    // Initialize the router after setting up initial section visibility and header height to avoid unwanted scroll jumps on load
    this.router.init();
    window.appRouter = this.router;
  }

  // Set up click handlers for navigation links to use the router instead of default link behavior
  setupNavLinks() {
    try {
      const navLinks = document.querySelectorAll('.header__nav-link');
      navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
          const href = link.getAttribute('href') || '';
          if (
            !href ||
            href.startsWith('http') ||
            href.startsWith('mailto:') ||
            link.target === '_blank'
          )
            return;
          e.preventDefault();
          let path = href;
          if (href.startsWith('#')) path = href.slice(1);
          try {
            this.router.navigate(path);
          } catch (err) {
            console.error('[nav] navigate error', err);
          }

          const burger = document.getElementById('headerBurger');
          const header = document.getElementById('header');
          if (header && header.classList.contains('header--open')) {
            if (burger) burger.setAttribute('aria-expanded', 'false');
            header.classList.remove('header--open');
          }
        });
      });
    } catch (err) {
      console.error('[nav] integrate error', err);
    }
  }

  // (legacy) no-op — already handled in the primary setupBandcamp above
  // eslint-disable-next-line prettier/prettier
  setupBandcampLegacy() { }

  // Main init function to set up the application
  init() {
    App.initScrollRestoration();
    this.setupBandcamp();
    this.setupBurger();
    this.setupRouter();
    this.setupNavLinks();
  }
}

// Initialize app on DOMContentLoaded
document.addEventListener('DOMContentLoaded', function () {
  const app = new App();
  app.init();
});

export default App;
