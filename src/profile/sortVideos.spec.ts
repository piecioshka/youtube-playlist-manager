import { describe, expect, it } from 'vitest';
import { makeVideo } from '../test/videoFactory';
import {
  DEFAULT_VIDEO_SORT,
  isPlaylistOrder,
  nextVideoSort,
  sortVideos,
  VIDEO_SORT_OPTIONS,
  videoSortId,
  type VideoSort,
} from './sortVideos';

const zebra = makeVideo({
  videoId: 'zebra',
  title: 'Zebra',
  channelTitle: 'Beta',
  position: 0,
  videoPublishedAt: '2020-01-01T00:00:00Z',
  durationSeconds: 600,
});
const cma = makeVideo({
  videoId: 'cma',
  title: 'Ćma',
  channelTitle: 'alfa',
  position: 1,
  videoPublishedAt: '2024-06-01T00:00:00Z',
  durationSeconds: 45,
});
const gone = makeVideo({
  videoId: 'gone',
  title: 'Deleted video',
  channelTitle: '',
  position: 2,
  available: false,
});
const cytryna = makeVideo({
  videoId: 'cytryna',
  title: 'cytryna',
  channelTitle: 'Beta',
  position: 3,
  videoPublishedAt: '2016-03-03T00:00:00Z',
  durationSeconds: 3723,
});
const videos = [zebra, cma, gone, cytryna];

function ids(sort: VideoSort): string[] {
  return sortVideos(videos, sort).map((video) => video.videoId);
}

describe('sortVideos', () => {
  it('keeps the playlist order by default and does not touch the input', () => {
    const sorted = sortVideos(videos, DEFAULT_VIDEO_SORT);

    expect(sorted).toEqual(videos);
    expect(sorted).not.toBe(videos);
  });

  it('reverses the playlist order', () => {
    expect(ids({ key: 'position', direction: 'desc' })).toEqual([
      'cytryna',
      'gone',
      'cma',
      'zebra',
    ]);
  });

  it('sorts titles with Polish collation and keeps unavailable videos last', () => {
    expect(ids({ key: 'title', direction: 'asc' })).toEqual([
      'cytryna',
      'cma',
      'zebra',
      'gone',
    ]);
    expect(ids({ key: 'title', direction: 'desc' })).toEqual([
      'zebra',
      'cma',
      'cytryna',
      'gone',
    ]);
  });

  it('sorts by channel, breaks ties with the playlist position and keeps a missing channel last', () => {
    expect(ids({ key: 'channel', direction: 'asc' })).toEqual([
      'cma',
      'zebra',
      'cytryna',
      'gone',
    ]);
    expect(ids({ key: 'channel', direction: 'desc' })).toEqual([
      'zebra',
      'cytryna',
      'cma',
      'gone',
    ]);
  });

  it('sorts by publish date and keeps videos without a date last', () => {
    expect(ids({ key: 'published', direction: 'desc' })).toEqual([
      'cma',
      'zebra',
      'cytryna',
      'gone',
    ]);
    expect(ids({ key: 'published', direction: 'asc' })).toEqual([
      'cytryna',
      'zebra',
      'cma',
      'gone',
    ]);
  });
});

describe('sortVideos by duration', () => {
  it('sorts by length and keeps videos without a known duration last', () => {
    expect(ids({ key: 'duration', direction: 'desc' })).toEqual([
      'cytryna',
      'zebra',
      'cma',
      'gone',
    ]);
    expect(ids({ key: 'duration', direction: 'asc' })).toEqual([
      'cma',
      'zebra',
      'cytryna',
      'gone',
    ]);
  });
});

describe('nextVideoSort', () => {
  it('starts each column in its natural direction and flips on a second click', () => {
    expect(nextVideoSort(DEFAULT_VIDEO_SORT, 'title')).toEqual({
      key: 'title',
      direction: 'asc',
    });
    expect(nextVideoSort(DEFAULT_VIDEO_SORT, 'published')).toEqual({
      key: 'published',
      direction: 'desc',
    });
    expect(nextVideoSort(DEFAULT_VIDEO_SORT, 'duration')).toEqual({
      key: 'duration',
      direction: 'desc',
    });
    expect(nextVideoSort(DEFAULT_VIDEO_SORT, 'position')).toEqual({
      key: 'position',
      direction: 'desc',
    });
    expect(nextVideoSort({ key: 'title', direction: 'asc' }, 'title')).toEqual({
      key: 'title',
      direction: 'desc',
    });
  });
});

describe('video sort options', () => {
  it('names every option and knows which one is the playlist order', () => {
    expect(VIDEO_SORT_OPTIONS.map(videoSortId)).toEqual([
      'position-asc',
      'position-desc',
      'title-asc',
      'title-desc',
      'channel-asc',
      'channel-desc',
      'published-desc',
      'published-asc',
      'duration-desc',
      'duration-asc',
    ]);
    expect(VIDEO_SORT_OPTIONS.filter(isPlaylistOrder)).toEqual([
      DEFAULT_VIDEO_SORT,
    ]);
  });
});
