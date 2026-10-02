import type { Playlist } from '../youtube/types';

export function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: 'PL1',
    title: 'Playlista',
    description: '',
    defaultLanguage: null,
    publishedAt: '2026-01-01T10:00:00Z',
    itemCount: 0,
    privacyStatus: 'public',
    thumbnailUrl: null,
    ...overrides,
  };
}
