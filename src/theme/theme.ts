import { z } from 'zod';

export type Theme = 'light' | 'dark';

// `system` idzie za ustawieniem systemu, pozostałe wartości je nadpisują
export type ThemePreference = Theme | 'system';

export const DEFAULT_PREFERENCE: ThemePreference = 'system';

// src/theme/themeBoot.js reads the same key before React mounts
const STORAGE_KEY = 'youtube-playlist-manager.theme';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

// Page background from app.css (`--color-bg`); src/theme/themeBoot.js has the same values
const CHROME_COLORS: Record<Theme, string> = {
  light: '#f7f7f8',
  dark: '#121214',
};

const preferenceSchema = z.enum(['system', 'light', 'dark']);

export function readPreference(): ThemePreference {
  try {
    const parsed = preferenceSchema.safeParse(
      localStorage.getItem(STORAGE_KEY),
    );
    return parsed.success ? parsed.data : DEFAULT_PREFERENCE;
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function writePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Brak dostępu do localStorage (tryb prywatny, blokada) - wybór działa do przeładowania
  }
}

function lightQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia(LIGHT_QUERY)
    : null;
}

// Ciemny, gdy system nie prosi o jasny albo przeglądarka nie umie tego powiedzieć
export function resolveTheme(preference: ThemePreference): Theme {
  if (preference !== 'system') {
    return preference;
  }
  return lightQuery()?.matches ? 'light' : 'dark';
}

export function watchSystemTheme(onChange: () => void): () => void {
  const query = lightQuery();
  if (query === null) {
    return () => undefined;
  }
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', CHROME_COLORS[theme]);
}
