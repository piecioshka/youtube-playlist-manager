import { useI18n } from '../i18n/LocaleProvider';
import type { VisibilityFilter as Filter } from './filterPlaylists';

type Option = { value: Filter; icon?: string };

const OPTIONS: readonly Option[] = [
  { value: 'all' },
  { value: 'public' },
  { value: 'unlisted' },
  { value: 'private', icon: '🔒' },
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
  const { t } = useI18n();

  return (
    <div
      className="visibility-filter"
      role="group"
      aria-label={t.visibilityFilterLabel}
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
          {t.visibilityFilter[option.value]} ({counts[option.value]})
        </button>
      ))}
    </div>
  );
}
