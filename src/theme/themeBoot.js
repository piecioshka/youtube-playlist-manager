// Theme before the first paint, so the wrong one does not flash before React starts.
// Injected inline into every HTML page by vite-plugin-theme-boot.ts.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem('youtube-playlist-manager.theme');
  } catch {
    // Blocked storage: the theme follows the system
  }
  var light =
    stored === 'light' ||
    (stored !== 'dark' &&
      window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  // Background colors from app.css, the same as in src/theme/theme.ts
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute('content', light ? '#f7f7f8' : '#121214');
})();
