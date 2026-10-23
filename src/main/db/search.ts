// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type SQLite from 'better-sqlite3';
import { expressionBuilder, sql, type Expression, type SqlBool } from 'kysely';
import type { Database } from './types';
import { parseSearchQuery, type SearchTerm } from '../../shared/search-query';

// Escapes SQLite LIKE wildcards so a search word is matched literally rather than as a pattern.
function escapeLike(word: string): string {
  return word.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const SHORT_WORD = /^[\p{L}\p{N}]{1,3}$/u;
const wordPatterns = new Map<string, RegExp>();

// A short bare word such as "ci" would otherwise match inside "producing", so it must be a whole word.
// A quoted phrase stays a plain substring match, which is the way to ask for one.
function needsWholeWord(term: SearchTerm): boolean {
  return !term.phrase && SHORT_WORD.test(term.text);
}

function hasWord(text: unknown, word: unknown): number {
  if (typeof text !== 'string' || typeof word !== 'string') {
    return 0;
  }
  let pattern = wordPatterns.get(word);
  if (!pattern) {
    pattern = new RegExp(`(?<![\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu');
    wordPatterns.set(word, pattern);
  }
  return pattern.test(text) ? 1 : 0;
}

/** Adds the SQL functions that river search conditions call. */
export function registerSearchFunctions(sqlite: SQLite.Database): void {
  sqlite.function('has_word', { deterministic: true }, hasWord);
}

function termExpression(term: SearchTerm): Expression<SqlBool> {
  const eb = expressionBuilder<Database, never>();
  const columns = term.field === 'title' ? ['i.title'] : ['i.title', 'i.excerpt', 'f.title'];
  if (needsWholeWord(term)) {
    return eb.or(columns.map((column) => sql<boolean>`has_word(${sql.ref(column)}, ${term.text})`));
  }
  const pattern = `%${escapeLike(term.text)}%`;
  return eb.or(columns.map((column) => sql<boolean>`${sql.ref(column)} like ${pattern} escape '\\'`));
}

/**
 * The WHERE condition for a river search over a query that aliases the item table as `i` and the feed table as `f`.
 * @returns undefined when the search holds no term
 */
export function searchCondition(search: string | undefined): Expression<SqlBool> | undefined {
  const clauses = parseSearchQuery(search ?? '');
  if (clauses.length === 0) {
    return undefined;
  }
  const eb = expressionBuilder<Database, never>();
  return eb.and(clauses.map((clause) => {
    const matches = eb.or(clause.alternatives.map(termExpression));
    return clause.negated ? eb.not(matches) : matches;
  }));
}
