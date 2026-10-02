import type { PlaylistVideo } from '../youtube/types';

export function makeVideo(
  overrides: Partial<PlaylistVideo> = {},
): PlaylistVideo {
  const videoId = overrides.videoId ?? 'v1';
  return {
    itemId: `item-${videoId}`,
    videoId,
    title: `Film ${videoId}`,
    channelTitle: 'Kanał',
    position: 0,
    thumbnailUrl: null,
    ...overrides,
  };
}
