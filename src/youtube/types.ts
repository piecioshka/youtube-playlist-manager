export type PrivacyStatus = 'public' | 'unlisted' | 'private';

export type Playlist = {
  id: string;
  title: string;
  description: string;
  defaultLanguage: string | null;
  publishedAt: string;
  itemCount: number;
  privacyStatus: PrivacyStatus;
  thumbnailUrl: string | null;
};

export type Channel = {
  id: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  // null, gdy kanał ukrywa liczbę subskrypcji
  subscriberCount: number | null;
  videoCount: number;
  viewCount: number;
};

// `itemId` to id elementu playlisty (playlistItem), potrzebny do usuwania i przesuwania
export type PlaylistVideo = {
  itemId: string;
  videoId: string;
  title: string;
  channelTitle: string;
  position: number;
  thumbnailUrl: string | null;
  // false dla usuniętego albo prywatnego filmu: zostaje na playliście, ale nie da się go obejrzeć
  available: boolean;
};

export type ApiErrorKind =
  | 'unauthorized'
  | 'quotaExceeded'
  | 'forbidden'
  | 'notFound'
  | 'network'
  | 'unknown';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  // Pierwszy `error.errors[].reason` z odpowiedzi API, np. `videoNotFound`
  readonly reason: string | null;

  constructor(
    kind: ApiErrorKind,
    message: string,
    status: number | null = null,
    reason: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.reason = reason;
  }
}
