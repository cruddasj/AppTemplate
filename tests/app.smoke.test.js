describe('app bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main></main>';
  });

  test('loads app script and handles DOMContentLoaded without crashing', () => {
    expect(() => {
      require('../assets/js/app.js');
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }).not.toThrow();
  });
});
