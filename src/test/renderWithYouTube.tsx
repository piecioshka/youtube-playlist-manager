import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { LocaleProvider } from '../i18n/LocaleProvider';
import type { Locale } from '../i18n/messages';
import type { YouTubeSession } from '../youtube/session';
import { YouTubeProvider } from '../youtube/YouTubeProvider';

// Ten sam układ providerów co w aplikacji; przydaje się też jako wrapper dla renderHook
export function youTubeWrapper(youtube: YouTubeSession, locale: Locale = 'pl') {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <LocaleProvider initialLocale={locale}>
        <YouTubeProvider session={youtube}>{children}</YouTubeProvider>
      </LocaleProvider>
    );
  };
}

export function renderWithYouTube(
  ui: ReactElement,
  youtube: YouTubeSession,
  locale: Locale = 'pl',
): RenderResult {
  return render(ui, { wrapper: youTubeWrapper(youtube, locale) });
}
