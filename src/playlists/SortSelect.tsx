import { useId } from 'react';
import { useI18n } from '../i18n/LocaleProvider';
import { SORT_OPTIONS, sortOptionId, type SortState } from './sortPlaylists';

type SortSelectProps = {
  value: SortState;
  onChange: (sort: SortState) => void;
};

// Na telefonie tabela nie pokazuje nagłówków, więc sortowanie wybiera się z listy
export function SortSelect({ value, onChange }: SortSelectProps) {
  const { t } = useI18n();
  const selectId = useId();

  return (
    <div className="sort-select">
      <label className="sort-select__label" htmlFor={selectId}>
        {t.sortLabel}
      </label>
      <select
        id={selectId}
        className="select sort-select__control"
        value={sortOptionId(value)}
        onChange={(event) => {
          const next = SORT_OPTIONS.find(
            (option) => sortOptionId(option) === event.target.value,
          );
          if (next !== undefined) {
            onChange(next);
          }
        }}
      >
        {SORT_OPTIONS.map((option) => {
          const optionId = sortOptionId(option);
          return (
            <option key={optionId} value={optionId}>
              {t.sortOptions[optionId]}
            </option>
          );
        })}
      </select>
    </div>
  );
}
