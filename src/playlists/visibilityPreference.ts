import { z } from 'zod';
import type { VisibilityFilter } from './filterPlaylists';

const STORAGE_KEY = 'youtube-playlist-manager.visibility';

const filterSchema = z.enum(['all', 'public', 'unlisted', 'private']);

export function readVisibilityFilter(): VisibilityFilter {
  try {
    const parsed = filterSchema.safeParse(localStorage.getItem(STORAGE_KEY));
    return parsed.success ? parsed.data : 'all';
  } catch {
    return 'all';
  }
}

export function writeVisibilityFilter(filter: VisibilityFilter): void {
  try {
    localStorage.setItem(STORAGE_KEY, filter);
  } catch {
    // Brak dostępu do localStorage (tryb prywatny, blokada) - wybór działa do przeładowania
  }
}
