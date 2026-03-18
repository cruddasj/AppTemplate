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
      <button id="updateButton" type="button" data-action="update-app">Check updates</button>
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
        <button type="button" data-action="close-modal" class="hidden">X</button>
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

  test('uses alert fallback when update check cannot resolve a registration', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    document.getElementById('modal').remove();
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: jest.fn(async () => null),
        ready: Promise.reject(new Error('offline')),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        register: jest.fn(async () => ({ unregister: jest.fn() })),
      },
    });

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.getElementById('updateButton').click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining("couldn't reach the update service"),
    );
  });

  test('handles malformed changelog/version responses and close-modal action', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('changelog')) {
        return { ok: true, json: async () => [{ version: null, date: 'not-a-date', changes: ['x'] }] };
      }
      if (String(url).includes('version')) {
        return { ok: true, json: async () => ({ version: 123 }) };
      }
      return { ok: false, json: async () => ({}) };
    });

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-changelog-list]').textContent).toContain('Version null');
    expect(document.querySelector('[data-app-version]').textContent).toBe('0.0.0');

    document.getElementById('updateButton').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.querySelector('[data-action="close-modal"]').click();
    expect(document.getElementById('modal').classList.contains('modal-hidden')).toBe(true);
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unable to load changelog'));
  });

  test('falls back safely when collapsed card state in storage is invalid JSON', () => {
    localStorage.setItem('collapsedCards', '{invalid json');

    expect(() => {
      require('../assets/js/app.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }).not.toThrow();

    const card = document.querySelector('[data-collapsible-id="example-card"]');
    expect(card.classList.contains('collapsed')).toBe(false);
  });

  test('keeps sidebar closed for unknown nav target and leaves clear-data cancellable', () => {
    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    document.querySelector('#sidebar .nav-btn').dataset.target = 'missing';
    document.querySelector('#sidebar .nav-btn').click();
    expect(document.getElementById('welcome').classList.contains('active')).toBe(true);

    document.getElementById('clearDataButton').click();
    const cancelButton = Array.from(document.querySelectorAll('#modal button')).find(
      (button) => button.textContent === 'Cancel',
    );
    cancelButton.click();
    expect(document.getElementById('modal').classList.contains('modal-hidden')).toBe(true);
  });

  test('closes modal from overlay click and escape key while preserving stored welcome fallback', async () => {
    localStorage.setItem('activeView', 'welcome');
    localStorage.setItem('welcomeDisabled', '1');

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(document.getElementById('settings').classList.contains('active')).toBe(true);
    document.getElementById('updateButton').click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.getElementById('modal').classList.contains('modal-hidden')).toBe(false);

    document.getElementById('modal').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('modal').classList.contains('modal-hidden')).toBe(true);

    document.getElementById('updateButton').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('modal').classList.contains('modal-hidden')).toBe(true);
  });

  test('navigates with brand home according to welcome visibility preference', () => {
    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    document.getElementById('goSettingsButton').click();
    expect(document.getElementById('settings').classList.contains('active')).toBe(true);

    document.getElementById('brandHome').click();
    expect(document.getElementById('welcome').classList.contains('active')).toBe(true);

    document.getElementById('welcomeToggle').checked = false;
    document.getElementById('welcomeToggle').dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('brandHome').click();
    expect(document.getElementById('settings').classList.contains('active')).toBe(true);
  });

  test('ignores unsupported actions and survives storage read failures', () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    const unknownAction = document.createElement('button');
    unknownAction.dataset.action = 'do-nothing';
    document.body.appendChild(unknownAction);
    unknownAction.click();

    expect(document.getElementById('welcome').classList.contains('active')).toBe(true);
    expect(getItemSpy).toHaveBeenCalled();
  });

  test('dismisses confirmation modal with Escape and unhides dedicated close button', () => {
    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    document.getElementById('clearDataButton').click();
    expect(document.querySelector('#modal [data-action="close-modal"]').classList.contains('hidden')).toBe(
      false,
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.getElementById('modal').classList.contains('modal-hidden')).toBe(true);
  });

  test('handles failed changelog and version fetches gracefully', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    });

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-changelog-error]').classList.contains('hidden')).toBe(false);
    expect(document.querySelector('[data-app-version]').textContent).toBe('0.0.0');
    expect(errorSpy).toHaveBeenCalled();
  });

  test('sorts changelog versions using numeric comparison', async () => {
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('changelog')) {
        return {
          ok: true,
          json: async () => [
            { version: '1.2.0', date: '2026-01-01', changes: [] },
            { version: '1.10.0', date: '2026-01-02', changes: [] },
          ],
        };
      }
      return { ok: true, json: async () => ({ version: '1.10.0' }) };
    });

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const headings = Array.from(document.querySelectorAll('[data-changelog-list] p'));
    expect(headings[0].textContent).toContain('1.10.0');
  });

  test('runs confirmed clear-data flow without crashing test environment', async () => {
    window.location.reload = jest.fn();
    localStorage.setItem('themeChoice', 'glass');
    sessionStorage.setItem('scratch', '1');

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    document.getElementById('clearDataButton').click();
    const confirmButton = Array.from(document.querySelectorAll('#modal button')).find(
      (button) => button.textContent === 'Confirm',
    );
    confirmButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(localStorage.getItem('themeChoice')).toBeNull();
    expect(sessionStorage.getItem('scratch')).toBeNull();
  });

  test('swallows storage clear failures during confirmed reset flow', async () => {
    window.location.reload = jest.fn();
    const clearSpy = jest.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
      throw new Error('quota blocked');
    });

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));

    document.getElementById('clearDataButton').click();
    const confirmButton = Array.from(document.querySelectorAll('#modal button')).find(
      (button) => button.textContent === 'Confirm',
    );
    confirmButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clearSpy).toHaveBeenCalled();
  });

  test('falls back when refocusing update button throws', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: jest.fn(async () => null),
        ready: Promise.resolve(null),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        register: jest.fn(async () => ({ unregister: jest.fn() })),
      },
    });

    require('../assets/js/app.js');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const updateButton = document.getElementById('updateButton');
    updateButton.focus = jest.fn(() => {
      throw new Error('focus blocked');
    });

    updateButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updateButton.focus).toHaveBeenCalled();
  });
});
