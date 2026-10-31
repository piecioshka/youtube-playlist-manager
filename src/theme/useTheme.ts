import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  applyTheme,
  readPreference,
  resolveTheme,
  watchSystemTheme,
  writePreference,
  type Theme,
  type ThemePreference,
} from './theme';

export type ThemeControls = {
  preference: ThemePreference;
  // The theme actually shown, with `system` resolved
  theme: Theme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
};

export function useTheme(): ThemeControls {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readPreference);
  // Re-renders when the system theme changes, so the toggle icon stays in sync
  const theme = useSyncExternalStore(watchSystemTheme, () =>
    resolveTheme(preference),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    writePreference(next);
    setPreferenceState(next);
  }, []);

  const toggle = useCallback(() => {
    setPreference(theme === 'dark' ? 'light' : 'dark');
  }, [setPreference, theme]);

  return { preference, theme, setPreference, toggle };
}
