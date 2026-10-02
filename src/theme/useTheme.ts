import { useCallback, useEffect, useState } from 'react';
import { applyTheme, readTheme, writeTheme, type Theme } from './theme';

export type ThemeControls = {
  theme: Theme;
  toggle: () => void;
};

export function useTheme(): ThemeControls {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    writeTheme(next);
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
}
