import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { messages } from '../i18n/messages';
import { makeFakeYouTube, type FakeYouTube } from '../test/fakeYouTube';
import { makePlaylist } from '../test/playlistFactory';
import { youTubeWrapper } from '../test/renderWithYouTube';
import { ApiError, type Playlist } from '../youtube/types';
import { PlaylistGoneError, usePlaylists } from './usePlaylists';

const zupa = makePlaylist({ id: 'a', title: 'Zupa', itemCount: 2 });
const joga = makePlaylist({ id: 'b', title: 'Joga' });

let youtube: FakeYouTube;

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

  it('updates a playlist and returns the new version', async () => {
    const renamed = { ...zupa, title: 'Rosół' };
    youtube.updatePlaylist.mockResolvedValue(renamed);
    const { result } = await renderLoaded();

    let returned: Playlist | undefined;
    await act(async () => {
      returned = await result.current.updatePlaylist(zupa, { title: 'Rosół' });
    });

    expect(youtube.updatePlaylist).toHaveBeenCalledWith(zupa, {
      title: 'Rosół',
    });
    expect(returned).toEqual(renamed);
    expect(result.current.playlists).toEqual([renamed, joga]);
  });

  it('keeps the corrected video count when a save finishes later', async () => {
    let resolveSave: (playlist: Playlist) => void = () => {};
    youtube.updatePlaylist.mockReturnValue(
      new Promise<Playlist>((resolve) => {
        resolveSave = resolve;
      }),
    );
    const { result } = await renderLoaded();

    let saving: Promise<Playlist> = Promise.resolve(zupa);
    act(() => {
      saving = result.current.updatePlaylist(zupa, { title: 'Rosół' });
    });
    act(() => result.current.setItemCount('a', 5));
    await act(async () => {
      resolveSave({ ...zupa, title: 'Rosół' });
      await saving;
    });

    expect(result.current.playlists).toEqual([
      { ...zupa, title: 'Rosół', itemCount: 5 },
      joga,
    ]);
  });

  it('drops a playlist that is gone when updating it', async () => {
    youtube.updatePlaylist.mockRejectedValue(
      new ApiError('notFound', 'gone', 404),
    );
    const { result } = await renderLoaded();

    let caught: unknown;
    await act(async () => {
      caught = await result.current
        .updatePlaylist(zupa, { title: 'Rosół' })
        .catch((error: unknown) => error);
    });

    expect(caught).toBeInstanceOf(PlaylistGoneError);
    expect(caught).toHaveProperty('message', 'Tej playlisty już nie ma.');
    expect(result.current.playlists).toEqual([joga]);
    expect(result.current.notice).toEqual({ kind: 'missing' });
  });

  it('keeps the list and explains another update error', async () => {
    youtube.updatePlaylist.mockRejectedValue(
      new ApiError('forbidden', 'no', 403),
    );
    const { result } = await renderLoaded();

    let caught: unknown;
    await act(async () => {
      caught = await result.current
        .updatePlaylist(zupa, { title: 'Rosół' })
        .catch((error: unknown) => error);
    });

    expect(caught).not.toBeInstanceOf(PlaylistGoneError);
    expect(caught).toHaveProperty(
      'message',
      'YouTube odmówił dostępu do tej operacji.',
    );
    expect(result.current.playlists).toEqual([zupa, joga]);
    expect(result.current.notice).toBeNull();
  });

  it('deletes a playlist and announces it', async () => {
    youtube.deletePlaylist.mockResolvedValue(undefined);
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.deletePlaylist(zupa);
    });

    expect(youtube.deletePlaylist).toHaveBeenCalledWith('a');
    expect(result.current.playlists).toEqual([joga]);
    expect(result.current.notice).toEqual({ kind: 'deleted', title: 'Zupa' });

    act(() => result.current.clearNotice());
    expect(result.current.notice).toBeNull();
  });

  it('drops a playlist that is gone when deleting it', async () => {
    youtube.deletePlaylist.mockRejectedValue(
      new ApiError('notFound', 'gone', 404),
    );
    const { result } = await renderLoaded();

    let caught: unknown;
    await act(async () => {
      caught = await result.current
        .deletePlaylist(zupa)
        .catch((error: unknown) => error);
    });

    expect(caught).toBeInstanceOf(PlaylistGoneError);
    expect(result.current.playlists).toEqual([joga]);
    expect(result.current.notice).toEqual({ kind: 'missing' });
  });

  it('keeps the playlist when deleting fails', async () => {
    youtube.deletePlaylist.mockRejectedValue(
      new ApiError('unauthorized', 'expired', 401),
    );
    const { result } = await renderLoaded();

    await act(async () => {
      await expect(result.current.deletePlaylist(zupa)).rejects.toThrow(
        'Sesja wygasła, zaloguj się ponownie.',
      );
    });

    expect(result.current.playlists).toEqual([zupa, joga]);
  });

  it('corrects the number of videos of one playlist', async () => {
    const { result } = await renderLoaded();

    act(() => result.current.setItemCount('a', 5));
    expect(result.current.playlists).toEqual([{ ...zupa, itemCount: 5 }, joga]);

    const before = result.current.playlists;
    act(() => result.current.setItemCount('a', 5));
    expect(result.current.playlists).toBe(before);
  });
});
