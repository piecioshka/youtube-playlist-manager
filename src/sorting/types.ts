export type SortDirection = 'asc' | 'desc';

// Wartość atrybutu aria-sort dla nagłówka kolumny; undefined, gdy tabela nie jest po niej posortowana
export function ariaSort(
  direction: SortDirection | null,
): 'ascending' | 'descending' | undefined {
  if (direction === null) {
    return undefined;
  }
  return direction === 'asc' ? 'ascending' : 'descending';
}
