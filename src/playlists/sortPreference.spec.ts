import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SORT } from './sortPlaylists';
import { readSort, writeSort } from './sortPreference';

const KEY = 'youtube-playlist-manager.sort';

describe('sortPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to newest first', () => {
    expect(readSort()).toEqual(DEFAULT_SORT);
  });

  it('reads back a written sort as JSON', () => {
    writeSort({ key: 'itemCount', direction: 'asc' });
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
      key: 'itemCount',
      direction: 'asc',
    });
    expect(readSort()).toEqual({ key: 'itemCount', direction: 'asc' });
  });

  it('migrates the legacy values', () => {
    localStorage.setItem(KEY, 'newest');
    expect(readSort()).toEqual({ key: 'publishedAt', direction: 'desc' });
    localStorage.setItem(KEY, 'alpha');
    expect(readSort()).toEqual({ key: 'title', direction: 'asc' });
  });

  it('ignores invalid JSON and unknown values', () => {
    localStorage.setItem(KEY, '{nope');
    expect(readSort()).toEqual(DEFAULT_SORT);
    localStorage.setItem(KEY, 'random');
    expect(readSort()).toEqual(DEFAULT_SORT);
  });

  it('ignores an invalid key or direction', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ key: 'nope', direction: 'asc' }),
    );
    expect(readSort()).toEqual(DEFAULT_SORT);
    localStorage.setItem(
      KEY,
      JSON.stringify({ key: 'title', direction: 'sideways' }),
    );
    expect(readSort()).toEqual(DEFAULT_SORT);
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeSort({ key: 'title', direction: 'asc' })).not.toThrow();
    expect(readSort()).toEqual(DEFAULT_SORT);
  });
});
