import { describe, expect, it } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
  it('formats local time as YYYY-MM-DD', () => {
    // 23:30 UTC to już następny dzień w Europe/Warsaw (TZ z vitest.config.ts)
    expect(formatDate('2026-03-01T23:30:00Z')).toBe('2026-03-02');
  });

  it('pads month and day', () => {
    expect(formatDate('2026-01-05T12:00:00Z')).toBe('2026-01-05');
  });
});
