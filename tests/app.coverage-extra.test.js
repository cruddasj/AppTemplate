describe('app coverage additions', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.className = '';
    document.body.className = '';
    document.body.innerHTML = `
      <input id="themeToggle" type="checkbox">
      <select id="themeSelect">
        <option value="default">default</option>
        <option value="inverted">inverted</option>
        <option value="glass">glass</option>
      </select>
      <input id="mobileNavStickyToggle" type="checkbox">
      <input id="welcomeToggle" type="checkbox">
      <button id="brandHome" type="button"></button>
      <button id="menu-toggle" type="button"></button>
      <button id="clearDataButton" type="button" data-action="clear-data">Clear</button>
      <button id="goSettingsButton" type="button" data-action="go-settings">Go settings</button>
      <aside id="sidebar" class="-translate-x-full">
        <button class="nav-btn" data-target="welcome"></button>
        <button class="nav-btn" data-target="settings"></button>
      </aside>
      <div id="overlay" class="hidden"></div>
      <main>
        <section id="welcome" class="content-section active" data-first-time></section>
        <section id="settings" class="content-section"></section>
        <section
          class="card is-collapsible"
          data-collapsible
          data-collapsible-id="example-card"
        >
          <button data-collapsible-trigger aria-controls="example-content" aria-expanded="true"></button>
          <div id="example-content" data-collapsible-content>body</div>
        </section>
      </main>
      <div id="modal" class="modal-hidden" aria-hidden="true">
        <div id="modal-body"></div>
      </div>
      <section id="changelogCard">
        <div data-changelog-list></div>
        <p data-changelog-empty class="hidden"></p>
        <p data-changelog-error class="hidden"></p>
      </section>
      <span data-app-version></span>
    `;

    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('changelog')) {
        return { ok: true, json: async () => [] };
      }
      if (String(url).includes('version')) {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: false, json: async () => ({}) };
    });

    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: jest.fn(async () => null),
        ready: Promise.resolve(null),
        register: jest.fn(async () => ({ unregister: jest.fn() })),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('falls back invalid stored theme choice to default', async () => {
    localStorage.setItem('themeChoice', 'mystery');

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById('themeSelect').value).toBe('default');
    expect(document.documentElement.classList.contains('theme-inverted')).toBe(false);
    expect(document.documentElement.classList.contains('theme-glass')).toBe(false);
  });

  test('prunes stale collapsible ids and persists toggle state after click', () => {
    localStorage.setItem('collapsedCards', JSON.stringify({ stale: true }));

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const trigger = document.querySelector('[data-collapsible-trigger]');
    trigger.click();

    const collapsedState = JSON.parse(localStorage.getItem('collapsedCards'));
    expect(collapsedState).not.toHaveProperty('stale');
    expect(collapsedState).toHaveProperty('example-card');
  });

  test('handles go-settings action by navigating to settings view', () => {
    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    document.getElementById('goSettingsButton').click();

    expect(document.getElementById('settings').classList.contains('active')).toBe(true);
    expect(localStorage.getItem('activeView')).toBe('settings');
  });

  test('uses window.confirm fallback when confirmation modal is unavailable', async () => {
    document.getElementById('modal').remove();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    document.getElementById('clearDataButton').click();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(confirmSpy).toHaveBeenCalledWith('This will erase all locally stored data. Continue?');
  });

  test('shows empty changelog state and keeps default version label when payload is incomplete', async () => {
    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-changelog-empty]').classList.contains('hidden')).toBe(false);
    expect(document.querySelector('[data-app-version]').textContent).toBe('0.0.0');
  });
});
