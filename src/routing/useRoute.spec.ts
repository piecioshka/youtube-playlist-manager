import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useRoute } from './useRoute';

afterEach(() => {
  window.location.hash = '';
});

describe('useRoute', () => {
  it('reads the current hash', () => {
    window.location.hash = '#/playlists/a';
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toEqual({ name: 'playlist', id: 'a' });
  });

  it('follows hash changes made outside the app (Back, typed URL)', async () => {
    const { result } = renderHook(() => useRoute());
    expect(result.current.route).toEqual({ name: 'list' });

    act(() => {
      window.location.hash = '#/playlists/b';
    });

    await waitFor(() =>
      expect(result.current.route).toEqual({ name: 'playlist', id: 'b' }),
    );
  });

  it('navigates by setting the hash, so the browser history gets an entry', async () => {
    const { result } = renderHook(() => useRoute());

    act(() => {
      result.current.navigate({ name: 'playlist', id: 'c d' });
    });

    expect(window.location.hash).toBe('#/playlists/c%20d');
    await waitFor(() =>
      expect(result.current.route).toEqual({ name: 'playlist', id: 'c d' }),
    );

    act(() => {
      result.current.navigate({ name: 'list' });
    });

    expect(window.location.hash).toBe('#/');
    await waitFor(() => expect(result.current.route).toEqual({ name: 'list' }));
  });

  it('stops listening after unmount', () => {
    const { result, unmount } = renderHook(() => useRoute());
    unmount();
    window.location.hash = '#/playlists/z';
    expect(result.current.route).toEqual({ name: 'list' });
  });
});
