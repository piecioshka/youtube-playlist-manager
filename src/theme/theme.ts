import { z } from 'zod';

export type Theme = 'light' | 'dark';

export const DEFAULT_THEME: Theme = 'dark';

// Ten sam klucz czyta skrypt w index.html, zanim React się zamontuje
const STORAGE_KEY = 'youtube-playlist-manager.theme';

const themeSchema = z.enum(['light', 'dark']);

export function readTheme(): Theme {
  try {
    const parsed = themeSchema.safeParse(localStorage.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Brak dostępu do localStorage (tryb prywatny, blokada) - wybór działa do przeładowania
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
