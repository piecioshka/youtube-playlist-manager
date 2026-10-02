import { vi, type Mock } from 'vitest';
import type { YouTubeSession } from '../youtube/session';

export type FakeYouTube = {
  [Key in keyof YouTubeSession]: Mock<YouTubeSession[Key]>;
};

// Atrapa sesji YouTube: każda metoda to vi.fn(), a test sam ustala odpowiedzi
export function makeFakeYouTube(): FakeYouTube {
  return {
    listMyPlaylists: vi.fn<YouTubeSession['listMyPlaylists']>(),
    updatePlaylist: vi.fn<YouTubeSession['updatePlaylist']>(),
    deletePlaylist: vi.fn<YouTubeSession['deletePlaylist']>(),
    listPlaylistVideos: vi.fn<YouTubeSession['listPlaylistVideos']>(),
    addPlaylistItem: vi.fn<YouTubeSession['addPlaylistItem']>(),
    movePlaylistItem: vi.fn<YouTubeSession['movePlaylistItem']>(),
    removePlaylistItem: vi.fn<YouTubeSession['removePlaylistItem']>(),
    getMyChannel: vi.fn<YouTubeSession['getMyChannel']>(),
  };
}
