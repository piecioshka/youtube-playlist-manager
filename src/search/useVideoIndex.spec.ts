import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeFakeYouTube, type FakeYouTube } from '../test/fakeYouTube';
import { makePlaylist } from '../test/playlistFactory';
import { youTubeWrapper } from '../test/renderWithYouTube';
import { makeVideo } from '../test/videoFactory';
import { ApiError, type Playlist, type PlaylistVideo } from '../youtube/types';
import { useVideoIndex } from './useVideoIndex';

let youtube: FakeYouTube;

type Deferred = {
  resolve: (videos: PlaylistVideo[]) => void;
  reject: (error: unknown) => void;
};

// Każde wywołanie API czeka, aż test sam je rozstrzygnie
function deferCalls(): Map<string, Deferred> {
  const pending = new Map<string, Deferred>();
  youtube.listPlaylistVideos.mockImplementation(
    (playlistId) =>
      new Promise((resolve, reject) => {
        pending.set(playlistId, { resolve, reject });
      }),
  );
  return pending;
}

function settle(
  pending: Map<string, Deferred>,
  id: string,
  outcome: PlaylistVideo[] | Error,
) {
  const call = pending.get(id);
  if (!call) {
    throw new Error(`No request for ${id}`);
  }
  if (outcome instanceof Error) {
    call.reject(outcome);
  } else {
    call.resolve(outcome);
  }
}

function makePlaylists(count: number): Playlist[] {
  return Array.from({ length: count }, (_, index) =>
    makePlaylist({ id: `PL${index}`, title: `Playlista ${index}` }),
  );
}

const video: PlaylistVideo = makeVideo({
  videoId: 'v1',
  title: 'Lofi beats',
  channelTitle: 'Lofi Girl',
});

function renderIndex(playlists: Playlist[]) {
  return renderHook(() => useVideoIndex({ playlists }), {
    wrapper: youTubeWrapper(youtube),
  });
}

beforeEach(() => {
  youtube = makeFakeYouTube();
});

describe('useVideoIndex', () => {
  it('stays idle until started', () => {
    const { result } = renderIndex(makePlaylists(2));

    expect(result.current.status).toBe('idle');
    expect(result.current.total).toBe(0);
    expect(youtube.listPlaylistVideos).not.toHaveBeenCalled();
  });

  it('reports progress and keeps the videos of each playlist', async () => {
    const pending = deferCalls();
    const { result } = renderIndex(makePlaylists(2));

    act(() => result.current.start());

    expect(result.current).toMatchObject({
      status: 'loading',
      done: 0,
      total: 2,
      failed: 0,
    });
    expect(youtube.listPlaylistVideos).toHaveBeenCalledWith('PL0');

    await act(async () => settle(pending, 'PL0', [video]));

    expect(result.current).toMatchObject({ status: 'loading', done: 1 });
    expect(result.current.videosByPlaylist.get('PL0')).toEqual([video]);

    await act(async () => settle(pending, 'PL1', []));

    expect(result.current).toMatchObject({ status: 'ready', done: 2 });
    expect(result.current.videosByPlaylist.get('PL1')).toEqual([]);
  });

  it('keeps at most 4 requests in flight', async () => {
    const pending = deferCalls();
    const { result } = renderIndex(makePlaylists(6));

    act(() => result.current.start());

    expect(youtube.listPlaylistVideos).toHaveBeenCalledTimes(4);

    await act(async () => settle(pending, 'PL1', []));

    expect(youtube.listPlaylistVideos).toHaveBeenCalledTimes(5);
    expect(youtube.listPlaylistVideos).toHaveBeenLastCalledWith('PL4');
  });

  it('counts a failed playlist and goes on', async () => {
    const pending = deferCalls();
    const { result } = renderIndex(makePlaylists(2));

    act(() => result.current.start());
    await act(async () =>
      settle(pending, 'PL0', new ApiError('notFound', 'x', 404)),
    );
    await act(async () => settle(pending, 'PL1', [video]));

    expect(result.current).toMatchObject({
      status: 'ready',
      done: 2,
      total: 2,
      failed: 1,
    });
    expect(result.current.videosByPlaylist.has('PL0')).toBe(false);
  });

  it('stops starting requests after a 401', async () => {
    const pending = deferCalls();
    const { result } = renderIndex(makePlaylists(6));

    act(() => result.current.start());
    const unauthorized = new ApiError('unauthorized', 'x', 401);
    await act(async () => settle(pending, 'PL0', unauthorized));
    // Pozostały wątek kończy swoją playlistę, ale nie może zacząć następnej
    await act(async () => settle(pending, 'PL1', []));

    expect(youtube.listPlaylistVideos).toHaveBeenCalledTimes(4);
  });

  it('fetches only once when started twice', async () => {
    youtube.listPlaylistVideos.mockResolvedValue([video]);
    const { result } = renderIndex(makePlaylists(2));

    act(() => result.current.start());
    act(() => result.current.start());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(youtube.listPlaylistVideos).toHaveBeenCalledTimes(2);
  });

  it('is ready at once for an account without playlists', () => {
    const { result } = renderIndex([]);

    act(() => result.current.start());

    expect(result.current).toMatchObject({ status: 'ready', total: 0 });
    expect(youtube.listPlaylistVideos).not.toHaveBeenCalled();
  });

  it('ignores results that arrive after unmount', async () => {
    const pending = deferCalls();
    const { result, unmount } = renderIndex(makePlaylists(5));

    act(() => result.current.start());
    unmount();
    await act(async () => settle(pending, 'PL0', [video]));

    expect(youtube.listPlaylistVideos).toHaveBeenCalledTimes(4);
  });

  it('takes the videos of a playlist changed on its profile', async () => {
    youtube.listPlaylistVideos.mockResolvedValue([video]);
    const { result } = renderIndex(makePlaylists(2));
    act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    const changed = [makeVideo({ videoId: 'v9' })];
    act(() => result.current.replaceVideos('PL1', changed));

    expect(result.current.videosByPlaylist.get('PL1')).toEqual(changed);
    expect(result.current.videosByPlaylist.get('PL0')).toEqual([video]);
    expect(result.current).toMatchObject({ status: 'ready', done: 2 });
  });
});
