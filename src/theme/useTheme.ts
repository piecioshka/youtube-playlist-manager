import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  readPreference,
  resolveTheme,
  watchSystemTheme,
  writePreference,
  type ThemePreference,
} from './theme';

export type ThemeControls = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export function useTheme(): ThemeControls {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readPreference);

  useEffect(() => {
    applyTheme(resolveTheme(preference));
    if (preference !== 'system') {
      return undefined;
    }
    // Zmiana motywu w systemie ma dojść bez przeładowania strony
    return watchSystemTheme(() => applyTheme(resolveTheme('system')));
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    writePreference(next);
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
