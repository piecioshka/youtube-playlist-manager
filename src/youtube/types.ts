export type PrivacyStatus = 'public' | 'unlisted' | 'private';

export type Playlist = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  itemCount: number;
  privacyStatus: PrivacyStatus;
  thumbnailUrl: string | null;
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

  constructor(
    kind: ApiErrorKind,
    message: string,
    status: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}
