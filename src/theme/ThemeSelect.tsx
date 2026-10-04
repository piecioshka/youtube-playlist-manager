import { useI18n } from '../i18n/LocaleProvider';
import { THEME_PREFERENCES, type ThemePreference } from './theme';
import { useTheme } from './useTheme';

function isPreference(value: string): value is ThemePreference {
  return THEME_PREFERENCES.some((preference) => preference === value);
}

export function ThemeSelect() {
  const { t } = useI18n();
  const { preference, setPreference } = useTheme();

  return (
    <select
      className="select"
      aria-label={t.themeLabel}
      value={preference}
      onChange={(event) => {
        const next = event.target.value;
        if (isPreference(next)) {
          setPreference(next);
        }
      }}
    >
      {THEME_PREFERENCES.map((option) => (
        <option key={option} value={option}>
          {t.themeOptions[option]}
        </option>
      ))}
    </select>
  );
}
