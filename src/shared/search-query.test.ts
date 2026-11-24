// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { parseSearchQuery, type SearchClause } from './search-query';

const word = (text: string, field: 'title' | 'any' = 'any') => ({ text, phrase: false, field });
const phrase = (text: string, field: 'title' | 'any' = 'any') => ({ text, phrase: true, field });
const all = (...terms: ReturnType<typeof word>[]): SearchClause[] => terms.map((term) => ({ alternatives: [term], negated: false }));

describe('parseSearchQuery', () => {
  test('returns no clause for an empty or blank query', () => {
    // Act / Assert
    expect(parseSearchQuery('')).toEqual([]);
    expect(parseSearchQuery('   ')).toEqual([]);
  });

  test('splits words into AND clauses and lowercases them', () => {
    // Act
    const clauses = parseSearchQuery('  Rust   SYSTEMS ');

    // Assert
    expect(clauses).toEqual(all(word('rust'), word('systems')));
  });

  test('reads a quoted phrase as one term', () => {
    // Act
    const clauses = parseSearchQuery('"data analyst" paris');

    // Assert
    expect(clauses).toEqual([{ alternatives: [phrase('data analyst')], negated: false }, ...all(word('paris'))]);
  });

  test('runs an unclosed quote to the end of the query', () => {
    // Act
    const clauses = parseSearchQuery('go "data ana');

    // Assert
    expect(clauses).toEqual([...all(word('go')), { alternatives: [phrase('data ana')], negated: false }]);
  });

  test('drops an empty phrase', () => {
    // Act / Assert
    expect(parseSearchQuery('a "" b')).toEqual(all(word('a'), word('b')));
  });

  test('joins neighbours of OR into one clause and extends chains', () => {
    // Act
    const clauses = parseSearchQuery('go OR rust OR zig java');

    // Assert
    expect(clauses).toEqual([
      { alternatives: [word('go'), word('rust'), word('zig')], negated: false },
      ...all(word('java')),
    ]);
  });

  test('does not treat lowercase or as an operator', () => {
    // Act
    const clauses = parseSearchQuery('go or rust');

    // Assert
    expect(clauses).toEqual(all(word('go'), word('or'), word('rust')));
  });

  test('takes a lone OR as a literal word', () => {
    // Act / Assert
    expect(parseSearchQuery('OR')).toEqual(all(word('or')));
    expect(parseSearchQuery('OR go')).toEqual(all(word('or'), word('go')));
    expect(parseSearchQuery('go OR')).toEqual(all(word('go'), word('or')));
    expect(parseSearchQuery('go OR OR rust')).toEqual(all(word('go'), word('or'), word('or'), word('rust')));
  });

  test('marks a leading dash as an exclusion', () => {
    // Act
    const clauses = parseSearchQuery('engineer -senior -"team lead"');

    // Assert
    expect(clauses).toEqual([
      ...all(word('engineer')),
      { alternatives: [word('senior')], negated: true },
      { alternatives: [phrase('team lead')], negated: true },
    ]);
  });

  test('trims the spaces inside a phrase and drops a phrase of spaces', () => {
    // Act / Assert
    expect(parseSearchQuery('"  data analyst  "')).toEqual([{ alternatives: [phrase('data analyst')], negated: false }]);
    expect(parseSearchQuery('a "   " b')).toEqual(all(word('a'), word('b')));
  });

  test('reads OR with a prefix or in quotes as a term, not as an operator', () => {
    // Act / Assert
    expect(parseSearchQuery('go -OR rust')).toEqual([
      ...all(word('go')),
      { alternatives: [word('or')], negated: true },
      ...all(word('rust')),
    ]);
    expect(parseSearchQuery('go title:OR rust')).toEqual(all(word('go'), word('or', 'title'), word('rust')));
    expect(parseSearchQuery('go "OR" rust')).toEqual(all(word('go'), phrase('or'), word('rust')));
  });

  test('keeps a hyphenated word whole', () => {
    // Act / Assert
    expect(parseSearchQuery('front-end')).toEqual(all(word('front-end')));
  });

  test('takes a lone dash as a literal word', () => {
    // Act / Assert
    expect(parseSearchQuery('- go')).toEqual(all(word('-'), word('go')));
    expect(parseSearchQuery('go -')).toEqual(all(word('go'), word('-')));
  });

  test('never joins an exclusion to an OR', () => {
    // Act
    const clauses = parseSearchQuery('go OR -rust');

    // Assert
    expect(clauses).toEqual([
      ...all(word('go'), word('or')),
      { alternatives: [word('rust')], negated: true },
    ]);
    expect(parseSearchQuery('-go OR rust')).toEqual([
      { alternatives: [word('go')], negated: true },
      ...all(word('or'), word('rust')),
    ]);
  });

  test('limits a title: term to the title, for words and phrases', () => {
    // Act
    const clauses = parseSearchQuery('title:engineer TITLE:"data analyst" -title:senior');

    // Assert
    expect(clauses).toEqual([
      ...all(word('engineer', 'title')),
      { alternatives: [phrase('data analyst', 'title')], negated: false },
      { alternatives: [word('senior', 'title')], negated: true },
    ]);
  });

  test('takes a bare title: as a literal word', () => {
    // Act / Assert
    expect(parseSearchQuery('title:')).toEqual(all(word('title:')));
  });

  test('allows title: terms inside an OR', () => {
    // Act
    const clauses = parseSearchQuery('title:go OR rust');

    // Assert
    expect(clauses).toEqual([{ alternatives: [word('go', 'title'), word('rust')], negated: false }]);
  });
});
