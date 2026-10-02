import { describe, expect, it } from 'vitest';
import { formatCount } from './formatCount';

describe('formatCount', () => {
  it.each([
    [0, ',', '0'],
    [999, ',', '999'],
    [1000, ',', '1,000'],
    [1234567, ',', '1,234,567'],
    [1234567, ' ', '1 234 567'],
  ])('formats %d with %j', (value, separator, expected) => {
    expect(formatCount(value, separator)).toBe(expected);
  });
});
