import { describe, expect, it } from 'vitest';
import { matchesQuery, normalizeText } from './normalize';

describe('normalizeText', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeText('Ćwiczenia ŻÓŁW')).toBe('cwiczenia zolw');
  });

  it('maps ł, which has no decomposed form', () => {
    expect(normalizeText('Łódź')).toBe('lodz');
  });

  it('collapses whitespace and trims', () => {
    expect(normalizeText('  Muzyka \t do\n  pracy ')).toBe('muzyka do pracy');
  });
});

describe('matchesQuery', () => {
  it('matches without diacritics', () => {
    expect(matchesQuery('Ćwiczenia', 'cwiczenia')).toBe(true);
    expect(matchesQuery('Wycieczka do Łodzi', 'lodz')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesQuery('QuickSort in 4 minutes', 'quicksort')).toBe(true);
  });

  it('ignores extra spaces in the text', () => {
    expect(matchesQuery('Lofi   beats', 'lofi beats')).toBe(true);
  });

  it('rejects a text without the query', () => {
    expect(matchesQuery('Algorytmy', 'zupa')).toBe(false);
  });
});
