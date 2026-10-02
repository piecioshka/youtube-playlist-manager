import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readLocale, writeLocale } from './locale';

const KEY = 'youtube-playlist-manager.locale';

describe('locale', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to Polish', () => {
    expect(readLocale()).toBe('pl');
  });

  it('reads back a written locale', () => {
    writeLocale('en');
    expect(localStorage.getItem(KEY)).toBe('en');
    expect(readLocale()).toBe('en');
  });

  it('falls back to Polish for an invalid value', () => {
    localStorage.setItem(KEY, 'de');
    expect(readLocale()).toBe('pl');
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeLocale('en')).not.toThrow();
    expect(readLocale()).toBe('pl');
  });
});
