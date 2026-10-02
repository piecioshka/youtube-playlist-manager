import type { SortMode } from './sortPlaylists';

type SortOption = { mode: SortMode; label: string };

const SORT_OPTIONS: SortOption[] = [
  { mode: 'newest', label: 'Najnowsze' },
  { mode: 'alpha', label: 'Alfabetycznie' },
];

type SortControlProps = {
  value: SortMode;
  onChange: (mode: SortMode) => void;
};

export function SortControl({ value, onChange }: SortControlProps) {
  return (
    <fieldset className="sort-control">
      <legend className="sort-control__legend">Sortuj</legend>
      {SORT_OPTIONS.map((option) => (
        <label key={option.mode} className="sort-control__option">
          <input
            className="sort-control__input"
            type="radio"
            name="sort"
            value={option.mode}
            checked={value === option.mode}
            onChange={() => onChange(option.mode)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
