import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makePlaylist } from '../test/playlistFactory';
import { makeVideo } from '../test/videoFactory';
import {
  addPlaylistItem,
  deletePlaylist,
  getPlaylist,
  listMyPlaylists,
  listPlaylistVideos,
  movePlaylistItem,
  removePlaylistItem,
  renamePlaylist,
  updatePlaylist,
} from './api';
import { ApiError } from './types';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resource(id: string) {
  return {
    kind: 'youtube#playlist',
    id,
    snippet: {
      title: `Playlist ${id}`,
      description: `Opis ${id}`,
      publishedAt: '2026-01-01T10:00:00Z',
      thumbnails: {
        default: { url: `https://i.ytimg.com/${id}/default.jpg` },
        medium: { url: `https://i.ytimg.com/${id}/mqdefault.jpg` },
      },
    },
    contentDetails: { itemCount: 3 },
    status: { privacyStatus: 'unlisted' },
  };
}

function calledUrl(callIndex: number): URL {
  return new URL(String(fetchMock.mock.calls[callIndex]?.[0]));
}

function calledInit(callIndex: number): RequestInit | undefined {
  return fetchMock.mock.calls[callIndex]?.[1];
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('listMyPlaylists', () => {
  it('fetches every page and maps resources to playlists', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ items: [resource('A')], nextPageToken: 'page-2' }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [resource('B')] }));

    const playlists = await listMyPlaylists('token-123');

    expect(playlists).toEqual([
      {
        id: 'A',
        title: 'Playlist A',
        description: 'Opis A',
        defaultLanguage: null,
        publishedAt: '2026-01-01T10:00:00Z',
        itemCount: 3,
        privacyStatus: 'unlisted',
        thumbnailUrl: 'https://i.ytimg.com/A/mqdefault.jpg',
      },
      {
        id: 'B',
        title: 'Playlist B',
        description: 'Opis B',
        defaultLanguage: null,
        publishedAt: '2026-01-01T10:00:00Z',
        itemCount: 3,
        privacyStatus: 'unlisted',
        thumbnailUrl: 'https://i.ytimg.com/B/mqdefault.jpg',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const first = calledUrl(0);
    expect(`${first.origin}${first.pathname}`).toBe(
      'https://www.googleapis.com/youtube/v3/playlists',
    );
    expect(first.searchParams.get('part')).toBe(
      'snippet,contentDetails,status',
    );
    expect(first.searchParams.get('mine')).toBe('true');
    expect(first.searchParams.get('maxResults')).toBe('50');
    expect(first.searchParams.has('pageToken')).toBe(false);
    expect(calledUrl(1).searchParams.get('pageToken')).toBe('page-2');
    expect(new Headers(calledInit(0)?.headers).get('Authorization')).toBe(
      'Bearer token-123',
    );
  });

  it('maps defaultLanguage when present', async () => {
    const withLanguage = resource('L');
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            ...withLanguage,
            snippet: { ...withLanguage.snippet, defaultLanguage: 'pl' },
          },
        ],
      }),
    );

    const [playlist] = await listMyPlaylists('t');

    expect(playlist?.defaultLanguage).toBe('pl');
  });

  it('stops when the API repeats a nextPageToken', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ items: [resource('A')], nextPageToken: 'same' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [resource('B')], nextPageToken: 'same' }),
      );

    const playlists = await listMyPlaylists('t');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(playlists).toHaveLength(2);
  });

  it('tolerates missing thumbnails and description', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: 'C',
            snippet: {
              title: 'Bez miniatur',
              publishedAt: '2026-02-02T00:00:00Z',
            },
            contentDetails: { itemCount: 0 },
            status: { privacyStatus: 'private' },
          },
        ],
      }),
    );

    const [playlist] = await listMyPlaylists('t');

    expect(playlist).toMatchObject({
      id: 'C',
      description: '',
      thumbnailUrl: null,
      itemCount: 0,
    });
  });

  it('returns an empty list when the account has no playlists', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ pageInfo: { totalResults: 0 } }),
    );
    expect(await listMyPlaylists('t')).toEqual([]);
  });

  it('rejects a non-JSON success body with an ApiError', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
    const error = await listMyPlaylists('t').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'unknown', status: 200 });
  });

  it('rejects an unexpected response shape', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ id: 1 }] }));
    await expect(listMyPlaylists('t')).rejects.toMatchObject({
      kind: 'unknown',
    });
  });
});

