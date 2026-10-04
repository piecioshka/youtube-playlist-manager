import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubSystemTheme } from '../test/systemTheme';
import { useTheme } from './useTheme';

const KEY = 'youtube-playlist-manager.theme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with the system theme and applies it on mount', () => {
    stubSystemTheme('light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('starts from the stored preference', () => {
    stubSystemTheme('light');
    localStorage.setItem(KEY, 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('stores and applies a chosen theme', () => {
    stubSystemTheme('dark');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference('light'));
    expect(result.current.preference).toBe('light');
    expect(localStorage.getItem(KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    act(() => result.current.setPreference('system'));
    expect(localStorage.getItem(KEY)).toBe('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('follows the system while the preference is system', () => {
    const system = stubSystemTheme('dark');
    renderHook(() => useTheme());
    expect(document.documentElement.dataset.theme).toBe('dark');

    act(() => system.set('light'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('ignores the system once a theme is chosen', () => {
    const system = stubSystemTheme('dark');
    const { result } = renderHook(() => useTheme());

    act(() => result.current.setPreference('dark'));
    act(() => system.set('light'));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
