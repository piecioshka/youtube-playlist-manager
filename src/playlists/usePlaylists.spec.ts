import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { messages } from '../i18n/messages';
import { makeFakeYouTube, type FakeYouTube } from '../test/fakeYouTube';
import { makePlaylist } from '../test/playlistFactory';
import { youTubeWrapper } from '../test/renderWithYouTube';
import { ApiError } from '../youtube/types';
import { usePlaylists } from './usePlaylists';

let youtube: FakeYouTube;

const zupa = makePlaylist({ id: 'a', title: 'Zupa' });
const joga = makePlaylist({ id: 'b', title: 'Joga' });

async function renderLoaded() {
  const hook = renderHook(() => usePlaylists({ t: messages.pl }), {
    wrapper: youTubeWrapper(youtube),
  });
  await waitFor(() =>
    expect(hook.result.current.loadState.status).toBe('ready'),
  );
  return hook;
}

beforeEach(() => {
  youtube = makeFakeYouTube();
  youtube.listMyPlaylists.mockResolvedValue([zupa, joga]);
});

describe('usePlaylists', () => {
  it('loads the playlists once', async () => {
    const { result } = await renderLoaded();
    expect(result.current.playlists).toEqual([zupa, joga]);
    expect(youtube.listMyPlaylists).toHaveBeenCalledTimes(1);
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

  it('keeps the list and shows the message when deleting fails', async () => {
    youtube.deletePlaylist.mockRejectedValueOnce(
      new ApiError('unauthorized', 'expired', 401),
    );
    const { result } = await renderLoaded();

    await act(async () => {
      await expect(result.current.handleDelete(zupa)).rejects.toThrow(
        'Sesja wygasła, zaloguj się ponownie.',
      );
    });

    expect(youtube.deletePlaylist).toHaveBeenCalledWith('a');
    expect(result.current.playlists).toEqual([zupa, joga]);
  });
});
