import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { LocaleProvider } from '../i18n/LocaleProvider';
import type { Locale } from '../i18n/messages';

// Domyślnie polski niezależnie od localStorage, żeby testy nie zależały od siebie nawzajem
export function renderWithI18n(
  ui: ReactElement,
  locale: Locale = 'pl',
): RenderResult {
  function Wrapper({ children }: { children: ReactNode }) {
    return <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>;
  }
  return render(ui, { wrapper: Wrapper });
}
