import type { SortDirection } from '../sorting/types';
import type { Playlist, PrivacyStatus } from '../youtube/types';

export type SortKey = 'title' | 'itemCount' | 'privacy' | 'publishedAt';
export type SortState = { key: SortKey; direction: SortDirection };

// Wartość opcji w liście wyboru sortowania
export type SortOption = `${SortKey}-${SortDirection}`;

export const DEFAULT_SORT: SortState = {
  key: 'publishedAt',
  direction: 'desc',
};

const PRIVACY_RANK: Record<PrivacyStatus, number> = {
  public: 0,
  unlisted: 1,
  private: 2,
};

const COMPARATORS: Record<SortKey, (a: Playlist, b: Playlist) => number> = {
  title: (a, b) =>
    a.title.localeCompare(b.title, 'pl', { sensitivity: 'base' }),
  itemCount: (a, b) => a.itemCount - b.itemCount,
  privacy: (a, b) =>
    PRIVACY_RANK[a.privacyStatus] - PRIVACY_RANK[b.privacyStatus],
  publishedAt: (a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt),
};

// Klucze, które po pierwszym kliknięciu sortują rosnąco; reszta zaczyna od największych wartości
const ASCENDING_FIRST: readonly SortKey[] = ['title', 'privacy'];

// Kolejność w liście wyboru: w każdej parze najpierw kierunek, od którego zaczyna kliknięcie w nagłówek
export const SORT_OPTIONS: readonly SortState[] = [
  { key: 'title', direction: 'asc' },
  { key: 'title', direction: 'desc' },
  { key: 'itemCount', direction: 'desc' },
  { key: 'itemCount', direction: 'asc' },
  { key: 'privacy', direction: 'asc' },
  { key: 'privacy', direction: 'desc' },
  { key: 'publishedAt', direction: 'desc' },
  { key: 'publishedAt', direction: 'asc' },
];

export function sortOptionId(sort: SortState): SortOption {
  return `${sort.key}-${sort.direction}`;
}

export function sortPlaylists(
  playlists: readonly Playlist[],
  sort: SortState,
): Playlist[] {
  const compare = COMPARATORS[sort.key];
  const sign = sort.direction === 'asc' ? 1 : -1;
  // Remisy zawsze po id rosnąco, niezależnie od kierunku
  return [...playlists].sort(
    (a, b) => sign * compare(a, b) || a.id.localeCompare(b.id),
  );
}

export function nextSort(current: SortState, key: SortKey): SortState {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: ASCENDING_FIRST.includes(key) ? 'asc' : 'desc' };
}
