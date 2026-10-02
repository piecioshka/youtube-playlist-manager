export type DropPlacement = 'before' | 'after';

// Zwraca nową tablicę z elementem przeniesionym na nowy indeks
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) {
    next.splice(to, 0, moved);
  }
  return next;
}

/*
 * Indeks, który przeciągany element zajmie po upuszczeniu przed albo za
 * elementem `over`. Wyjęcie przeciąganego elementu przesuwa późniejsze o jeden w górę.
 */
export function dropIndex(
  from: number,
  over: number,
  placement: DropPlacement,
): number {
  if (over === from) {
    return from;
  }
  const slot = placement === 'before' ? over : over + 1;
  return slot > from ? slot - 1 : slot;
}
