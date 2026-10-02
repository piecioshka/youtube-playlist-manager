import type { Playlist, PlaylistVideo } from '../youtube/types';
import { matchesQuery } from './normalize';

export type SearchResult = {
  playlist: Playlist;
  matchingVideos: PlaylistVideo[];
};

// Playlista zostaje, gdy pasuje jej tytuł albo choć jeden zindeksowany film (tytuł lub kanał)
export function searchPlaylists(
  playlists: readonly Playlist[],
  normalizedQuery: string,
  videosByPlaylist: ReadonlyMap<string, PlaylistVideo[]>,
): SearchResult[] {
  const results: SearchResult[] = [];
  for (const playlist of playlists) {
    const matchingVideos = (videosByPlaylist.get(playlist.id) ?? []).filter(
      (video) =>
        matchesQuery(video.title, normalizedQuery) ||
        matchesQuery(video.channelTitle, normalizedQuery),
    );
    if (
      matchingVideos.length > 0 ||
      matchesQuery(playlist.title, normalizedQuery)
    ) {
      results.push({ playlist, matchingVideos });
    }
  }
  return results;
}
