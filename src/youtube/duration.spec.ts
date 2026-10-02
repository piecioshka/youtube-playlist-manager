import { describe, expect, it } from 'vitest';
import { parseIsoDuration } from './duration';

describe('parseIsoDuration', () => {
  it.each([
    ['PT4M13S', 253],
    ['PT45S', 45],
    ['PT1H', 3600],
    ['PT1H2M3S', 3723],
    ['PT10M', 600],
    ['P1DT2H3M4S', 93784],
    ['P0D', 0],
  ])('reads %s as %i seconds', (value, seconds) => {
    expect(parseIsoDuration(value)).toBe(seconds);
  });

  it.each(['', 'P', 'PT', '4:13', 'PT4X', 'P1Y'])('rejects %j', (value) => {
    expect(parseIsoDuration(value)).toBeNull();
  });
});
