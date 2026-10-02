import { describe, expect, it } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import type { Playlist } from '../youtube/types';
import { sortPlaylists } from './sortPlaylists';

function titles(list: Playlist[]): string[] {
  return list.map((playlist) => playlist.title);
}

describe('sortPlaylists', () => {
  it('sorts alphabetically with Polish collation, ignoring case', () => {
    const list = [
      makePlaylist({ id: 'a', title: 'Mama' }),
      makePlaylist({ id: 'b', title: 'Łódź' }),
      makePlaylist({ id: 'c', title: 'lato' }),
      makePlaylist({ id: 'd', title: 'Lis' }),
    ];
    expect(titles(sortPlaylists(list, 'alpha'))).toEqual([
      'lato',
      'Lis',
      'Łódź',
      'Mama',
    ]);
  });

  it('sorts newest first by publishedAt', () => {
    const list = [
      makePlaylist({
        id: 'a',
        title: '2024',
        publishedAt: '2024-05-01T00:00:00Z',
      }),
      makePlaylist({
        id: 'b',
        title: '2026',
        publishedAt: '2026-05-01T00:00:00Z',
      }),
      makePlaylist({
        id: 'c',
        title: '2025',
        publishedAt: '2025-05-01T00:00:00Z',
      }),
    ];
    expect(titles(sortPlaylists(list, 'newest'))).toEqual([
      '2026',
      '2025',
      '2024',
    ]);
  });

  it('breaks ties by id', () => {
    const sameTitle = [
      makePlaylist({ id: 'b', title: 'Same' }),
      makePlaylist({ id: 'a', title: 'same' }),
    ];
    expect(sortPlaylists(sameTitle, 'alpha').map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);

    const sameDate = [makePlaylist({ id: 'z' }), makePlaylist({ id: 'y' })];
    expect(sortPlaylists(sameDate, 'newest').map((p) => p.id)).toEqual([
      'y',
      'z',
    ]);
  });

  it('does not mutate the input', () => {
    const list = [
      makePlaylist({ id: 'b', title: 'B' }),
      makePlaylist({ id: 'a', title: 'A' }),
    ];
    sortPlaylists(list, 'alpha');
    expect(list.map((p) => p.id)).toEqual(['b', 'a']);
  });
});
