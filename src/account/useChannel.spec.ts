import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeFakeYouTube, type FakeYouTube } from '../test/fakeYouTube';
import { youTubeWrapper } from '../test/renderWithYouTube';
import { ApiError, type Channel } from '../youtube/types';
import { useChannel } from './useChannel';

let youtube: FakeYouTube;

const channel: Channel = {
  id: 'UC-me',
  title: 'Mój kanał',
  handle: '@mojkanal',
  thumbnailUrl: null,
  publishedAt: '2012-03-04T10:00:00Z',
  subscriberCount: 1234,
  videoCount: 56,
  viewCount: 7890123,
};

beforeEach(() => {
  youtube = makeFakeYouTube();
});

describe('useChannel', () => {
  it('starts loading and then exposes the channel', async () => {
    youtube.getMyChannel.mockResolvedValue(channel);
    const { result } = renderHook(() => useChannel(), {
      wrapper: youTubeWrapper(youtube),
    });
    expect(result.current).toEqual({ status: 'loading', channel: null });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.channel).toEqual(channel);
    expect(youtube.getMyChannel).toHaveBeenCalledTimes(1);
  });

  it('is ready with no channel for an account without one', async () => {
    youtube.getMyChannel.mockResolvedValue(null);
    const { result } = renderHook(() => useChannel(), {
      wrapper: youTubeWrapper(youtube),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.channel).toBeNull();
  });

  it('fetches once, not on rerender', async () => {
    youtube.getMyChannel.mockResolvedValue(channel);
    const { result, rerender } = renderHook(() => useChannel(), {
      wrapper: youTubeWrapper(youtube),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender();
    expect(youtube.getMyChannel).toHaveBeenCalledTimes(1);
  });

  it('becomes unavailable on a 401 like on any other error', async () => {
    youtube.getMyChannel.mockRejectedValue(
      new ApiError('unauthorized', 'no', 401),
    );
    const { result } = renderHook(() => useChannel(), {
      wrapper: youTubeWrapper(youtube),
    });
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.channel).toBeNull();
  });

  it('becomes unavailable on any other error', async () => {
    youtube.getMyChannel.mockRejectedValue(new ApiError('network', 'down'));
    const { result } = renderHook(() => useChannel(), {
      wrapper: youTubeWrapper(youtube),
    });
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.channel).toBeNull();
  });

  it('ignores a result that arrives after unmount', async () => {
    let resolve: (value: Channel | null) => void = () => undefined;
    youtube.getMyChannel.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result, unmount } = renderHook(() => useChannel(), {
      wrapper: youTubeWrapper(youtube),
    });
    unmount();
    resolve(channel);
    await Promise.resolve();
    expect(result.current.status).toBe('loading');
  });
});