describe('renamePlaylist', () => {
  it('sends the new title together with the current description', async () => {
    const playlist = makePlaylist({
      id: 'P',
      title: 'Stara',
      description: 'Ważny opis',
      itemCount: 7,
      privacyStatus: 'private',
      thumbnailUrl: 'https://i.ytimg.com/P/mq.jpg',
    });
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'P',
        snippet: {
          title: 'Nowa',
          description: 'Ważny opis',
          publishedAt: playlist.publishedAt,
        },
      }),
    );

    const updated = await renamePlaylist('t', playlist, 'Nowa');

    const url = calledUrl(0);
    expect(url.pathname).toBe('/youtube/v3/playlists');
    expect(url.searchParams.get('part')).toBe('snippet,status');
    expect(calledInit(0)?.method).toBe('PUT');
    expect(new Headers(calledInit(0)?.headers).get('Content-Type')).toBe(
      'application/json',
    );
    expect(JSON.parse(String(calledInit(0)?.body))).toEqual({
      id: 'P',
      snippet: { title: 'Nowa', description: 'Ważny opis' },
      status: { privacyStatus: 'private' },
    });
    expect(updated).toEqual({ ...playlist, title: 'Nowa' });
  });
});

describe('renamePlaylist defaultLanguage', () => {
  function renameResponse() {
    return jsonResponse({
      id: 'P',
      snippet: {
        title: 'Nowa',
        description: '',
        publishedAt: '2026-01-01T10:00:00Z',
      },
    });
  }

  it('sends the current defaultLanguage', async () => {
    fetchMock.mockResolvedValueOnce(renameResponse());
    const playlist = makePlaylist({ id: 'P', defaultLanguage: 'pl' });

    const updated = await renamePlaylist('t', playlist, 'Nowa');

    expect(JSON.parse(String(calledInit(0)?.body))).toEqual({
      id: 'P',
      snippet: { title: 'Nowa', description: '', defaultLanguage: 'pl' },
      status: { privacyStatus: 'public' },
    });
    expect(updated.defaultLanguage).toBe('pl');
  });

  it('omits defaultLanguage when the playlist has none', async () => {
    fetchMock.mockResolvedValueOnce(renameResponse());

    await renamePlaylist('t', makePlaylist({ id: 'P' }), 'Nowa');

    const body: unknown = JSON.parse(String(calledInit(0)?.body));
    expect(JSON.stringify(body)).not.toContain('defaultLanguage');
  });
});

describe('deletePlaylist', () => {
  it('sends DELETE with the playlist id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deletePlaylist('t', 'PL-9');

    expect(calledInit(0)?.method).toBe('DELETE');
    expect(calledUrl(0).searchParams.get('id')).toBe('PL-9');
  });
});

