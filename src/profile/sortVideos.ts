import type { SortDirection } from '../sorting/types';
import type { PlaylistVideo } from '../youtube/types';

export type VideoSortKey = 'position' | 'title' | 'channel' | 'published';
export type VideoSort = { key: VideoSortKey; direction: SortDirection };

// Wartość opcji w liście wyboru sortowania
export type VideoSortOption = `${VideoSortKey}-${SortDirection}`;

// Kolejność z playlisty: tylko w niej przenoszenie filmów ma sens
export const DEFAULT_VIDEO_SORT: VideoSort = {
  key: 'position',
  direction: 'asc',
};

// Kolejność w liście wyboru: w każdej parze najpierw kierunek, od którego zaczyna kliknięcie w nagłówek
export const VIDEO_SORT_OPTIONS: readonly VideoSort[] = [
  { key: 'position', direction: 'asc' },
  { key: 'position', direction: 'desc' },
  { key: 'title', direction: 'asc' },
  { key: 'title', direction: 'desc' },
  { key: 'channel', direction: 'asc' },
  { key: 'channel', direction: 'desc' },
  { key: 'published', direction: 'desc' },
  { key: 'published', direction: 'asc' },
];

export function videoSortId(sort: VideoSort): VideoSortOption {
  return `${sort.key}-${sort.direction}`;
}

export function isPlaylistOrder(sort: VideoSort): boolean {
  return sort.key === 'position' && sort.direction === 'asc';
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'pl', { sensitivity: 'base' });
}

// Wartość, po której sortuje kolumna; null, gdy film jej nie ma (niedostępny, bez kanału, bez daty)
const VALUES: Record<
  Exclude<VideoSortKey, 'position'>,
  (video: PlaylistVideo) => string | null
> = {
  title: (video) => (video.available ? video.title : null),
  channel: (video) =>
    video.available && video.channelTitle !== '' ? video.channelTitle : null,
  published: (video) => video.videoPublishedAt,
};

const COMPARATORS: Record<
  Exclude<VideoSortKey, 'position'>,
  (a: string, b: string) => number
> = {
  title: compareText,
  channel: compareText,
  published: (a, b) => Date.parse(a) - Date.parse(b),
};

export function sortVideos(
  videos: readonly PlaylistVideo[],
  sort: VideoSort,
): PlaylistVideo[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  if (sort.key === 'position') {
    return [...videos].sort((a, b) => sign * (a.position - b.position));
  }
  const valueOf = VALUES[sort.key];
  const compare = COMPARATORS[sort.key];
  return [...videos].sort((a, b) => {
    const left = valueOf(a);
    const right = valueOf(b);
    // Filmy bez wartości zawsze na końcu, niezależnie od kierunku
    if (left === null || right === null) {
      return (
        Number(left === null) - Number(right === null) ||
        a.position - b.position
      );
    }
    // Remisy zawsze w kolejności z playlisty
    return sign * compare(left, right) || a.position - b.position;
  });
}

// Klucze, które po pierwszym kliknięciu sortują rosnąco; data zaczyna od najnowszych
const ASCENDING_FIRST: readonly VideoSortKey[] = [
  'position',
  'title',
  'channel',
];

export function nextVideoSort(
  current: VideoSort,
  key: VideoSortKey,
): VideoSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: ASCENDING_FIRST.includes(key) ? 'asc' : 'desc' };
}
