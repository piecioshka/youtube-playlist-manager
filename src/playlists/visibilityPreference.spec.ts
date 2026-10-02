import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readVisibilityFilter,
  writeVisibilityFilter,
} from './visibilityPreference';

const KEY = 'youtube-playlist-manager.visibility';

describe('visibilityPreference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to all', () => {
    expect(readVisibilityFilter()).toBe('all');
  });

  it('reads back a written filter', () => {
    writeVisibilityFilter('private');
    expect(localStorage.getItem(KEY)).toBe('private');
    expect(readVisibilityFilter()).toBe('private');
  });

  it('falls back to all for an invalid value', () => {
    localStorage.setItem(KEY, 'secret');
    expect(readVisibilityFilter()).toBe('all');
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeVisibilityFilter('public')).not.toThrow();
    expect(readVisibilityFilter()).toBe('all');
  });
});
