import type { z } from 'zod';
import {
  apiErrorResponseSchema,
  channelListResponseSchema,
  playlistItemListResponseSchema,
  playlistItemResourceSchema,
  playlistListResponseSchema,
  playlistResourceSchema,
  type ChannelResource,
  type PlaylistItemResource,
  type PlaylistResource,
  type Thumbnails,
} from './schemas';
import {
  ApiError,
  type Channel,
  type Playlist,
  type PlaylistVideo,
  type PrivacyStatus,
} from './types';

const PLAYLISTS_URL = 'https://www.googleapis.com/youtube/v3/playlists';
const PLAYLIST_ITEMS_URL =
  'https://www.googleapis.com/youtube/v3/playlistItems';
const CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';
const QUOTA_REASONS = ['quotaExceeded', 'dailyLimitExceeded'];

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

function pickThumbnail(thumbnails: Thumbnails): string | null {
  return (
    thumbnails?.medium?.url ??
    thumbnails?.high?.url ??
    thumbnails?.default?.url ??
    null
  );
}

// `fallback` uzupełnia pola, których odpowiedź nie zawiera (PUT z part=snippet zwraca tylko snippet)
function toPlaylist(resource: PlaylistResource, fallback?: Playlist): Playlist {
  return {
    id: resource.id,
    title: resource.snippet.title,
    description: resource.snippet.description,
    defaultLanguage:
      resource.snippet.defaultLanguage ?? fallback?.defaultLanguage ?? null,
    publishedAt: resource.snippet.publishedAt,
    itemCount: resource.contentDetails?.itemCount ?? fallback?.itemCount ?? 0,
    privacyStatus:
      resource.status?.privacyStatus ?? fallback?.privacyStatus ?? 'private',
    thumbnailUrl:
      pickThumbnail(resource.snippet.thumbnails) ??
      fallback?.thumbnailUrl ??
      null,
  };
}

function toVideo(
  resource: PlaylistItemResource,
  videoId: string,
  channelTitle: string,
  available = true,
): PlaylistVideo {
  return {
    itemId: resource.id,
    videoId,
    title: resource.snippet.title,
    channelTitle,
    position: resource.snippet.position,
    thumbnailUrl: pickThumbnail(resource.snippet.thumbnails),
    videoPublishedAt: resource.contentDetails?.videoPublishedAt ?? null,
    available,
  };
}

// Tytuły, które YouTube nadaje usuniętym i prywatnym filmom na playliście
const UNAVAILABLE_TITLES = ['Deleted video', 'Private video'];

function isUnavailable(resource: PlaylistItemResource): boolean {
  return (
    resource.snippet.videoOwnerChannelTitle === undefined ||
    UNAVAILABLE_TITLES.includes(resource.snippet.title)
  );
}

export type ListVideosOptions = {
  // Profil playlisty chce też usunięte i prywatne filmy, żeby dało się je usunąć
  includeUnavailable?: boolean;
};

function parseResponse<Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
): z.output<Schema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError('unknown', 'Unexpected YouTube API response');
  }
  return result.data;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError(
      'unknown',
      'Unexpected YouTube API response',
      response.status,
    );
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorResponseSchema.safeParse(body);
  const message = parsed.success
    ? parsed.data.error.message
    : response.statusText;
  const reasons = parsed.success
    ? parsed.data.error.errors.map((item) => item.reason)
    : [];

  const reason = reasons[0] ?? null;

  if (response.status === 401) {
    return new ApiError('unauthorized', message, 401, reason);
  }
  if (response.status === 403) {
    const isQuota = reasons.some((item) => QUOTA_REASONS.includes(item));
    return new ApiError(
      isQuota ? 'quotaExceeded' : 'forbidden',
      message,
      403,
      reason,
    );
  }
  if (response.status === 404) {
    return new ApiError('notFound', message, 404, reason);
  }
  return new ApiError('unknown', message, response.status, reason);
}

async function request(
  token: string,
  url: URL,
  method: HttpMethod = 'GET',
  body?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network', 'Network request failed');
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  return response;
}

type Page<Item> = { items: Item[]; nextPageToken?: string };

