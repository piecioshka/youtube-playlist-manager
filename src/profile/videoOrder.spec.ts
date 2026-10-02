import { describe, expect, it } from 'vitest';
import { makeVideo } from '../test/videoFactory';
import type { PlaylistVideo } from '../youtube/types';
import { removeVideo, moveVideos } from './videoOrder';

function summary(videos: PlaylistVideo[]): string[] {
  return videos.map((video) => `${video.videoId}@${video.position}`);
}

const a = makeVideo({ videoId: 'a', position: 0 });
const b = makeVideo({ videoId: 'b', position: 1 });
const c = makeVideo({ videoId: 'c', position: 2 });

describe('moveVideos', () => {
  it('moves a video several places down and shifts the ones it passes', () => {
    expect(summary(moveVideos([a, b, c], 0, 2))).toEqual(['b@0', 'c@1', 'a@2']);
  });

  it('moves a video several places up and shifts the ones it passes', () => {
    expect(summary(moveVideos([a, b, c], 2, 0))).toEqual(['c@0', 'a@1', 'b@2']);
  });

  it('returns the list when the index does not change', () => {
    expect(summary(moveVideos([a, b, c], 1, 1))).toEqual(['a@0', 'b@1', 'c@2']);
  });

  it('moves a video one place down', () => {
    expect(summary(moveVideos([a, b, c], 0, 1))).toEqual(['b@0', 'a@1', 'c@2']);
  });

  it('moves a video one place up', () => {
    expect(summary(moveVideos([a, b, c], 2, 1))).toEqual(['a@0', 'c@1', 'b@2']);
  });

  // Pozycje z YouTube liczą też ukryte (usunięte, prywatne) filmy, których lista nie pokazuje
  it('keeps YouTube positions when hidden videos sit in between', () => {
    const first = makeVideo({ videoId: 'x', position: 0 });
    const afterHidden = makeVideo({ videoId: 'y', position: 2 });

    expect(summary(moveVideos([first, afterHidden], 0, 1))).toEqual([
      'y@1',
      'x@2',
    ]);
    expect(summary(moveVideos([first, afterHidden], 1, 0))).toEqual([
      'y@0',
      'x@1',
    ]);
  });

  it('returns the same list for an index out of range', () => {
    const videos = [a, b];
    expect(moveVideos(videos, 1, 2)).toBe(videos);
    expect(moveVideos(videos, 0, -1)).toBe(videos);
  });
});

describe('removeVideo', () => {
  it('drops the video and closes the gap in positions', () => {
    expect(summary(removeVideo([a, b, c], b.itemId))).toEqual(['a@0', 'c@1']);
  });

  it('returns the same list for an unknown item', () => {
    const videos = [a, b];
    expect(removeVideo(videos, 'nope')).toBe(videos);
  });
});
