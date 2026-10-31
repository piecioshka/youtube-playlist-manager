import { useI18n } from './LocaleProvider';
import type { Locale } from './messages';

// Emoji flags scale with the text and need no assets
const LOCALE_FLAGS: Record<Locale, string> = {
  pl: '🇵🇱',
  en: '🇬🇧',
};

// Two languages, so one click switches to the other; the flag shows the active one
export function LanguageToggle() {
  const { locale, t, setLocale } = useI18n();
  const next: Locale = locale === 'pl' ? 'en' : 'pl';

  return (
    <button
      type="button"
      className="button button--icon app__icon-button"
      aria-label={t.languageLabel}
      title={t.languageLabel}
      onClick={() => setLocale(next)}
    >
      <span className="app__flag" aria-hidden="true">
        {LOCALE_FLAGS[locale]}
      </span>
    </button>
  );
}
