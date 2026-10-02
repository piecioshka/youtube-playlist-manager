import type { Messages } from '../i18n/messages';

export const MAX_TITLE_LENGTH = 150;

// Komunikat dla tytułu po przycięciu spacji albo null, gdy tytuł jest poprawny
export function titleError(title: string, t: Messages): string | null {
  if (title === '') {
    return t.titleEmpty;
  }
  // Limit YouTube liczy znaki, nie jednostki UTF-16
  if ([...title].length > MAX_TITLE_LENGTH) {
    return t.titleTooLong(MAX_TITLE_LENGTH);
  }
  return null;
}
