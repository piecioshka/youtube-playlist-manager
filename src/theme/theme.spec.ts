import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubSystemTheme } from '../test/systemTheme';
import {
  applyTheme,
  DEFAULT_PREFERENCE,
  readPreference,
  resolveTheme,
  watchSystemTheme,
  writePreference,
} from './theme';

const KEY = 'youtube-playlist-manager.theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.head.innerHTML = '<meta name="theme-color" content="" />';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.head.innerHTML = '';
  });

  it('follows the system by default', () => {
    expect(DEFAULT_PREFERENCE).toBe('system');
    expect(readPreference()).toBe('system');
  });

  it.each(['light', 'dark', 'system'] as const)(
    'reads back a written %s preference',
    (preference) => {
      writePreference(preference);
      expect(localStorage.getItem(KEY)).toBe(preference);
      expect(readPreference()).toBe(preference);
    },
  );

  it('falls back to the system for an invalid value', () => {
    localStorage.setItem(KEY, 'sepia');
    expect(readPreference()).toBe('system');
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writePreference('light')).not.toThrow();
    expect(readPreference()).toBe('system');
  });

  it('resolves an explicit preference to itself', () => {
    stubSystemTheme('light');
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('resolves the system preference to what the system asks for', () => {
    const system = stubSystemTheme('light');
    expect(resolveTheme('system')).toBe('light');
    system.set('dark');
    expect(resolveTheme('system')).toBe('dark');
  });

  it('resolves the system preference to dark where the browser cannot tell', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(resolveTheme('system')).toBe('dark');
  });

  it('reports system changes until told to stop', () => {
    const system = stubSystemTheme('dark');
    const onChange = vi.fn();
    const stop = watchSystemTheme(onChange);

    system.set('light');
    expect(onChange).toHaveBeenCalledTimes(1);

    stop();
    system.set('dark');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('sets data-theme on the html element', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('paints the browser chrome in the page background', () => {
    const meta = document.querySelector('meta[name="theme-color"]');
    applyTheme('light');
    expect(meta).toHaveAttribute('content', '#f7f7f8');
    applyTheme('dark');
    expect(meta).toHaveAttribute('content', '#121214');
  });
});
