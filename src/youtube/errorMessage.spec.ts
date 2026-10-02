import { describe, expect, it } from 'vitest';
import { messages } from '../i18n/messages';
import { errorMessage } from './errorMessage';
import { ApiError } from './types';

const pl = messages.pl;
const en = messages.en;

describe('errorMessage', () => {
  it('describes every API error kind in Polish', () => {
    expect(errorMessage(new ApiError('unauthorized', 'x', 401), pl)).toBe(
      'Sesja wygasła, zaloguj się ponownie.',
    );
    expect(errorMessage(new ApiError('quotaExceeded', 'x', 403), pl)).toBe(
      'Wyczerpano dzienny limit YouTube API. Spróbuj jutro.',
    );
    expect(errorMessage(new ApiError('forbidden', 'x', 403), pl)).toBe(
      'YouTube odmówił dostępu do tej operacji.',
    );
    expect(errorMessage(new ApiError('notFound', 'x', 404), pl)).toBe(
      'Tej playlisty już nie ma.',
    );
    expect(errorMessage(new ApiError('network', 'x'), pl)).toBe(
      'Brak połączenia z YouTube.',
    );
    expect(errorMessage(new ApiError('unknown', 'x', 500), pl)).toBe(
      'Coś poszło nie tak (HTTP 500).',
    );
    expect(errorMessage(new ApiError('unknown', 'x'), pl)).toBe(
      'Coś poszło nie tak.',
    );
  });

  it('falls back for non-API errors', () => {
    expect(errorMessage(new Error('boom'), pl)).toBe('Coś poszło nie tak.');
    expect(errorMessage('boom', pl)).toBe('Coś poszło nie tak.');
  });

  it('describes API errors in English', () => {
    expect(errorMessage(new ApiError('quotaExceeded', 'x', 403), en)).toBe(
      'The daily YouTube API quota is used up. Try again tomorrow.',
    );
    expect(errorMessage(new ApiError('unknown', 'x', 500), en)).toBe(
      'Something went wrong (HTTP 500).',
    );
    expect(errorMessage('boom', en)).toBe('Something went wrong.');
  });
});
