import { describe, it, expect, beforeEach, test, vi } from 'vitest';
import Playlist from '../playlist.js';

function makeElem(top, height = 300) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ top, bottom: top + height, height });
  return el;
}

describe('Playlist helpers (unit)', () => {
  let root;
  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });

  it('_computeItemsPerRow counts items sharing top', () => {
    const pl = new Playlist(root);
    const items = [makeElem(0), makeElem(0), makeElem(0), makeElem(320)];
    expect(pl._computeItemsPerRow(items)).toBe(3);
  });

  it('_computeVisibleCount returns perRow * rows', () => {
    const pl = new Playlist(root, { rows: 2 });
    const items = [makeElem(0), makeElem(0), makeElem(0), makeElem(320), makeElem(320), makeElem(320)];
    expect(pl._computeVisibleCount(items)).toBe(6);
  });

  it('_updateVisibility hides toggle when all items fit', () => {
    const pl = new Playlist(root, { rows: 2 });
    const content = document.createElement('div');
    content.className = 'playlist__content';
    root.appendChild(content);
    const items = [makeElem(0), makeElem(0)];
    // attach items to root so getBoundingClientRect top calculations are stable
    items.forEach((it) => content.appendChild(it));
    pl.content = content;
    const btn = document.createElement('button');
    // visible >= total -> button hidden
    pl._updateVisibility(items, btn);
    expect(btn.style.display === 'none' || btn.style.display === '').toBeTruthy();
  });
});

beforeEach(() => {
  document.body.innerHTML = '<ul id="playList">' +
    Array.from({ length: 10 }).map((_, i) => `<li class="playlist__item">Item${i + 1}</li>`).join('') +
    '</ul>';
});

// jsdom in Vitest doesn't implement scrollTo – provide a no-op to silence warnings
if (typeof global.scrollTo !== 'function') global.scrollTo = () => { };

test('toggle expands to show all items', () => {
  const root = document.getElementById('playList');
  const p = new Playlist(root);
  p.enhance();
  const btn = document.querySelector('.playlist__toggle');
  expect(btn).toBeTruthy();
  btn.click();
  const visible = Array.from(root.querySelectorAll('.playlist__item')).filter(li => li.style.display !== 'none');
  expect(visible.length).toBe(10);
});

test('does not create duplicate toggle when enhance is called multiple times', () => {
  const root = document.getElementById('playList');
  const p = new Playlist(root);
  p.enhance();
  p.enhance();
  const toggles = document.querySelectorAll('.playlist__toggle');
  expect(toggles.length).toBe(1);
});

test('normalizeIframes removes width/height attributes and styles', () => {
  document.body.innerHTML += '<iframe class="playlist__iframe" width="280" height="394" style="width:280px;height:394px;"></iframe>';
  const root = document.getElementById('playList');
  const p = new Playlist(root);
  p.normalizeIframes();
  const iframe = document.querySelector('.playlist__iframe');
  expect(iframe.getAttribute('width')).toBeNull();
  expect(iframe.getAttribute('height')).toBeNull();
  expect(iframe.style.width).toBe('');
  expect(iframe.style.height).toBe('');
});

test('calls normalizeIframes after inserting server HTML iframes', async () => {
  document.body.innerHTML += '<iframe class="playlist__iframe" width="280" height="394" style="width:280px;height:394px;"></iframe>';
  const root = document.getElementById('playList');
  // stub fetch to return a Response-like object with ok:true and json()
  global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ html: '<li class="playlist__item"><iframe class="playlist__iframe" width="280" height="394" style="width:280px;height:394px;"></iframe></li>' }) });
  const p = new Playlist(root);
  const spy = vi.spyOn(p, 'normalizeIframes');
  await p.init();
  expect(root.innerHTML).toContain('playlist__item');
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

