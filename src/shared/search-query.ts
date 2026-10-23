// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/** One thing a clause can match: `field` 'title' limits it to the item title, 'any' covers title, excerpt and feed name. */
export interface SearchTerm {
  text: string;
  phrase: boolean;
  field: 'title' | 'any';
}

/** Alternatives are joined by OR; clauses are joined by AND. A negated clause holds exactly one alternative. */
export interface SearchClause {
  alternatives: SearchTerm[];
  negated: boolean;
}

type Token = { kind: 'or' } | { kind: 'term'; term: SearchTerm; negated: boolean };

const TITLE_PREFIX = /^title:/i;
const TITLE_PREFIX_LENGTH = 'title:'.length;

function readQuoted(input: string, start: number): { text: string; end: number } {
  const close = input.indexOf('"', start + 1);
  return close === -1
    ? { text: input.slice(start + 1), end: input.length }
    : { text: input.slice(start + 1, close), end: close + 1 };
}

function readWord(input: string, start: number): { text: string; end: number } {
  let end = start;
  while (end < input.length && !/\s/.test(input.charAt(end))) {
    end++;
  }
  return { text: input.slice(start, end), end };
}

function isGlued(input: string, index: number): boolean {
  return index < input.length && !/\s/.test(input.charAt(index));
}

/** The `-` and `title:` prefixes at `start`, which only count when a term follows them without a space. */
function readPrefixes(input: string, start: number): { negated: boolean; titleOnly: boolean; position: number } {
  const negated = input.charAt(start) === '-' && isGlued(input, start + 1);
  const afterDash = negated ? start + 1 : start;
  const titleOnly = TITLE_PREFIX.test(input.slice(afterDash)) && isGlued(input, afterDash + TITLE_PREFIX_LENGTH);
  return { negated, titleOnly, position: titleOnly ? afterDash + TITLE_PREFIX_LENGTH : afterDash };
}

function readToken(input: string, start: number): { token: Token | undefined; end: number } {
  const { negated, titleOnly, position } = readPrefixes(input, start);
  const phrase = input.charAt(position) === '"';
  const { text, end } = phrase ? readQuoted(input, position) : readWord(input, position);
  const trimmed = text.trim().toLowerCase();
  if (!trimmed) {
    return { token: undefined, end };
  }
  if (!negated && !titleOnly && !phrase && text === 'OR') {
    return { token: { kind: 'or' }, end };
  }
  return { token: { kind: 'term', negated, term: { text: trimmed, phrase, field: titleOnly ? 'title' : 'any' } }, end };
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let position = 0;
  while (position < input.length) {
    if (/\s/.test(input.charAt(position))) {
      position++;
      continue;
    }
    const { token, end } = readToken(input, position);
    if (token) {
      tokens.push(token);
    }
    position = end;
  }
  return tokens;
}

function literalOr(): SearchTerm {
  return { text: 'or', phrase: false, field: 'any' };
}

/**
 * Parses a river search into AND-ed clauses. Never throws: an unclosed quote runs to the end, and an
 * `OR` or `-` that has nothing valid to combine with is matched as a literal word.
 */
export function parseSearchQuery(input: string): SearchClause[] {
  const tokens = tokenize(input);
  const clauses: SearchClause[] = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    index++;
    if (token?.kind !== 'term') {
      clauses.push({ alternatives: [literalOr()], negated: false });
      continue;
    }
    const clause: SearchClause = { alternatives: [token.term], negated: token.negated };
    while (!clause.negated) {
      const operator = tokens[index];
      const next = tokens[index + 1];
      if (operator?.kind !== 'or' || next?.kind !== 'term' || next.negated) {
        break;
      }
      clause.alternatives.push(next.term);
      index += 2;
    }
    clauses.push(clause);
  }
  return clauses;
}
