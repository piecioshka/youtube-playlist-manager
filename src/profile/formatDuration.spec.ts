import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [7, '0:07'],
    [253, '4:13'],
    [600, '10:00'],
    [3600, '1:00:00'],
    [3723, '1:02:03'],
    [93784, '26:03:04'],
  ])('shows %i seconds as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});
