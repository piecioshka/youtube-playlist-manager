import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSortMode, writeSortMode } from './sortPreference';

describe('sortPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to newest', () => {
    expect(readSortMode()).toBe('newest');
  });

  it('reads back a written mode', () => {
    writeSortMode('alpha');
    expect(localStorage.getItem('youtube-playlist-manager.sort')).toBe('alpha');
    expect(readSortMode()).toBe('alpha');
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem('youtube-playlist-manager.sort', 'random');
    expect(readSortMode()).toBe('newest');
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeSortMode('alpha')).not.toThrow();
    expect(readSortMode()).toBe('newest');
  });
});
