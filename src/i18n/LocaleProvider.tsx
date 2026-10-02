import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readLocale, writeLocale } from './locale';
import { messages, type Locale, type Messages } from './messages';

export type I18n = {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18n | null>(null);

type LocaleProviderProps = {
  children: ReactNode;
  // Testy podają język wprost, aplikacja czyta zapamiętany wybór
  initialLocale?: Locale;
};

export function LocaleProvider({
  children,
  initialLocale,
}: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? readLocale(),
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    writeLocale(next);
    setLocaleState(next);
  }, []);

  const value = useMemo(
    (): I18n => ({ locale, t: messages[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error('useI18n() must be used inside <LocaleProvider>');
  }
  return value;
}
