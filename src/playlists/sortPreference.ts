import { z } from 'zod';
import { DEFAULT_SORT, type SortState } from './sortPlaylists';

const STORAGE_KEY = 'youtube-playlist-manager.sort';

const sortSchema = z.object({
  key: z.enum(['title', 'itemCount', 'privacy', 'publishedAt']),
  direction: z.enum(['asc', 'desc']),
});

// Wartości zapisane przez poprzednią wersję (przełącznik radio)
const LEGACY_SORTS = new Map<string, SortState>([
  ['newest', { key: 'publishedAt', direction: 'desc' }],
  ['alpha', { key: 'title', direction: 'asc' }],
]);

function parseSort(stored: string): SortState {
  const legacy = LEGACY_SORTS.get(stored);
  if (legacy) {
    return legacy;
  }
  try {
    const parsed = sortSchema.safeParse(JSON.parse(stored));
    return parsed.success ? parsed.data : DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
}

export function readSort(): SortState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? DEFAULT_SORT : parseSort(stored);
  } catch {
    return DEFAULT_SORT;
  }
}

export function writeSort(sort: SortState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sort));
  } catch {
    // Brak dostępu do localStorage (tryb prywatny, blokada) - wybór działa do przeładowania
  }
}
