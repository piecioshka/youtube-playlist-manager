import { describe, expect, it } from 'vitest';
import { dropIndex, moveItem } from './reorder';

describe('moveItem', () => {
  it('moves an item forward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('returns an equal list when the index does not change', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input', () => {
    const input = ['a', 'b', 'c'];
    const output = moveItem(input, 0, 2);

    expect(input).toEqual(['a', 'b', 'c']);
    expect(output).not.toBe(input);
  });
});

describe('dropIndex', () => {
  it('lands after a later item at its index', () => {
    expect(dropIndex(0, 2, 'after')).toBe(2);
  });

  it('lands before a later item one place earlier', () => {
    expect(dropIndex(0, 2, 'before')).toBe(1);
  });

  it('lands before an earlier item at its index', () => {
    expect(dropIndex(3, 1, 'before')).toBe(1);
  });

  it('lands after an earlier item one place later', () => {
    expect(dropIndex(3, 1, 'after')).toBe(2);
  });

  it('keeps the index when dropped on itself', () => {
    expect(dropIndex(2, 2, 'before')).toBe(2);
    expect(dropIndex(2, 2, 'after')).toBe(2);
  });
});
