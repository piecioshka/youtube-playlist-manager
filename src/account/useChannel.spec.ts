import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyChannel } from '../youtube/api';
import { ApiError, type Channel } from '../youtube/types';
import { useChannel } from './useChannel';

vi.mock('../youtube/api', () => ({ getMyChannel: vi.fn() }));

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
  vi.mocked(getMyChannel).mockReset();
});

describe('useChannel', () => {
  it('starts loading and then exposes the channel', async () => {
    vi.mocked(getMyChannel).mockResolvedValue(channel);
    const { result } = renderHook(() =>
      useChannel({ token: 'tok', onUnauthorized: vi.fn() }),
    );
    expect(result.current).toEqual({ status: 'loading', channel: null });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.channel).toEqual(channel);
    expect(getMyChannel).toHaveBeenCalledWith('tok');
  });

  it('is ready with no channel for an account without one', async () => {
    vi.mocked(getMyChannel).mockResolvedValue(null);
    const { result } = renderHook(() =>
      useChannel({ token: 'tok', onUnauthorized: vi.fn() }),
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.channel).toBeNull();
  });

  it('fetches once per token, not on rerender', async () => {
    vi.mocked(getMyChannel).mockResolvedValue(channel);
    const { result, rerender } = renderHook(
      ({ token }) => useChannel({ token, onUnauthorized: vi.fn() }),
      { initialProps: { token: 'a' } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ token: 'a' });
    expect(getMyChannel).toHaveBeenCalledTimes(1);
    rerender({ token: 'b' });
    await waitFor(() => expect(getMyChannel).toHaveBeenCalledTimes(2));
  });

  it('calls onUnauthorized on a 401', async () => {
    vi.mocked(getMyChannel).mockRejectedValue(
      new ApiError('unauthorized', 'no', 401),
    );
    const onUnauthorized = vi.fn();
    renderHook(() => useChannel({ token: 'tok', onUnauthorized }));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
  });

  it('becomes unavailable on any other error', async () => {
    vi.mocked(getMyChannel).mockRejectedValue(new ApiError('network', 'down'));
    const onUnauthorized = vi.fn();
    const { result } = renderHook(() =>
      useChannel({ token: 'tok', onUnauthorized }),
    );
    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.channel).toBeNull();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ignores a result that arrives after unmount', async () => {
    let resolve: (value: Channel | null) => void = () => undefined;
    vi.mocked(getMyChannel).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result, unmount } = renderHook(() =>
      useChannel({ token: 'tok', onUnauthorized: vi.fn() }),
    );
    unmount();
    resolve(channel);
    await Promise.resolve();
    expect(result.current.status).toBe('loading');
  });
});
