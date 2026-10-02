import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeFakeYouTube, type FakeYouTube } from '../test/fakeYouTube';
import { youTubeWrapper } from '../test/renderWithYouTube';
import { makeVideo } from '../test/videoFactory';
import { ApiError, type PlaylistVideo } from '../youtube/types';
import { usePlaylistVideos } from './usePlaylistVideos';

const quicksort = makeVideo({ videoId: 'qs', title: 'Quicksort', position: 0 });
const bigO = makeVideo({ videoId: 'bigo', title: 'Big O', position: 1 });
const deleted = makeVideo({
  videoId: 'gone',
  title: 'Deleted video',
  position: 2,
  available: false,
});
const hidden = makeVideo({
  videoId: 'hidden',
  title: 'Private video',
  position: 3,
  available: false,
});

let youtube: FakeYouTube;

async function renderLoaded(list: PlaylistVideo[] = [quicksort, bigO]) {
  youtube.listPlaylistVideos.mockResolvedValue(list);
  const replaceVideos = vi.fn<(id: string, videos: PlaylistVideo[]) => void>();
  const onCountChange = vi.fn<(count: number) => void>();
  const hook = renderHook(
    () =>
      usePlaylistVideos({
        playlistId: 'PL1',
        videoIndex: { replaceVideos },
        onCountChange,
      }),
    { wrapper: youTubeWrapper(youtube) },
  );
  await waitFor(() => expect(hook.result.current.load.status).toBe('ready'));
  return { ...hook, replaceVideos, onCountChange };
}

function deferred<Value>() {
  let resolve: (value: Value) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<Value>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  youtube = makeFakeYouTube();
});

