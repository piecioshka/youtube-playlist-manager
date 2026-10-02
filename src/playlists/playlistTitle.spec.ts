import { describe, expect, it } from 'vitest';
import { messages } from '../i18n/messages';
import { MAX_TITLE_LENGTH, titleError } from './playlistTitle';

const t = messages.pl;

describe('titleError', () => {
  it('accepts a title up to the limit', () => {
    expect(titleError('Zupa', t)).toBeNull();
    expect(titleError('a'.repeat(MAX_TITLE_LENGTH), t)).toBeNull();
  });

  it('rejects an empty title', () => {
    expect(titleError('', t)).toBe(t.titleEmpty);
  });

  it('rejects a title over the limit', () => {
    expect(titleError('a'.repeat(MAX_TITLE_LENGTH + 1), t)).toBe(
      t.titleTooLong(MAX_TITLE_LENGTH),
    );
  });

  it('counts an emoji as one character', () => {
    expect(titleError('🎵'.repeat(MAX_TITLE_LENGTH), t)).toBeNull();
  });
});
