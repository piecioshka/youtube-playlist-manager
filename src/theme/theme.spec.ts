import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, DEFAULT_THEME, readTheme, writeTheme } from './theme';

const KEY = 'youtube-playlist-manager.theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to dark', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(readTheme()).toBe('dark');
  });

  it('reads back a written theme', () => {
    writeTheme('light');
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(readTheme()).toBe('light');
  });

  it('falls back to dark for an invalid value', () => {
    localStorage.setItem(KEY, 'sepia');
    expect(readTheme()).toBe('dark');
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeTheme('light')).not.toThrow();
    expect(readTheme()).toBe('dark');
  });

  it('sets data-theme on the html element', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
