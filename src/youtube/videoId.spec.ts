import { describe, expect, it } from 'vitest';
import { parseVideoId } from './videoId';

const ID = 'dQw4w9WgXcQ';

describe('parseVideoId', () => {
  it.each([
    [ID],
    [`  ${ID}  `],
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`http://www.youtube.com/watch?v=${ID}`],
    [`www.youtube.com/watch?v=${ID}`],
    [`youtube.com/watch?v=${ID}`],
    [`https://www.youtube.com/watch?v=${ID}&list=PL-x&t=42s`],
    [`https://www.youtube.com/watch?feature=share&v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=abc&t=10`],
    [`youtu.be/${ID}`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://youtube.com/shorts/${ID}?feature=share`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube.com/embed/${ID}?start=30`],
  ])('reads the id from %s', (input) => {
    expect(parseVideoId(input)).toBe(ID);
  });

  it('accepts dashes and underscores in a bare id', () => {
    expect(parseVideoId('a-b_c-d_e-f')).toBe('a-b_c-d_e-f');
  });

  it.each([
    [''],
    ['   '],
    ['dQw4w9WgXc'],
    ['dQw4w9WgXcQQ'],
    ['dQw4w9WgX!Q'],
    ['https://www.youtube.com/watch'],
    ['https://www.youtube.com/watch?v=short'],
    ['https://www.youtube.com/playlist?list=PL-x'],
    [`https://vimeo.com/${ID}`],
    [`https://example.com/watch?v=${ID}`],
    [`https://youtube.com.evil.example/watch?v=${ID}`],
    ['https://youtu.be/'],
    [`https://www.youtube.com/shorts/${ID}/extra`],
    ['not a url at all'],
  ])('rejects %s', (input) => {
    expect(parseVideoId(input)).toBeNull();
  });
});
