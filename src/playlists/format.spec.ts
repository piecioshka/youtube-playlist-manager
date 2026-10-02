import { describe, expect, it } from 'vitest';
import type { PrivacyStatus } from '../youtube/types';
import { formatDate, formatVideoCount, privacyLabel } from './format';

describe('formatVideoCount', () => {
  const cases: [number, string][] = [
    [0, '0 filmów'],
    [1, '1 film'],
    [2, '2 filmy'],
    [4, '4 filmy'],
    [5, '5 filmów'],
    [12, '12 filmów'],
    [14, '14 filmów'],
    [22, '22 filmy'],
    [25, '25 filmów'],
    [102, '102 filmy'],
    [112, '112 filmów'],
  ];

  it.each(cases)('%i -> %s', (count, expected) => {
    expect(formatVideoCount(count)).toBe(expected);
  });
});

describe('formatDate', () => {
  it('formats local time as YYYY-MM-DD', () => {
    // 23:30 UTC to już następny dzień w Europe/Warsaw (TZ z vitest.config.ts)
    expect(formatDate('2026-03-01T23:30:00Z')).toBe('2026-03-02');
  });

  it('pads month and day', () => {
    expect(formatDate('2026-01-05T12:00:00Z')).toBe('2026-01-05');
  });
});

describe('privacyLabel', () => {
  const cases: [PrivacyStatus, string][] = [
    ['public', 'Publiczna'],
    ['unlisted', 'Niepubliczna'],
    ['private', 'Prywatna'],
  ];

  it.each(cases)('%s -> %s', (status, expected) => {
    expect(privacyLabel(status)).toBe(expected);
  });
});
