import { describe, expect, test } from 'vitest';
import { filterBySearch, type SearchableRiverItem } from './search';

type Searchable = Pick<SearchableRiverItem, 'id' | 'title' | 'description' | 'feedTitle'>;

function createItem(overrides: Partial<Searchable> = {}): Searchable {
  return {
    id: 1,
    title: 'Rust async runtime',
    description: 'A deep dive into executors',
    feedTitle: 'The Weekly Report',
    ...overrides,
  };
}

const ITEMS: Searchable[] = [
  createItem(),
  createItem({ id: 2, title: 'TypeScript generics', description: 'Compiler internals explained', feedTitle: 'Dev Digest' }),
  createItem({ id: 3, title: 'Cooking pasta', description: 'Salt the water well', feedTitle: 'Kitchen Notes' }),
];

describe('filterBySearch', () => {
  test('matches by title', () => {
    // Act
    const result = filterBySearch(ITEMS, 'generics');

    // Assert
    expect(result.map((item) => item.id)).toEqual([2]);
  });

  test('matches by description', () => {
    // Act
    const result = filterBySearch(ITEMS, 'executors');

    // Assert
    expect(result.map((item) => item.id)).toEqual([1]);
  });

  test('matches by feed title', () => {
    // Act
    const result = filterBySearch(ITEMS, 'digest');

    // Assert
    expect(result.map((item) => item.id)).toEqual([2]);
  });

  test('matches case-insensitively', () => {
    // Act
    const result = filterBySearch(ITEMS, 'RUST');

    // Assert
    expect(result.map((item) => item.id)).toEqual([1]);
  });

  test('requires every word to match somewhere in any field order', () => {
    // Act: "water" is in the description, "cooking" in the title.
    const result = filterBySearch(ITEMS, 'water cooking');

    // Assert
    expect(result.map((item) => item.id)).toEqual([3]);
  });

  test('drops items when one word matches nothing', () => {
    // Act
    const result = filterBySearch(ITEMS, 'digest quantum');

    // Assert
    expect(result).toEqual([]);
  });

  test('matches a word only at a field boundary, not across concatenated fields', () => {
    // Arrange: "runtimethe" spans title end and feed title start.
    // Act
    const result = filterBySearch(ITEMS, 'runtimethe');

    // Assert
    expect(result).toEqual([]);
  });

  test('keeps every item for an empty query', () => {
    // Act
    const result = filterBySearch(ITEMS, '');

    // Assert
    expect(result).toBe(ITEMS);
  });

  test('keeps every item for a whitespace-only query', () => {
    // Act
    const result = filterBySearch(ITEMS, '   ');

    // Assert
    expect(result).toBe(ITEMS);
  });

  test('ignores repeated whitespace between words', () => {
    // Act
    const result = filterBySearch(ITEMS, '  water   cooking  ');

    // Assert
    expect(result.map((item) => item.id)).toEqual([3]);
  });

  test('preserves the input order', () => {
    // Arrange
    const ordered = [
      createItem({ id: 7, title: 'Alpha beta' }),
      createItem({ id: 9, title: 'Gamma beta' }),
    ];

    // Act
    const result = filterBySearch(ordered, 'beta');

    // Assert
    expect(result.map((item) => item.id)).toEqual([7, 9]);
  });

  test('returns an empty array when nothing matches', () => {
    // Act
    const result = filterBySearch(ITEMS, 'kubernetes');

    // Assert
    expect(result).toEqual([]);
  });
});
