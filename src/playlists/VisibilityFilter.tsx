import type { VisibilityFilter as Filter } from './filterPlaylists';

type Option = { value: Filter; label: string; icon?: string };

const OPTIONS: readonly Option[] = [
  { value: 'all', label: 'Wszystkie' },
  { value: 'public', label: 'Publiczne' },
  { value: 'unlisted', label: 'Niepubliczne' },
  { value: 'private', label: 'Prywatne', icon: '🔒' },
];

type VisibilityFilterProps = {
  value: Filter;
  counts: Record<Filter, number>;
  onChange: (filter: Filter) => void;
};

export function VisibilityFilter({
  value,
  counts,
  onChange,
}: VisibilityFilterProps) {
  return (
    <div
      className="visibility-filter"
      role="group"
      aria-label="Filtruj po widoczności"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="visibility-filter__option"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon && <span aria-hidden="true">{option.icon} </span>}
          {option.label} ({counts[option.value]})
        </button>
      ))}
    </div>
  );
}
