import { describe, expect, it } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import { makeVideo } from '../test/videoFactory';
import type { PlaylistVideo } from '../youtube/types';
import { searchPlaylists } from './searchPlaylists';

const music = makePlaylist({ id: 'm', title: 'Muzyka do pracy' });
const algo = makePlaylist({ id: 'a', title: 'Algorytmy' });
const lodz = makePlaylist({ id: 'l', title: 'Wycieczka do Łodzi' });

function video(videoId: string, title: string, channelTitle: string) {
  return makeVideo({ videoId, title, channelTitle });
}

const videos = new Map<string, PlaylistVideo[]>([
  [
    'm',
    [
      video('v1', 'Lofi beats to study', 'Lofi Girl'),
      video('v2', 'Jazz', 'Cafe Music'),
    ],
  ],
  ['a', [video('v3', 'Quicksort in 4 minutes', 'Michael Sambol')]],
]);

describe('searchPlaylists', () => {
  it('keeps playlists whose title matches, without diacritics', () => {
    const result = searchPlaylists([music, algo, lodz], 'lodz', videos);

    expect(result.map((item) => item.playlist.id)).toEqual(['l']);
    expect(result[0]?.matchingVideos).toEqual([]);
  });

  it('keeps playlists with a matching video title', () => {
    const result = searchPlaylists([music, algo, lodz], 'quicksort', videos);

    expect(result).toEqual([
      {
        playlist: algo,
        matchingVideos: [
          video('v3', 'Quicksort in 4 minutes', 'Michael Sambol'),
        ],
      },
    ]);
  });

  it('matches the channel title too', () => {
    const result = searchPlaylists([music, algo], 'cafe', videos);

    expect(result.map((item) => item.playlist.id)).toEqual(['m']);
    expect(result[0]?.matchingVideos.map((item) => item.videoId)).toEqual([
      'v2',
    ]);
  });

  it('lists matching videos of a playlist that also matches by title', () => {
    const result = searchPlaylists([music], 'muzyka', videos);

    expect(result[0]?.matchingVideos).toEqual([]);
    expect(
      searchPlaylists([music], 'music', videos)[0]?.matchingVideos,
    ).toHaveLength(1);
  });

  it('keeps the input order', () => {
    const result = searchPlaylists([algo, music], 'i', videos);

    expect(result.map((item) => item.playlist.id)).toEqual(['a', 'm']);
  });
});
