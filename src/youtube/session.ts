import {
  addPlaylistItem,
  deletePlaylist,
  getMyChannel,
  listMyPlaylists,
  listPlaylistVideos,
  listVideoDurations,
  movePlaylistItem,
  removePlaylistItem,
  updatePlaylist,
  type ListVideosOptions,
  type PlaylistChanges,
} from './api';
import {
  ApiError,
  type Channel,
  type Playlist,
  type PlaylistVideo,
} from './types';

// Zalogowana sesja YouTube: zna token i sama zgłasza jego wygaśnięcie
export type YouTubeSession = {
  listMyPlaylists: () => Promise<Playlist[]>;
  updatePlaylist: (
    playlist: Playlist,
    changes: PlaylistChanges,
  ) => Promise<Playlist>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  listPlaylistVideos: (
    playlistId: string,
    options?: ListVideosOptions,
  ) => Promise<PlaylistVideo[]>;
  listVideoDurations: (
    videoIds: readonly string[],
  ) => Promise<Map<string, number>>;
  addPlaylistItem: (
    playlistId: string,
    videoId: string,
  ) => Promise<PlaylistVideo>;
  movePlaylistItem: (
    playlistId: string,
    video: PlaylistVideo,
    newPosition: number,
  ) => Promise<void>;
  removePlaylistItem: (itemId: string) => Promise<void>;
  getMyChannel: () => Promise<Channel | null>;
};

export function createYouTubeSession(
  token: string,
  onUnauthorized: () => void,
): YouTubeSession {
  let expired = false;

  // Kilka równoległych 401 ma wylogować tylko raz; błąd i tak wraca do wywołującego
  async function guard<Result>(call: Promise<Result>): Promise<Result> {
    try {
      return await call;
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.kind === 'unauthorized' &&
        !expired
      ) {
        expired = true;
        onUnauthorized();
      }
      throw error;
    }
  }

  return {
    listMyPlaylists: () => guard(listMyPlaylists(token)),
    updatePlaylist: (playlist, changes) =>
      guard(updatePlaylist(token, playlist, changes)),
    deletePlaylist: (playlistId) => guard(deletePlaylist(token, playlistId)),
    listPlaylistVideos: (playlistId, options) =>
      guard(listPlaylistVideos(token, playlistId, options)),
    listVideoDurations: (videoIds) =>
      guard(listVideoDurations(token, videoIds)),
    addPlaylistItem: (playlistId, videoId) =>
      guard(addPlaylistItem(token, playlistId, videoId)),
    movePlaylistItem: (playlistId, video, newPosition) =>
      guard(movePlaylistItem(token, playlistId, video, newPosition)),
    removePlaylistItem: (itemId) => guard(removePlaylistItem(token, itemId)),
    getMyChannel: () => guard(getMyChannel(token)),
  };
}
