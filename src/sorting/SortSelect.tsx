import { useId } from 'react';

export type SortSelectOption = { id: string; label: string };

type SortSelectProps = {
  label: string;
  value: string;
  options: readonly SortSelectOption[];
  onChange: (id: string) => void;
};

// Na telefonie tabela nie pokazuje nagłówków, więc sortowanie wybiera się z listy
export function SortSelect({
  label,
  value,
  options,
  onChange,
}: SortSelectProps) {
  const selectId = useId();

  return (
    <div className="sort-select">
      <label className="sort-select__label" htmlFor={selectId}>
        {label}
      </label>
      <select
        id={selectId}
        className="select sort-select__control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
