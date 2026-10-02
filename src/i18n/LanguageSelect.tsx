import { useI18n } from './LocaleProvider';
import { LOCALE_NAMES, LOCALES, type Locale } from './messages';

function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

export function LanguageSelect() {
  const { locale, t, setLocale } = useI18n();

  return (
    <select
      className="select"
      aria-label={t.languageLabel}
      value={locale}
      onChange={(event) => {
        const next = event.target.value;
        if (isLocale(next)) {
          setLocale(next);
        }
      }}
    >
      {LOCALES.map((option) => (
        <option key={option} value={option} lang={option}>
          {LOCALE_NAMES[option]}
        </option>
      ))}
    </select>
  );
}