describe('usePlaylistVideos', () => {
  it('loads every video, feeds the index with the watchable ones and reports the count', async () => {
    const { result, replaceVideos, onCountChange } = await renderLoaded([
      quicksort,
      deleted,
    ]);

    expect(youtube.listPlaylistVideos).toHaveBeenCalledWith('PL1', {
      includeUnavailable: true,
    });
    expect(result.current.videos).toEqual([quicksort, deleted]);
    expect(replaceVideos).toHaveBeenCalledWith('PL1', [quicksort]);
    expect(onCountChange).toHaveBeenCalledWith(2);
  });

  it('explains a failed load and loads again on retry', async () => {
    youtube.listPlaylistVideos.mockRejectedValueOnce(
      new ApiError('network', 'offline'),
    );
    const replaceVideos = vi.fn();
    const { result } = renderHook(
      () =>
        usePlaylistVideos({
          playlistId: 'PL1',
          videoIndex: { replaceVideos },
          onCountChange: vi.fn(),
        }),
      { wrapper: youTubeWrapper(youtube) },
    );
    await waitFor(() => expect(result.current.load.status).toBe('error'));

    youtube.listPlaylistVideos.mockResolvedValue([quicksort]);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.load.status).toBe('ready'));
    expect(result.current.videos).toEqual([quicksort]);
  });

  it('moves a video at once and saves the position of its destination', async () => {
    const move = deferred<void>();
    youtube.movePlaylistItem.mockReturnValue(move.promise);
    const { result, replaceVideos } = await renderLoaded();
    replaceVideos.mockClear();

    let moved: Promise<boolean> = Promise.resolve(false);
    act(() => {
      moved = result.current.move(0, 1);
    });

    expect(result.current.videos.map((video) => video.title)).toEqual([
      'Big O',
      'Quicksort',
    ]);
    expect(result.current.pending).toEqual({
      kind: 'item',
      itemId: quicksort.itemId,
    });
    expect(youtube.movePlaylistItem).toHaveBeenCalledWith('PL1', quicksort, 1);
    // Indeks dostaje nową kolejność dopiero po potwierdzeniu z API
    expect(replaceVideos).not.toHaveBeenCalled();

    await act(async () => {
      move.resolve();
      expect(await moved).toBe(true);
    });

    expect(result.current.pending).toBeNull();
    expect(replaceVideos).toHaveBeenCalledTimes(1);
  });

  it('puts the video back when the move fails', async () => {
    youtube.movePlaylistItem.mockRejectedValue(
      new ApiError('forbidden', 'no', 403),
    );
    const { result, replaceVideos } = await renderLoaded();
    replaceVideos.mockClear();

    await act(async () => {
      expect(await result.current.move(0, 1)).toBe(false);
    });

    expect(result.current.videos).toEqual([quicksort, bigO]);
    expect(result.current.itemError).toEqual({
      itemId: quicksort.itemId,
      message: 'YouTube odmówił dostępu do tej operacji.',
    });
    expect(replaceVideos).not.toHaveBeenCalled();
  });

  it('refuses a second operation while one is running', async () => {
    const move = deferred<void>();
    youtube.movePlaylistItem.mockReturnValue(move.promise);
    const { result } = await renderLoaded();

    let first: Promise<boolean> = Promise.resolve(false);
    act(() => {
      first = result.current.move(0, 1);
    });
    await act(async () => {
      expect(await result.current.remove(bigO)).toBe(false);
      expect(await result.current.move(1, 0)).toBe(false);
    });

    expect(youtube.removePlaylistItem).not.toHaveBeenCalled();
    expect(youtube.movePlaylistItem).toHaveBeenCalledTimes(1);

    await act(async () => {
      move.resolve();
      await first;
    });
  });

  it('removes a video only after the API confirms', async () => {
    youtube.removePlaylistItem.mockResolvedValue(undefined);
    const { result, replaceVideos, onCountChange } = await renderLoaded();

    await act(async () => {
      expect(await result.current.remove(quicksort)).toBe(true);
    });

    expect(youtube.removePlaylistItem).toHaveBeenCalledWith(quicksort.itemId);
    expect(result.current.videos.map((video) => video.title)).toEqual([
      'Big O',
    ]);
    expect(replaceVideos).toHaveBeenLastCalledWith(
      'PL1',
      result.current.videos,
    );
    expect(onCountChange).toHaveBeenLastCalledWith(1);
  });

  it('keeps the video when removing fails', async () => {
    youtube.removePlaylistItem.mockRejectedValue(
      new ApiError('quotaExceeded', 'quota', 403),
    );
    const { result } = await renderLoaded();

    await act(async () => {
      expect(await result.current.remove(quicksort)).toBe(false);
    });

    expect(result.current.videos).toEqual([quicksort, bigO]);
    expect(result.current.itemError?.itemId).toBe(quicksort.itemId);
  });

  it('adds a video at the end', async () => {
    const added = makeVideo({ videoId: 'new', title: 'Nowy', position: 2 });
    youtube.addPlaylistItem.mockResolvedValue(added);
    const { result, onCountChange } = await renderLoaded();

    await act(async () => {
      await result.current.add('new');
    });

    expect(youtube.addPlaylistItem).toHaveBeenCalledWith('PL1', 'new');
    expect(result.current.videos).toEqual([quicksort, bigO, added]);
    expect(onCountChange).toHaveBeenLastCalledWith(3);
  });

  it.each([
    ['videoNotFound', 'Nie znaleziono takiego filmu na YouTube.'],
    ['playlistNotFound', 'Tej playlisty już nie ma.'],
  ])('explains a 404 with reason %s when adding', async (reason, message) => {
    youtube.addPlaylistItem.mockRejectedValue(
      new ApiError('notFound', 'Not found', 404, reason),
    );
    const { result } = await renderLoaded();

    await act(async () => {
      await expect(result.current.add('nope')).rejects.toThrow(message);
    });

    expect(result.current.pending).toBeNull();
    expect(result.current.videos).toEqual([quicksort, bigO]);
  });

  it('removes every unavailable video one by one', async () => {
    youtube.removePlaylistItem.mockResolvedValue(undefined);
    const { result, onCountChange } = await renderLoaded([
      quicksort,
      deleted,
      hidden,
    ]);

    await act(async () => {
      expect(await result.current.removeUnavailable()).toBe(true);
    });

    expect(youtube.removePlaylistItem.mock.calls).toEqual([
      [deleted.itemId],
      [hidden.itemId],
    ]);
    expect(result.current.videos.map((video) => video.title)).toEqual([
      'Quicksort',
    ]);
    expect(result.current.progress).toBeNull();
    expect(onCountChange).toHaveBeenLastCalledWith(1);
  });

  it('stops the bulk removal at the first error and keeps what was removed', async () => {
    youtube.removePlaylistItem
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ApiError('quotaExceeded', 'quota', 403));
    const { result } = await renderLoaded([quicksort, deleted, hidden]);

    await act(async () => {
      expect(await result.current.removeUnavailable()).toBe(false);
    });

    // Usunięcie zamyka lukę w pozycjach, więc porównujemy tytuły
    expect(result.current.videos.map((video) => video.title)).toEqual([
      'Quicksort',
      'Private video',
    ]);
    expect(result.current.bulkError).toBe(
      'Wyczerpano dzienny limit YouTube API. Spróbuj jutro.',
    );
    expect(result.current.pending).toBeNull();
  });

  it('has nothing to remove in bulk when every video is available', async () => {
    const { result } = await renderLoaded();

    await act(async () => {
      expect(await result.current.removeUnavailable()).toBe(false);
    });

    expect(youtube.removePlaylistItem).not.toHaveBeenCalled();
  });
});
