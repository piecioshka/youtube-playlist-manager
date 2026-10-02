import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGoogleClientId, YOUTUBE_SCOPE } from './config';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('config', () => {
  it('uses the full YouTube scope', () => {
    expect(YOUTUBE_SCOPE).toBe('https://www.googleapis.com/auth/youtube');
  });

  it('returns the trimmed client id', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', ' 123.apps.googleusercontent.com ');
    expect(getGoogleClientId()).toBe('123.apps.googleusercontent.com');
  });

  it('returns null when the client id is empty', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '   ');
    expect(getGoogleClientId()).toBeNull();
  });
});
