import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import { makeVideo } from '../test/videoFactory';
import {
  addPlaylistItem,
  deletePlaylist,
  getMyChannel,
  listMyPlaylists,
  listPlaylistVideos,
  listVideoDurations,
  movePlaylistItem,
  removePlaylistItem,
  updatePlaylist,
} from './api';
import { createYouTubeSession } from './session';
import { ApiError } from './types';

vi.mock('./api', () => ({
  addPlaylistItem: vi.fn(),
  deletePlaylist: vi.fn(),
  getMyChannel: vi.fn(),
  listMyPlaylists: vi.fn(),
  listPlaylistVideos: vi.fn(),
  listVideoDurations: vi.fn(),
  movePlaylistItem: vi.fn(),
  removePlaylistItem: vi.fn(),
  updatePlaylist: vi.fn(),
}));

const playlist = makePlaylist({ id: 'PL1', title: 'Zupa' });
const video = makeVideo({ videoId: 'v1' });
const unauthorized = () => new ApiError('unauthorized', 'expired', 401);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createYouTubeSession', () => {
  it('passes the token to every API call', async () => {
    vi.mocked(listMyPlaylists).mockResolvedValue([playlist]);
    vi.mocked(updatePlaylist).mockResolvedValue(playlist);
    vi.mocked(deletePlaylist).mockResolvedValue(undefined);
    vi.mocked(listPlaylistVideos).mockResolvedValue([video]);
    vi.mocked(addPlaylistItem).mockResolvedValue(video);
    vi.mocked(movePlaylistItem).mockResolvedValue(undefined);
    vi.mocked(removePlaylistItem).mockResolvedValue(undefined);
    vi.mocked(getMyChannel).mockResolvedValue(null);
    const session = createYouTubeSession('tok', vi.fn());

    expect(await session.listMyPlaylists()).toEqual([playlist]);
    await session.updatePlaylist(playlist, { title: 'Rosół' });
    await session.deletePlaylist('PL1');
    await session.listPlaylistVideos('PL1', { includeUnavailable: true });
    vi.mocked(listVideoDurations).mockResolvedValue(new Map([['v1', 60]]));
    expect(await session.listVideoDurations(['v1'])).toEqual(
      new Map([['v1', 60]]),
    );
    expect(listVideoDurations).toHaveBeenCalledWith('tok', ['v1']);
    await session.addPlaylistItem('PL1', 'v1');
    await session.movePlaylistItem('PL1', video, 2);
    await session.removePlaylistItem('item-v1');
    await session.getMyChannel();

    expect(listMyPlaylists).toHaveBeenCalledWith('tok');
    expect(updatePlaylist).toHaveBeenCalledWith('tok', playlist, {
      title: 'Rosół',
    });
    expect(deletePlaylist).toHaveBeenCalledWith('tok', 'PL1');
    expect(listPlaylistVideos).toHaveBeenCalledWith('tok', 'PL1', {
      includeUnavailable: true,
    });
    expect(addPlaylistItem).toHaveBeenCalledWith('tok', 'PL1', 'v1');
    expect(movePlaylistItem).toHaveBeenCalledWith('tok', 'PL1', video, 2);
    expect(removePlaylistItem).toHaveBeenCalledWith('tok', 'item-v1');
    expect(getMyChannel).toHaveBeenCalledWith('tok');
  });

  it('reports an expired session and still rejects', async () => {
    vi.mocked(listMyPlaylists).mockRejectedValue(unauthorized());
    const onUnauthorized = vi.fn();
    const session = createYouTubeSession('tok', onUnauthorized);

    await expect(session.listMyPlaylists()).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reports several parallel 401 answers only once', async () => {
    vi.mocked(listPlaylistVideos).mockRejectedValue(unauthorized());
    vi.mocked(getMyChannel).mockRejectedValue(unauthorized());
    const onUnauthorized = vi.fn();
    const session = createYouTubeSession('tok', onUnauthorized);

    await Promise.allSettled([
      session.listPlaylistVideos('PL1'),
      session.listPlaylistVideos('PL2'),
      session.getMyChannel(),
    ]);

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('leaves other errors to the caller', async () => {
    vi.mocked(deletePlaylist).mockRejectedValue(
      new ApiError('forbidden', 'no', 403),
    );
    const onUnauthorized = vi.fn();
    const session = createYouTubeSession('tok', onUnauthorized);

    await expect(session.deletePlaylist('PL1')).rejects.toMatchObject({
      kind: 'forbidden',
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
