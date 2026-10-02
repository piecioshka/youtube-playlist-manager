import type { Playlist } from '../youtube/types';

export type SortMode = 'newest' | 'alpha';

export const SORT_MODES: readonly SortMode[] = ['newest', 'alpha'];

function byId(a: Playlist, b: Playlist): number {
  return a.id.localeCompare(b.id);
}

function byTitle(a: Playlist, b: Playlist): number {
  return (
    a.title.localeCompare(b.title, 'pl', { sensitivity: 'base' }) || byId(a, b)
  );
}

function byNewest(a: Playlist, b: Playlist): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || byId(a, b);
}

export function sortPlaylists(
  playlists: readonly Playlist[],
  mode: SortMode,
): Playlist[] {
  return [...playlists].sort(mode === 'alpha' ? byTitle : byNewest);
}
