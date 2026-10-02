import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { useI18n } from '../i18n/LocaleProvider';

type SearchFieldProps = {
  value: string;
  status: string;
  onChange: (value: string) => void;
  onFocus: () => void;
};

function shortcutHint(): string {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K';
}

export function SearchField({
  value,
  status,
  onChange,
  onFocus,
}: SearchFieldProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Cmd+K / Ctrl+K z dowolnego miejsca strony przenosi do wyszukiwarki
  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onChange('');
    }
  }

  // Status poza .search, żeby podpowiedź skrótu dało się wyśrodkować względem samego pola
  return (
    <>
      <div className="search">
        <label className="visually-hidden" htmlFor={inputId}>
          {t.searchLabel}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          className="search__input"
          placeholder={t.searchPlaceholder}
          autoComplete="off"
          spellCheck={false}
          aria-keyshortcuts="Meta+K Control+K"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
        />
        <kbd className="search__hint" aria-hidden="true">
          {shortcutHint()}
        </kbd>
      </div>
      <p className="search__status" role="status">
        {status}
      </p>
    </>
  );
}
