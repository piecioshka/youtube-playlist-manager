export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube';

export function getGoogleClientId(): string | null {
  const value = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim();
}
