import { ApiError } from './types';

const GENERIC_MESSAGE = 'Coś poszło nie tak.';

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return GENERIC_MESSAGE;
  }
  switch (error.kind) {
    case 'unauthorized':
      return 'Sesja wygasła, zaloguj się ponownie.';
    case 'quotaExceeded':
      return 'Wyczerpano dzienny limit YouTube API. Spróbuj jutro.';
    case 'forbidden':
      return 'YouTube odmówił dostępu do tej operacji.';
    case 'notFound':
      return 'Tej playlisty już nie ma.';
    case 'network':
      return 'Brak połączenia z YouTube.';
    case 'unknown':
      return error.status === null
        ? GENERIC_MESSAGE
        : `Coś poszło nie tak (HTTP ${error.status}).`;
  }
}
