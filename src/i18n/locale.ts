import { z } from 'zod';
import { DEFAULT_LOCALE, type Locale } from './messages';

const STORAGE_KEY = 'youtube-playlist-manager.locale';

const localeSchema = z.enum(['pl', 'en']);

export function readLocale(): Locale {
  try {
    const parsed = localeSchema.safeParse(localStorage.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function writeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Brak dostępu do localStorage (tryb prywatny, blokada) - wybór działa do przeładowania
  }
}
