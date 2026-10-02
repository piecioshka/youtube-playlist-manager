import { act, render, renderHook, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider, useI18n } from './LocaleProvider';

const KEY = 'youtube-playlist-manager.locale';

function Probe() {
  const { locale, t } = useI18n();
  return (
    <p>
      {locale}: {t.signInButton}
    </p>
  );
}

describe('LocaleProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'pl';
  });

  it('starts in Polish', () => {
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText('pl: Zaloguj przez Google')).toBeInTheDocument();
  });

  it('starts from the stored locale and sets the document language', () => {
    localStorage.setItem(KEY, 'en');
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText('en: Sign in with Google')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches, stores and applies the locale', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: LocaleProvider,
    });

    act(() => result.current.setLocale('en'));

    expect(result.current.locale).toBe('en');
    expect(result.current.t.signInButton).toBe('Sign in with Google');
    expect(localStorage.getItem(KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('can start from a given locale', () => {
    render(
      <LocaleProvider initialLocale="en">
        <Probe />
      </LocaleProvider>,
    );
    expect(screen.getByText('en: Sign in with Google')).toBeInTheDocument();
  });

  it('explains a missing provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useI18n())).toThrow(
      'useI18n() must be used inside <LocaleProvider>',
    );
    vi.restoreAllMocks();
  });
});
