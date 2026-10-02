import type { Playlist, PrivacyStatus } from '../youtube/types';

export type VisibilityFilter = 'all' | PrivacyStatus;

export function filterByVisibility(
  playlists: readonly Playlist[],
  filter: VisibilityFilter,
): Playlist[] {
  return filter === 'all'
    ? [...playlists]
    : playlists.filter((playlist) => playlist.privacyStatus === filter);
}

export function countByVisibility(
  playlists: readonly Playlist[],
): Record<VisibilityFilter, number> {
  const counts: Record<VisibilityFilter, number> = {
    all: playlists.length,
    public: 0,
    unlisted: 0,
    private: 0,
  };
  for (const playlist of playlists) {
    counts[playlist.privacyStatus] += 1;
  }
  return counts;
}
