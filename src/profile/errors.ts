import type { Messages } from '../i18n/messages';
import { errorMessage } from '../youtube/errorMessage';
import { ApiError } from '../youtube/types';

// Tekst błędu do pokazania przy akcji; wygasła sesja dodatkowo wraca do ekranu logowania
export function reportError(
  error: unknown,
  t: Messages,
  onUnauthorized: () => void,
): string {
  if (error instanceof ApiError && error.kind === 'unauthorized') {
    onUnauthorized();
  }
  return errorMessage(error, t);
}