// Pobiera wszystkie strony listy; `buildUrl` daje adres pierwszej strony, token kolejnych dopisujemy tutaj
async function fetchAllPages<Item>(
  token: string,
  buildUrl: () => URL,
  readPage: (data: unknown) => Page<Item>,
): Promise<Item[]> {
  const items: Item[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;

  do {
    const url = buildUrl();
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await request(token, url);
    const page = readPage(await readJson(response));
    items.push(...page.items);
    // Powtórzony token oznaczałby pętlę bez końca
    const next = page.nextPageToken;
    pageToken = next !== undefined && !seenTokens.has(next) ? next : undefined;
    if (pageToken !== undefined) {
      seenTokens.add(pageToken);
    }
  } while (pageToken);

  return items;
}

export async function listMyPlaylists(token: string): Promise<Playlist[]> {
  return fetchAllPages(
    token,
    () => {
      const url = new URL(PLAYLISTS_URL);
      url.searchParams.set('part', 'snippet,contentDetails,status');
      url.searchParams.set('mine', 'true');
      url.searchParams.set('maxResults', '50');
      return url;
    },
    (data) => {
      const page = parseResponse(playlistListResponseSchema, data);
      return {
        items: page.items.map((item) => toPlaylist(item)),
        nextPageToken: page.nextPageToken,
      };
    },
  );
}

export async function listPlaylistVideos(
  token: string,
  playlistId: string,
  options: ListVideosOptions = {},
): Promise<PlaylistVideo[]> {
  return fetchAllPages(
    token,
    () => {
      const url = new URL(PLAYLIST_ITEMS_URL);
      // contentDetails niesie datę publikacji filmu i nie kosztuje dodatkowych jednostek limitu
      url.searchParams.set('part', 'snippet,contentDetails');
      url.searchParams.set('playlistId', playlistId);
      url.searchParams.set('maxResults', '50');
      return url;
    },
    (data) => {
      const page = parseResponse(playlistItemListResponseSchema, data);
      const videos: PlaylistVideo[] = [];
      for (const item of page.items) {
        const videoId = item.snippet.resourceId.videoId;
        const channelTitle = item.snippet.videoOwnerChannelTitle;
        if (options.includeUnavailable && isUnavailable(item)) {
          videos.push(toVideo(item, videoId ?? '', '', false));
          continue;
        }
        // Bez kanału właściciela to film usunięty albo prywatny
        if (videoId !== undefined && channelTitle !== undefined) {
          videos.push(toVideo(item, videoId, channelTitle));
        }
      }
      return { items: videos, nextPageToken: page.nextPageToken };
    },
  );
}

export type PlaylistChanges = {
  title?: string;
  description?: string;
  privacyStatus?: PrivacyStatus;
};

export async function updatePlaylist(
  token: string,
  playlist: Playlist,
  changes: PlaylistChanges,
): Promise<Playlist> {
  const url = new URL(PLAYLISTS_URL);
  url.searchParams.set('part', 'snippet,status');

  // PUT nadpisuje cały snippet i status: pominięte pole (opis, język, widoczność) YouTube by wyczyścił
  const response = await request(token, url, 'PUT', {
    id: playlist.id,
    snippet: {
      title: changes.title ?? playlist.title,
      description: changes.description ?? playlist.description,
      ...(playlist.defaultLanguage !== null && {
        defaultLanguage: playlist.defaultLanguage,
      }),
    },
    status: {
      privacyStatus: changes.privacyStatus ?? playlist.privacyStatus,
    },
  });

  return toPlaylist(
    parseResponse(playlistResourceSchema, await readJson(response)),
    playlist,
  );
}

export async function deletePlaylist(
  token: string,
  playlistId: string,
): Promise<void> {
  const url = new URL(PLAYLISTS_URL);
  url.searchParams.set('id', playlistId);
  await request(token, url, 'DELETE');
}

export async function removePlaylistItem(
  token: string,
  itemId: string,
): Promise<void> {
  const url = new URL(PLAYLIST_ITEMS_URL);
  url.searchParams.set('id', itemId);
  await request(token, url, 'DELETE');
}

// playlistItems.update bez `playlistId` i `resourceId` kończy się błędem 400, sama pozycja nie wystarcza
export async function movePlaylistItem(
  token: string,
  playlistId: string,
  video: PlaylistVideo,
  newPosition: number,
): Promise<void> {
  const url = new URL(PLAYLIST_ITEMS_URL);
  url.searchParams.set('part', 'snippet');
  await request(token, url, 'PUT', {
    id: video.itemId,
    snippet: {
      playlistId,
      resourceId: { kind: 'youtube#video', videoId: video.videoId },
      position: newPosition,
    },
  });
}

export async function addPlaylistItem(
  token: string,
  playlistId: string,
  videoId: string,
): Promise<PlaylistVideo> {
  const url = new URL(PLAYLIST_ITEMS_URL);
  // `part` wyznacza też pola odpowiedzi: contentDetails zwraca datę publikacji dodanego filmu
  url.searchParams.set('part', 'snippet,contentDetails');
  const response = await request(token, url, 'POST', {
    snippet: {
      playlistId,
      resourceId: { kind: 'youtube#video', videoId },
    },
  });

  const resource = parseResponse(
    playlistItemResourceSchema,
    await readJson(response),
  );
  // Tuż po dodaniu odpowiedź bywa jeszcze bez kanału właściciela
  return toVideo(
    resource,
    resource.snippet.resourceId.videoId ?? videoId,
    resource.snippet.videoOwnerChannelTitle ?? '',
  );
}

function toCount(value: string | undefined): number {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function toChannel(resource: ChannelResource): Channel {
  const { snippet, statistics } = resource;
  const hidden =
    statistics.hiddenSubscriberCount === true ||
    statistics.subscriberCount === undefined;
  return {
    id: resource.id,
    title: snippet.title,
    handle: snippet.customUrl?.startsWith('@') ? snippet.customUrl : null,
    // Awatar ma być mały, więc najpierw najmniejszy rozmiar
    thumbnailUrl:
      snippet.thumbnails?.default?.url ??
      snippet.thumbnails?.medium?.url ??
      snippet.thumbnails?.high?.url ??
      null,
    publishedAt: snippet.publishedAt,
    subscriberCount: hidden ? null : toCount(statistics.subscriberCount),
    videoCount: toCount(statistics.videoCount),
    viewCount: toCount(statistics.viewCount),
  };
}

// Konto Google bez kanału YouTube zwraca pustą listę
export async function getMyChannel(token: string): Promise<Channel | null> {
  const url = new URL(CHANNELS_URL);
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('mine', 'true');

  const response = await request(token, url);
  const [resource] = parseResponse(
    channelListResponseSchema,
    await readJson(response),
  ).items;
  return resource === undefined ? null : toChannel(resource);
}
