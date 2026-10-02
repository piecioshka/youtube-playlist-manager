export type Route = { name: 'list' } | { name: 'playlist'; id: string };

const LIST: Route = { name: 'list' };
const PLAYLIST_PREFIX = '#/playlists/';

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

// Nieznany albo uszkodzony adres prowadzi do listy, nigdy do pustego ekranu
export function parseRoute(hash: string): Route {
  if (!hash.startsWith(PLAYLIST_PREFIX)) {
    return LIST;
  }
  const encodedId = hash.slice(PLAYLIST_PREFIX.length);
  if (encodedId === '' || encodedId.includes('/')) {
    return LIST;
  }
  const id = decode(encodedId);
  return id === null ? LIST : { name: 'playlist', id };
}

export function routeToHash(route: Route): string {
  return route.name === 'playlist'
    ? `${PLAYLIST_PREFIX}${encodeURIComponent(route.id)}`
    : '#/';
}
