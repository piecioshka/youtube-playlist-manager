import type { Theme } from './theme';

type ThemeToggleProps = {
  theme: Theme;
  label: string;
  onToggle: () => void;
};

function MoonIcon() {
  return (
    <svg
      className="theme-toggle__icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
    >
      <path
        fill="currentColor"
        d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      className="theme-toggle__icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
        d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M4.6 19.4 6 18M18 6l1.4-1.4"
      />
    </svg>
  );
}

// Przełącznik pokazuje bieżący motyw: księżyc dla ciemnego, słońce dla jasnego
export function ThemeToggle({ theme, label, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className="button button--icon"
      aria-pressed={theme === 'dark'}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
