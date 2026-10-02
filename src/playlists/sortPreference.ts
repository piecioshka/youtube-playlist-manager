import { SORT_MODES, type SortMode } from './sortPlaylists';

const STORAGE_KEY = 'youtube-playlist-manager.sort';
const DEFAULT_SORT_MODE: SortMode = 'newest';

function isSortMode(value: unknown): value is SortMode {
  return SORT_MODES.some((mode) => mode === value);
}

export function readSortMode(): SortMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSortMode(stored) ? stored : DEFAULT_SORT_MODE;
  } catch {
    return DEFAULT_SORT_MODE;
  }
}

export function writeSortMode(mode: SortMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Brak dostępu do localStorage (tryb prywatny, blokada) - wybór działa do przeładowania
  }
}
