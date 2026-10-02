import { describe, expect, it } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import type { Playlist } from '../youtube/types';
import {
  DEFAULT_SORT,
  nextSort,
  sortPlaylists,
  type SortDirection,
  type SortKey,
  type SortState,
} from './sortPlaylists';

function ids(list: Playlist[]): string[] {
  return list.map((playlist) => playlist.id);
}

function sorted(
  list: Playlist[],
  key: SortKey,
  direction: SortDirection,
): string[] {
  return ids(sortPlaylists(list, { key, direction }));
}

describe('sortPlaylists', () => {
  it('uses newest first by default', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'publishedAt', direction: 'desc' });
  });

  it('sorts by title with Polish collation, ignoring case', () => {
    const list = [
      makePlaylist({ id: 'a', title: 'Mama' }),
      makePlaylist({ id: 'b', title: 'Łódź' }),
      makePlaylist({ id: 'c', title: 'lato' }),
      makePlaylist({ id: 'd', title: 'Lis' }),
    ];
    expect(sorted(list, 'title', 'asc')).toEqual(['c', 'd', 'b', 'a']);
    expect(sorted(list, 'title', 'desc')).toEqual(['a', 'b', 'd', 'c']);
  });

  it('sorts by item count', () => {
    const list = [
      makePlaylist({ id: 'a', itemCount: 10 }),
      makePlaylist({ id: 'b', itemCount: 2 }),
      makePlaylist({ id: 'c', itemCount: 30 }),
    ];
    expect(sorted(list, 'itemCount', 'asc')).toEqual(['b', 'a', 'c']);
    expect(sorted(list, 'itemCount', 'desc')).toEqual(['c', 'a', 'b']);
  });

  it('sorts by privacy: public, unlisted, private', () => {
    const list = [
      makePlaylist({ id: 'a', privacyStatus: 'private' }),
      makePlaylist({ id: 'b', privacyStatus: 'public' }),
      makePlaylist({ id: 'c', privacyStatus: 'unlisted' }),
    ];
    expect(sorted(list, 'privacy', 'asc')).toEqual(['b', 'c', 'a']);
    expect(sorted(list, 'privacy', 'desc')).toEqual(['a', 'c', 'b']);
  });

  it('sorts by creation date', () => {
    const list = [
      makePlaylist({ id: 'a', publishedAt: '2024-05-01T00:00:00Z' }),
      makePlaylist({ id: 'b', publishedAt: '2026-05-01T00:00:00Z' }),
      makePlaylist({ id: 'c', publishedAt: '2025-05-01T00:00:00Z' }),
    ];
    expect(sorted(list, 'publishedAt', 'asc')).toEqual(['a', 'c', 'b']);
    expect(sorted(list, 'publishedAt', 'desc')).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties by id ascending in both directions', () => {
    const keys: SortKey[] = ['title', 'itemCount', 'privacy', 'publishedAt'];
    const list = [
      makePlaylist({ id: 'z' }),
      makePlaylist({ id: 'y' }),
      makePlaylist({ id: 'x' }),
    ];
    for (const key of keys) {
      expect(sorted(list, key, 'asc')).toEqual(['x', 'y', 'z']);
      expect(sorted(list, key, 'desc')).toEqual(['x', 'y', 'z']);
    }
  });

  it('does not mutate the input', () => {
    const list = [
      makePlaylist({ id: 'b', title: 'B' }),
      makePlaylist({ id: 'a', title: 'A' }),
    ];
    sortPlaylists(list, { key: 'title', direction: 'asc' });
    expect(ids(list)).toEqual(['b', 'a']);
  });
});

describe('nextSort', () => {
  it('flips the direction of the active key', () => {
    expect(nextSort({ key: 'title', direction: 'asc' }, 'title')).toEqual({
      key: 'title',
      direction: 'desc',
    });
    expect(nextSort({ key: 'title', direction: 'desc' }, 'title')).toEqual({
      key: 'title',
      direction: 'asc',
    });
  });

  it('starts text-like keys ascending', () => {
    const current: SortState = { key: 'itemCount', direction: 'desc' };
    expect(nextSort(current, 'title')).toEqual({
      key: 'title',
      direction: 'asc',
    });
    expect(nextSort(current, 'privacy')).toEqual({
      key: 'privacy',
      direction: 'asc',
    });
  });

  it('starts numeric and date keys descending', () => {
    const current: SortState = { key: 'title', direction: 'asc' };
    expect(nextSort(current, 'itemCount')).toEqual({
      key: 'itemCount',
      direction: 'desc',
    });
    expect(nextSort(current, 'publishedAt')).toEqual({
      key: 'publishedAt',
      direction: 'desc',
    });
  });
});
