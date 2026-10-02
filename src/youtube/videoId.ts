const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
]);
const PATH_PREFIXES = ['shorts', 'embed'];

function toUrl(input: string): URL | null {
  // Link wklejony bez protokołu (`youtu.be/...`) też ma działać
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

function idFromUrl(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    return segments.length === 1 ? (segments[0] ?? null) : null;
  }
  if (!YOUTUBE_HOSTS.has(host)) {
    return null;
  }
  if (segments.length === 1 && segments[0] === 'watch') {
    return url.searchParams.get('v');
  }
  const [prefix, id] = segments;
  if (
    segments.length === 2 &&
    prefix !== undefined &&
    PATH_PREFIXES.includes(prefix)
  ) {
    return id ?? null;
  }
  return null;
}

// Przyjmuje samo ID filmu albo link watch, youtu.be, shorts lub embed; inaczej null
export function parseVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (VIDEO_ID.test(trimmed)) {
    return trimmed;
  }
  const url = toUrl(trimmed);
  if (url === null) {
    return null;
  }
  const id = idFromUrl(url);
  return id !== null && VIDEO_ID.test(id) ? id : null;
}
