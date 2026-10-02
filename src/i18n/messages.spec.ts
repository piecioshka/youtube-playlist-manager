import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE, LOCALES, messages } from './messages';

type Mismatch = { path: string; problem: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Porównuje kształt słowników: te same klucze i te same typy wartości na każdym poziomie
function compareShape(
  reference: Record<string, unknown>,
  other: Record<string, unknown>,
  prefix = '',
): Mismatch[] {
  const keys = new Set([...Object.keys(reference), ...Object.keys(other)]);
  return [...keys].flatMap((key): Mismatch[] => {
    const path = `${prefix}${key}`;
    if (!(key in other)) {
      return [{ path, problem: 'missing in en' }];
    }
    if (!(key in reference)) {
      return [{ path, problem: 'missing in pl' }];
    }
    const expected = reference[key];
    const actual = other[key];
    if (typeof expected !== typeof actual) {
      return [{ path, problem: `${typeof expected} vs ${typeof actual}` }];
    }
    if (isRecord(expected) && isRecord(actual)) {
      return compareShape(expected, actual, `${path}.`);
    }
    return [];
  });
}

function stringValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (isRecord(value)) {
    return Object.values(value).flatMap(stringValues);
  }
  return [];
}

describe('messages', () => {
  it('offers Polish and English with Polish as default', () => {
    expect(LOCALES).toEqual(['pl', 'en']);
    expect(DEFAULT_LOCALE).toBe('pl');
  });

  it('has the same keys and value types in both locales', () => {
    expect(compareShape(messages.pl, messages.en)).toEqual([]);
  });

  it('has no empty strings', () => {
    for (const locale of LOCALES) {
      expect(stringValues(messages[locale])).not.toContain('');
    }
  });

  it('keeps the app title in both locales', () => {
    expect(messages.pl.appTitle).toBe('YouTube Playlist Manager');
    expect(messages.en.appTitle).toBe('YouTube Playlist Manager');
  });

  it('labels privacy statuses', () => {
    expect(messages.pl.privacy).toEqual({
      public: 'Publiczna',
      unlisted: 'Niepubliczna',
      private: 'Prywatna',
    });
    expect(messages.en.privacy).toEqual({
      public: 'Public',
      unlisted: 'Unlisted',
      private: 'Private',
    });
  });

  it('formats the playlists heading', () => {
    expect(messages.pl.playlistsHeadingAll(4)).toBe('Twoje playlisty (4)');
    expect(messages.pl.playlistsHeadingFiltered(1, 4)).toBe(
      'Twoje playlisty (1 z 4)',
    );
    expect(messages.en.playlistsHeadingAll(4)).toBe('Your playlists (4)');
    expect(messages.en.playlistsHeadingFiltered(1, 4)).toBe(
      'Your playlists (1 of 4)',
    );
  });

  it('announces a deleted playlist', () => {
    expect(messages.pl.playlistDeleted('Muzyka')).toBe(
      'Usunięto playlistę „Muzyka”.',
    );
    expect(messages.en.playlistDeleted('Muzyka')).toBe(
      'Playlist "Muzyka" deleted.',
    );
  });

  it.each([
    [1, 'i jeszcze 1 pasujący film'],
    [2, 'i jeszcze 2 pasujące filmy'],
    [4, 'i jeszcze 4 pasujące filmy'],
    [5, 'i jeszcze 5 pasujących filmów'],
    [12, 'i jeszcze 12 pasujących filmów'],
    [22, 'i jeszcze 22 pasujące filmy'],
  ])('Polish: %i more videos -> %s', (count, expected) => {
    expect(messages.pl.moreMatchingVideos(count)).toBe(expected);
  });

  it.each([
    [1, 'and 1 more matching video'],
    [2, 'and 2 more matching videos'],
    [12, 'and 12 more matching videos'],
  ])('English: %i more videos -> %s', (count, expected) => {
    expect(messages.en.moreMatchingVideos(count)).toBe(expected);
  });

  it.each([
    [0, '0 filmów'],
    [1, '1 film'],
    [2, '2 filmy'],
    [4, '4 filmy'],
    [5, '5 filmów'],
    [12, '12 filmów'],
    [22, '22 filmy'],
    [25, '25 filmów'],
  ])('Polish: %i videos -> %s', (count, expected) => {
    expect(messages.pl.videoCount(count)).toBe(expected);
  });

  it('counts videos in English', () => {
    expect(messages.en.videoCount(1)).toBe('1 video');
    expect(messages.en.videoCount(3)).toBe('3 videos');
  });

  it('labels the profile videos heading', () => {
    expect(messages.pl.videosHeading(3)).toBe('Filmy (3)');
    expect(messages.en.videosHeading(3)).toBe('Videos (3)');
  });

  it('asks before removing a video', () => {
    expect(messages.pl.removeVideoQuestion('Rain')).toBe(
      'Usunąć film „Rain” z playlisty?',
    );
    expect(messages.en.removeVideoQuestion('Rain')).toBe(
      'Remove video "Rain" from the playlist?',
    );
  });

  it.each([
    [1, 'Usunąć 1 niedostępny film z playlisty?'],
    [2, 'Usunąć 2 niedostępne filmy z playlisty?'],
    [5, 'Usunąć 5 niedostępnych filmów z playlisty?'],
  ])('Polish: asks before removing %i unavailable videos', (count, text) => {
    expect(messages.pl.removeUnavailableQuestion(count)).toBe(text);
  });

  it('asks before removing unavailable videos in English', () => {
    expect(messages.en.removeUnavailableQuestion(1)).toBe(
      'Remove 1 unavailable video from the playlist?',
    );
    expect(messages.en.removeUnavailableQuestion(3)).toBe(
      'Remove 3 unavailable videos from the playlist?',
    );
  });

  it('pluralizes the failed playlists count in English', () => {
    expect(messages.en.indexFailed(1)).toBe(
      'Could not fetch videos from 1 playlist.',
    );
    expect(messages.en.indexFailed(3)).toBe(
      'Could not fetch videos from 3 playlists.',
    );
  });

  it('never uses en or em dashes', () => {
    for (const locale of LOCALES) {
      for (const text of stringValues(messages[locale])) {
        expect(text).not.toMatch(/[\u2013\u2014]/);
      }
    }
  });
});
