import type { z } from 'zod';
import {
  apiErrorResponseSchema,
  playlistListResponseSchema,
  playlistResourceSchema,
  type PlaylistResource,
} from './schemas';
import { ApiError, type Playlist } from './types';

const PLAYLISTS_URL = 'https://www.googleapis.com/youtube/v3/playlists';
const QUOTA_REASONS = ['quotaExceeded', 'dailyLimitExceeded'];

type HttpMethod = 'GET' | 'PUT' | 'DELETE';

// `fallback` uzupełnia pola, których odpowiedź nie zawiera (PUT z part=snippet zwraca tylko snippet)
function toPlaylist(resource: PlaylistResource, fallback?: Playlist): Playlist {
  const thumbnails = resource.snippet.thumbnails;
  return {
    id: resource.id,
    title: resource.snippet.title,
    description: resource.snippet.description,
    publishedAt: resource.snippet.publishedAt,
    itemCount: resource.contentDetails?.itemCount ?? fallback?.itemCount ?? 0,
    privacyStatus:
      resource.status?.privacyStatus ?? fallback?.privacyStatus ?? 'private',
    thumbnailUrl:
      thumbnails?.medium?.url ??
      thumbnails?.high?.url ??
      thumbnails?.default?.url ??
      fallback?.thumbnailUrl ??
      null,
  };
}

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

async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorResponseSchema.safeParse(body);
  const message = parsed.success
    ? parsed.data.error.message
    : response.statusText;
  const reasons = parsed.success
    ? parsed.data.error.errors.map((item) => item.reason)
    : [];

  if (response.status === 401) {
    return new ApiError('unauthorized', message, 401);
  }
  if (response.status === 403) {
    const isQuota = reasons.some((reason) => QUOTA_REASONS.includes(reason));
    return new ApiError(isQuota ? 'quotaExceeded' : 'forbidden', message, 403);
  }
  if (response.status === 404) {
    return new ApiError('notFound', message, 404);
  }
  return new ApiError('unknown', message, response.status);
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

export async function listMyPlaylists(token: string): Promise<Playlist[]> {
  const playlists: Playlist[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(PLAYLISTS_URL);
    url.searchParams.set('part', 'snippet,contentDetails,status');
    url.searchParams.set('mine', 'true');
    url.searchParams.set('maxResults', '50');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await request(token, url);
    const page = parseResponse(
      playlistListResponseSchema,
      await response.json(),
    );
    playlists.push(...page.items.map((item) => toPlaylist(item)));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return playlists;
}

export async function renamePlaylist(
  token: string,
  playlist: Playlist,
  newTitle: string,
): Promise<Playlist> {
  const url = new URL(PLAYLISTS_URL);
  url.searchParams.set('part', 'snippet');

  // PUT nadpisuje cały snippet: bez opisu YouTube by go wyczyścił
  const response = await request(token, url, 'PUT', {
    id: playlist.id,
    snippet: { title: newTitle, description: playlist.description },
  });

  return toPlaylist(
    parseResponse(playlistResourceSchema, await response.json()),
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