describe('listPlaylistVideos', () => {
  function item(videoId: string | undefined, channel?: string, position = 0) {
    return {
      kind: 'youtube#playlistItem',
      id: `item-${videoId ?? 'none'}`,
      snippet: {
        title: `Film ${videoId ?? 'bez id'}`,
        position,
        thumbnails: {
          default: { url: `https://i.ytimg.com/vi/${videoId}/default.jpg` },
          medium: { url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` },
        },
        ...(channel !== undefined && { videoOwnerChannelTitle: channel }),
        resourceId: {
          kind: 'youtube#video',
          ...(videoId !== undefined && { videoId }),
        },
      },
    };
  }

  const v1 = {
    itemId: 'item-v1',
    videoId: 'v1',
    title: 'Film v1',
    channelTitle: 'Kanał',
    position: 0,
    thumbnailUrl: 'https://i.ytimg.com/vi/v1/mqdefault.jpg',
    available: true,
  };

  it('requests the items of one playlist', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [item('v1', 'Kanał')] }),
    );

    const videos = await listPlaylistVideos('token-9', 'PL-x');

    expect(videos).toEqual([v1]);
    const url = calledUrl(0);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.googleapis.com/youtube/v3/playlistItems',
    );
    expect(url.searchParams.get('part')).toBe('snippet');
    expect(url.searchParams.get('playlistId')).toBe('PL-x');
    expect(url.searchParams.get('maxResults')).toBe('50');
    expect(url.searchParams.has('pageToken')).toBe(false);
    expect(new Headers(calledInit(0)?.headers).get('Authorization')).toBe(
      'Bearer token-9',
    );
  });

  it('fetches every page', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ items: [item('v1', 'A')], nextPageToken: 'p2' }),
      )
      .mockResolvedValueOnce(jsonResponse({ items: [item('v2', 'B')] }));

    const videos = await listPlaylistVideos('t', 'PL-x');

    expect(videos.map((video) => video.videoId)).toEqual(['v1', 'v2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(calledUrl(1).searchParams.get('pageToken')).toBe('p2');
    expect(calledUrl(1).searchParams.get('playlistId')).toBe('PL-x');
  });

  it('stops when the API repeats a nextPageToken', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ items: [item('v1', 'A')], nextPageToken: 'same' }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: [item('v2', 'A')], nextPageToken: 'same' }),
      );

    const videos = await listPlaylistVideos('t', 'PL-x');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(videos).toHaveLength(2);
  });

  it('skips deleted and private videos', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          item('v1', 'Kanał'),
          // Usunięty albo prywatny film: brak właściciela kanału
          item('v2'),
          item(undefined, 'Kanał'),
        ],
      }),
    );

    const videos = await listPlaylistVideos('t', 'PL-x');

    expect(videos).toEqual([v1]);
  });

  it('lists unavailable videos too when asked (the playlist page)', async () => {
    const deleted = item('v-del', undefined, 1);
    const privateOne = item('v-priv', 'Kanał', 2);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          item('v1', 'Kanał'),
          // Usunięty film: bez kanału właściciela i z tytułem nadanym przez YouTube
          {
            ...deleted,
            snippet: { ...deleted.snippet, title: 'Deleted video' },
          },
          // Prywatny film rozpoznany po samym tytule
          {
            ...privateOne,
            snippet: { ...privateOne.snippet, title: 'Private video' },
          },
          item(undefined, undefined, 3),
        ],
      }),
    );

    const videos = await listPlaylistVideos('t', 'PL-x', {
      includeUnavailable: true,
    });

    expect(videos).toEqual([
      v1,
      {
        itemId: 'item-v-del',
        videoId: 'v-del',
        title: 'Deleted video',
        channelTitle: '',
        position: 1,
        thumbnailUrl: 'https://i.ytimg.com/vi/v-del/mqdefault.jpg',
        available: false,
      },
      {
        itemId: 'item-v-priv',
        videoId: 'v-priv',
        title: 'Private video',
        channelTitle: '',
        position: 2,
        thumbnailUrl: 'https://i.ytimg.com/vi/v-priv/mqdefault.jpg',
        available: false,
      },
      {
        itemId: 'item-none',
        videoId: '',
        title: 'Film bez id',
        channelTitle: '',
        position: 3,
        thumbnailUrl: 'https://i.ytimg.com/vi/undefined/mqdefault.jpg',
        available: false,
      },
    ]);
  });

  it('keeps the position from the API and tolerates missing thumbnails', async () => {
    const withoutThumbnails = item('v7', 'Kanał', 6);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            ...withoutThumbnails,
            snippet: { ...withoutThumbnails.snippet, thumbnails: undefined },
          },
        ],
      }),
    );

    const [video] = await listPlaylistVideos('t', 'PL-x');

    expect(video).toMatchObject({
      itemId: 'item-v7',
      position: 6,
      thumbnailUrl: null,
    });
  });

  it('returns an empty list for an empty playlist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ pageInfo: {} }));
    expect(await listPlaylistVideos('t', 'PL-x')).toEqual([]);
  });

  it('maps API errors to ApiError', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 404,
            message: 'Not found',
            errors: [{ reason: 'playlistNotFound' }],
          },
        },
        404,
      ),
    );

    const error = await listPlaylistVideos('t', 'PL-x').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'notFound', status: 404 });
  });
});

function notFoundResponse(): Response {
  return jsonResponse(
    {
      error: {
        code: 404,
        message: 'Not found',
        errors: [{ reason: 'playlistNotFound' }],
      },
    },
    404,
  );
}

describe('updatePlaylist', () => {
  const playlist = makePlaylist({
    id: 'P',
    title: 'Stara',
    description: 'Stary opis',
    defaultLanguage: 'pl',
    itemCount: 4,
    privacyStatus: 'public',
    thumbnailUrl: 'https://i.ytimg.com/P/mq.jpg',
  });

  it('sends every writable field, merging the changes into the current playlist', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'P',
        snippet: {
          title: 'Stara',
          description: 'Nowy opis',
          defaultLanguage: 'pl',
          publishedAt: playlist.publishedAt,
        },
        status: { privacyStatus: 'private' },
      }),
    );

    const updated = await updatePlaylist('tok-u', playlist, {
      description: 'Nowy opis',
      privacyStatus: 'private',
    });

    const url = calledUrl(0);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.googleapis.com/youtube/v3/playlists',
    );
    expect(url.searchParams.get('part')).toBe('snippet,status');
    expect(calledInit(0)?.method).toBe('PUT');
    expect(new Headers(calledInit(0)?.headers).get('Authorization')).toBe(
      'Bearer tok-u',
    );
    expect(JSON.parse(String(calledInit(0)?.body))).toEqual({
      id: 'P',
      snippet: {
        title: 'Stara',
        description: 'Nowy opis',
        defaultLanguage: 'pl',
      },
      status: { privacyStatus: 'private' },
    });
    expect(updated).toEqual({
      ...playlist,
      description: 'Nowy opis',
      privacyStatus: 'private',
    });
  });

  it('changes the title only', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'P',
        snippet: {
          title: 'Nowa',
          description: 'Stary opis',
          publishedAt: playlist.publishedAt,
        },
        status: { privacyStatus: 'public' },
      }),
    );

    await updatePlaylist('t', playlist, { title: 'Nowa' });

    expect(JSON.parse(String(calledInit(0)?.body))).toEqual({
      id: 'P',
      snippet: {
        title: 'Nowa',
        description: 'Stary opis',
        defaultLanguage: 'pl',
      },
      status: { privacyStatus: 'public' },
    });
  });

  it('rejects with notFound when the playlist is gone', async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());

    const error = await updatePlaylist('t', playlist, { title: 'X' }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'notFound', status: 404 });
  });
});

describe('getPlaylist', () => {
  it('fetches one playlist by id', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [resource('Q')] }));

    const playlist = await getPlaylist('tok-g', 'Q');

    const url = calledUrl(0);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.googleapis.com/youtube/v3/playlists',
    );
    expect(url.searchParams.get('part')).toBe('snippet,contentDetails,status');
    expect(url.searchParams.get('id')).toBe('Q');
    expect(url.searchParams.has('mine')).toBe(false);
    expect(calledInit(0)?.method).toBe('GET');
    expect(new Headers(calledInit(0)?.headers).get('Authorization')).toBe(
      'Bearer tok-g',
    );
    expect(playlist).toMatchObject({
      id: 'Q',
      title: 'Playlist Q',
      itemCount: 3,
      privacyStatus: 'unlisted',
    });
  });

  it('returns null when YouTube has no such playlist', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    expect(await getPlaylist('t', 'missing')).toBeNull();
  });

  it('rejects with notFound on 404', async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    await expect(getPlaylist('t', 'Q')).rejects.toMatchObject({
      kind: 'notFound',
      status: 404,
    });
  });
});

describe('removePlaylistItem', () => {
  it('sends DELETE with the playlist item id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await removePlaylistItem('tok-r', 'item-9');

    const url = calledUrl(0);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.googleapis.com/youtube/v3/playlistItems',
    );
    expect(url.searchParams.get('id')).toBe('item-9');
    expect(calledInit(0)?.method).toBe('DELETE');
    expect(calledInit(0)?.body).toBeUndefined();
    expect(new Headers(calledInit(0)?.headers).get('Authorization')).toBe(
      'Bearer tok-r',
    );
  });

  it('rejects with notFound on 404', async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    await expect(removePlaylistItem('t', 'item-9')).rejects.toMatchObject({
      kind: 'notFound',
    });
  });
});

describe('movePlaylistItem', () => {
  const video = makeVideo({ itemId: 'item-3', videoId: 'v3', position: 0 });

  it('sends the new position with the playlist and video ids', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'item-3' }));

    await movePlaylistItem('tok-m', 'PL-x', video, 2);

    const url = calledUrl(0);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.googleapis.com/youtube/v3/playlistItems',
    );
    expect(url.searchParams.get('part')).toBe('snippet');
    expect(calledInit(0)?.method).toBe('PUT');
    expect(new Headers(calledInit(0)?.headers).get('Content-Type')).toBe(
      'application/json',
    );
    expect(JSON.parse(String(calledInit(0)?.body))).toEqual({
      id: 'item-3',
      snippet: {
        playlistId: 'PL-x',
        resourceId: { kind: 'youtube#video', videoId: 'v3' },
        position: 2,
      },
    });
  });

  it('rejects with notFound on 404', async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    await expect(movePlaylistItem('t', 'PL-x', video, 1)).rejects.toMatchObject(
      { kind: 'notFound' },
    );
  });
});

describe('addPlaylistItem', () => {
  it('posts the video id and maps the created item', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        kind: 'youtube#playlistItem',
        id: 'item-new',
        snippet: {
          title: 'Never Gonna Give You Up',
          position: 3,
          thumbnails: {
            default: { url: 'https://i.ytimg.com/vi/x/default.jpg' },
          },
          resourceId: { kind: 'youtube#video', videoId: 'dQw4w9WgXcQ' },
        },
      }),
    );

    const added = await addPlaylistItem('tok-a', 'PL-x', 'dQw4w9WgXcQ');

    const url = calledUrl(0);
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://www.googleapis.com/youtube/v3/playlistItems',
    );
    expect(url.searchParams.get('part')).toBe('snippet');
    expect(calledInit(0)?.method).toBe('POST');
    expect(new Headers(calledInit(0)?.headers).get('Authorization')).toBe(
      'Bearer tok-a',
    );
    expect(JSON.parse(String(calledInit(0)?.body))).toEqual({
      snippet: {
        playlistId: 'PL-x',
        resourceId: { kind: 'youtube#video', videoId: 'dQw4w9WgXcQ' },
      },
    });
    // Tuż po dodaniu YouTube bywa, że nie zwraca jeszcze kanału właściciela
    expect(added).toEqual({
      itemId: 'item-new',
      videoId: 'dQw4w9WgXcQ',
      title: 'Never Gonna Give You Up',
      channelTitle: '',
      position: 3,
      thumbnailUrl: 'https://i.ytimg.com/vi/x/default.jpg',
      available: true,
    });
  });

  it('keeps the channel when YouTube returns it', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 'item-new',
        snippet: {
          title: 'Film',
          position: 0,
          videoOwnerChannelTitle: 'Kanał',
          resourceId: { videoId: 'abcdefghijk' },
        },
      }),
    );

    const added = await addPlaylistItem('t', 'PL-x', 'abcdefghijk');

    expect(added.channelTitle).toBe('Kanał');
    expect(added.thumbnailUrl).toBeNull();
  });

  it('rejects with notFound on 404', async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    const error = await addPlaylistItem('t', 'PL-x', 'abcdefghijk').catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'notFound', status: 404 });
  });
});

describe('API errors', () => {
  function errorBody(reason: string) {
    return {
      error: {
        code: 0,
        message: 'API error',
        errors: [{ reason, message: 'API error' }],
      },
    };
  }

  const cases: [number, string, string][] = [
    [401, 'authError', 'unauthorized'],
    [403, 'quotaExceeded', 'quotaExceeded'],
    [403, 'dailyLimitExceeded', 'quotaExceeded'],
    [403, 'insufficientPermissions', 'forbidden'],
    [404, 'playlistNotFound', 'notFound'],
    [500, 'backendError', 'unknown'],
  ];

  it.each(cases)('maps HTTP %i (%s) to %s', async (status, reason, kind) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(errorBody(reason), status));

    const error = await deletePlaylist('t', 'X').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind, status, reason });
  });

  it('keeps the first reason from the API body', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 404,
            message: 'Video not found.',
            errors: [{ reason: 'videoNotFound' }, { reason: 'other' }],
          },
        },
        404,
      ),
    );

    const error = await addPlaylistItem('t', 'PL-x', '00000000000').catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'notFound',
      status: 404,
      reason: 'videoNotFound',
    });
  });

  it('maps a non-JSON error body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    await expect(deletePlaylist('t', 'X')).rejects.toMatchObject({
      kind: 'unknown',
      status: 502,
      reason: null,
    });
  });

  it('keeps ApiError backward compatible without a reason', () => {
    expect(new ApiError('network', 'offline')).toMatchObject({
      status: null,
      reason: null,
    });
  });

  it('maps a failed fetch to a network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(listMyPlaylists('t')).rejects.toMatchObject({
      kind: 'network',
      status: null,
    });
  });
});
