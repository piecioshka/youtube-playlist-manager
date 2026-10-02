import type { SortDirection } from './types';

type SortButtonProps = {
  label: string;
  // Kierunek, gdy tabela jest posortowana po tej kolumnie; inaczej null
  direction: SortDirection | null;
  onClick: () => void;
};

/*
 * Przycisk w nagłówku sortowalnej kolumny. Piktogram z dwiema strzałkami widać
 * zawsze, żeby było jasne, że kolumnę da się sortować; aktywna kolumna
 * podświetla swój kierunek.
 */
export function SortButton({ label, direction, onClick }: SortButtonProps) {
  return (
    <button type="button" className="sort-button" onClick={onClick}>
      {label}
      <svg
        className={
          direction === null ? 'sort-icon' : `sort-icon sort-icon--${direction}`
        }
        width="8"
        height="14"
        viewBox="0 0 8 14"
        aria-hidden="true"
      >
        <path
          className="sort-icon__arrow sort-icon__arrow--asc"
          d="M4 1l3.5 5h-7z"
        />
        <path
          className="sort-icon__arrow sort-icon__arrow--desc"
          d="M4 13l3.5-5h-7z"
        />
      </svg>
    </button>
  );
}
