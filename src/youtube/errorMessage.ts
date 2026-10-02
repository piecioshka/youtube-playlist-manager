import type { Messages } from '../i18n/messages';
import { ApiError } from './types';

export function errorMessage(error: unknown, t: Messages): string {
  if (!(error instanceof ApiError)) {
    return t.genericError;
  }
  if (error.kind === 'unknown' && error.status !== null) {
    return t.apiErrorWithStatus(error.status);
  }
  return t.apiError[error.kind];
}
