import { describe, expect, it } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import { countByVisibility, filterByVisibility } from './filterPlaylists';

const open = makePlaylist({ id: 'a', privacyStatus: 'public' });
const hidden = makePlaylist({ id: 'b', privacyStatus: 'unlisted' });
const secret = makePlaylist({ id: 'c', privacyStatus: 'private' });
const secretToo = makePlaylist({ id: 'd', privacyStatus: 'private' });
const all = [open, hidden, secret, secretToo];

describe('filterByVisibility', () => {
  it('returns every playlist for "all"', () => {
    expect(filterByVisibility(all, 'all')).toEqual(all);
  });

  it('keeps only playlists with the given privacy status', () => {
    expect(filterByVisibility(all, 'public')).toEqual([open]);
    expect(filterByVisibility(all, 'unlisted')).toEqual([hidden]);
    expect(filterByVisibility(all, 'private')).toEqual([secret, secretToo]);
  });

  it('returns a new array and does not mutate the input', () => {
    const input = [open];
    const result = filterByVisibility(input, 'all');
    expect(result).not.toBe(input);
    expect(input).toEqual([open]);
  });
});

describe('countByVisibility', () => {
  it('counts every option', () => {
    expect(countByVisibility(all)).toEqual({
      all: 4,
      public: 1,
      unlisted: 1,
      private: 2,
    });
  });

  it('returns zeros for an empty list', () => {
    expect(countByVisibility([])).toEqual({
      all: 0,
      public: 0,
      unlisted: 0,
      private: 0,
    });
  });
});
