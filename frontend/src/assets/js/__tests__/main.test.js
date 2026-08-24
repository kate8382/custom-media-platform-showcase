import { describe, it, expect } from 'vitest';

describe('App showSection', () => {
  it('shows target section and hides others', async () => {
    document.body.innerHTML = `
      <header id="header">Header</header>
      <main>
        <section id="hero">Hero</section>
        <section id="about" hidden>About</section>
        <section id="playlist" hidden>Playlist</section>
      </main>
    `;

    // Import App dynamically to avoid interfering with module hoisting in other tests
    const { default: App } = await import('../main.js');
    const app = new App();
    // ensure initial state matches markup
    expect(document.getElementById('hero').hidden).toBe(false);
    expect(document.getElementById('about').hidden).toBe(true);

    app.showSection('about');

    // wait for requestAnimationFrame shim to run and update classes
    await new Promise((r) => setTimeout(r, 20));

    const hero = document.getElementById('hero');
    const about = document.getElementById('about');

    expect(hero.hidden).toBe(true);
    expect(hero.style.display).toBe('none');

    expect(about.hidden).toBe(false);
    expect(about.style.display).toBe('');
    // after animation starts, the is-hidden class should be removed
    expect(about.classList.contains('is-hidden')).toBe(false);
  });
});

describe('App playlist caching (mocked)', () => {
  it('creates one Playlist instance and reuses it on subsequent shows', async () => {
    document.body.innerHTML = `
      <header id="header"></header>
      <main>
        <section id="hero"></section>
        <section id="playlist"><ul id="playList"></ul></section>
      </main>
    `;

    const { default: AppClass } = await import('../main.js');

    const app = new AppClass();
    app.showSection('playlist');
    const firstInstance = app.playlist;
    expect(firstInstance).toBeTruthy();

    // show again — should reuse same instance
    app.showSection('playlist');
    expect(app.playlist).toBe(firstInstance);
  });
});
