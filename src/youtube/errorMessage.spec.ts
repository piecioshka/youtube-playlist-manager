import { describe, expect, it } from 'vitest';
import { errorMessage } from './errorMessage';
import { ApiError } from './types';

describe('errorMessage', () => {
  it('describes every API error kind in Polish', () => {
    expect(errorMessage(new ApiError('unauthorized', 'x', 401))).toBe(
      'Sesja wygasła, zaloguj się ponownie.',
    );
    expect(errorMessage(new ApiError('quotaExceeded', 'x', 403))).toBe(
      'Wyczerpano dzienny limit YouTube API. Spróbuj jutro.',
    );
    expect(errorMessage(new ApiError('forbidden', 'x', 403))).toBe(
      'YouTube odmówił dostępu do tej operacji.',
    );
    expect(errorMessage(new ApiError('notFound', 'x', 404))).toBe(
      'Tej playlisty już nie ma.',
    );
    expect(errorMessage(new ApiError('network', 'x'))).toBe(
      'Brak połączenia z YouTube.',
    );
    expect(errorMessage(new ApiError('unknown', 'x', 500))).toBe(
      'Coś poszło nie tak (HTTP 500).',
    );
    expect(errorMessage(new ApiError('unknown', 'x'))).toBe(
      'Coś poszło nie tak.',
    );
  });

  it('falls back for non-API errors', () => {
    expect(errorMessage(new Error('boom'))).toBe('Coś poszło nie tak.');
    expect(errorMessage('boom')).toBe('Coś poszło nie tak.');
  });
});
