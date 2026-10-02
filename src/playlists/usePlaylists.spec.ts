import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '../i18n/messages';
import { makePlaylist } from '../test/playlistFactory';
import { deletePlaylist, listMyPlaylists } from '../youtube/api';
import { ApiError } from '../youtube/types';
import { usePlaylists } from './usePlaylists';

vi.mock('../youtube/api', () => ({
  listMyPlaylists: vi.fn(),
  renamePlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
}));

const zupa = makePlaylist({ id: 'a', title: 'Zupa' });
const joga = makePlaylist({ id: 'b', title: 'Joga' });

async function renderLoaded() {
  const onUnauthorized = vi.fn();
  const hook = renderHook(() =>
    usePlaylists({ token: 'tok', onUnauthorized, t: messages.pl }),
  );
  await waitFor(() =>
    expect(hook.result.current.loadState.status).toBe('ready'),
  );
  return { ...hook, onUnauthorized };
}

beforeEach(() => {
  vi.mocked(listMyPlaylists).mockReset();
  vi.mocked(deletePlaylist).mockReset();
  vi.mocked(listMyPlaylists).mockResolvedValue([zupa, joga]);
});

describe('usePlaylists', () => {
  it('loads the playlists once', async () => {
    const { result } = await renderLoaded();
    expect(result.current.playlists).toEqual([zupa, joga]);
    expect(listMyPlaylists).toHaveBeenCalledTimes(1);
    expect(listMyPlaylists).toHaveBeenCalledWith('tok');
  });

  it('replaces a playlist updated elsewhere (the profile)', async () => {
    const { result } = await renderLoaded();

    act(() => result.current.replacePlaylist({ ...joga, itemCount: 9 }));

    expect(result.current.playlists).toEqual([zupa, { ...joga, itemCount: 9 }]);
  });

  it('drops a playlist deleted elsewhere and announces it', async () => {
    const { result } = await renderLoaded();

    act(() => result.current.markDeleted(zupa));

    expect(result.current.playlists).toEqual([joga]);
    expect(result.current.notice).toEqual({ kind: 'deleted', title: 'Zupa' });

    act(() => result.current.clearNotice());
    expect(result.current.notice).toBeNull();
  });

  it('deletes through the API and reports 401 to the caller', async () => {
    vi.mocked(deletePlaylist).mockRejectedValueOnce(
      new ApiError('unauthorized', 'expired', 401),
    );
    const { result, onUnauthorized } = await renderLoaded();

    await act(async () => {
      await expect(result.current.handleDelete(zupa)).rejects.toThrow(
        'Sesja wygasła, zaloguj się ponownie.',
      );
    });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(result.current.playlists).toEqual([zupa, joga]);
  });
});
