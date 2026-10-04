import { vi } from 'vitest';

type SystemTheme = 'light' | 'dark';

export type SystemThemeStub = {
  set: (theme: SystemTheme) => void;
};

// jsdom nie ma `matchMedia`; atrapa odpowiada na `(prefers-color-scheme: light)` i zgłasza zmiany
export function stubSystemTheme(initial: SystemTheme): SystemThemeStub {
  let current = initial;
  const listeners = new Set<() => void>();

  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return current === 'light';
    },
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));

  return {
    set(theme) {
      current = theme;
      for (const listener of [...listeners]) {
        listener();
      }
    },
  };
}
