// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { fetchConditional, fetchText, type FetchValidators, type NotModified } from '../../lib/fetch';
import type { FeedFetchError, FetchUrlError, ParsedSource, SourceType } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';
import { parseFeedContent } from './feedContent';
import type { FeedCandidate, ParsedFeedContent, SourceAdapter } from './types';

/** The most candidates one link may fetch, so a page with many feed links stays cheap to validate. */
export const MAX_CANDIDATES = 5;

export function mapFetchError(error: FetchUrlError): FeedFetchError {
  switch (error.name) {
    case 'GENERIC_FETCH_ERROR':
    case 'NETWORK_ERROR':
    case 'NOT_ALLOWED_OR_ABORTED_ERROR':
    case 'RESPONSE_TOO_LARGE_ERROR':
    case 'BLOCKED_URL_ERROR':
      return error;
    default: {
      const exhaustiveCheck: never = error;
      return exhaustiveCheck;
    }
  }
}

export function withScheme(link: string): string {
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

export function toUrl(raw: string): URL | null {
  try {
    return new URL(withScheme(raw.trim()));
  } catch {
    return null;
  }
}

export function unsupported(message: string): { success: false; error: FeedFetchError } {
  return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message } };
}

type ContentParser = (content: string) => ParsedFeedContent | null;

export type FetchedFeed = { parsed: ParsedFeedContent; body: string; validators: FetchValidators } | NotModified;

/**
 * Fetches `link` and parses it as a feed.
 * @param validators replayed as conditional GET headers when present
 */
export async function fetchAndParse(link: string, validators: FetchValidators | undefined, parse: ContentParser): Promise<Result<FetchedFeed, FeedFetchError>> {
  try {
    const result = validators ? await fetchConditional(link, { validators }) : await fetchText(link);
    if (!result.success) {
      return { success: false, error: mapFetchError(result.error) };
    }
    if ('notModified' in result.data) {
      return { success: true, data: result.data };
    }
    const parsed = parse(result.data.body);
    if (!parsed) {
      return unsupported("This doesn't look like a supported feed.");
    }
    return { success: true, data: { parsed, body: result.data.body, validators: result.data.validators } };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: { name: 'PARSE_ERROR', message: error.message } };
    }
    return { success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } };
  }
}

export type IconResolver = (candidate: FeedCandidate, body: string) => Promise<string | undefined>;

/**
 * Fetches up to {@link MAX_CANDIDATES} candidates in parallel and keeps the ones that parse, in order.
 * @returns the first candidate's error when none of them parse
 */
export async function fetchCandidates(
  type: SourceType,
  candidates: FeedCandidate[],
  parse: ContentParser,
  resolveIcon?: IconResolver,
): Promise<Result<ParsedSource[], FeedFetchError>> {
  const results = await Promise.all(candidates.slice(0, MAX_CANDIDATES).map(async (candidate): Promise<Result<ParsedSource, FeedFetchError>> => {
    const fetched = await fetchAndParse(candidate.link, undefined, parse);
    if (!fetched.success) {
      return fetched;
    }
    if ('notModified' in fetched.data) {
      return unsupported('The feed did not change since it was last fetched.');
    }
    const { parsed, body } = fetched.data;
    const icon = candidate.icon ?? await resolveIcon?.(candidate, body).catch(() => undefined);
    return {
      success: true,
      data: { type, link: candidate.link, title: parsed.title, description: parsed.description, items: parsed.items, icon, ...(candidate.label ? { label: candidate.label } : {}) },
    };
  }));

  const found = results.flatMap((result) => (result.success ? [result.data] : []));
  if (found.length > 0) {
    return { success: true, data: found };
  }
  const firstFailure = results.find((result) => !result.success);
  return firstFailure ?? unsupported("This doesn't look like a supported feed.");
}

export interface FeedSourceSpec {
  type: SourceType;
  fetchesFullArticle: boolean;
  /**
   * The feeds raw wizard text leads to, or null when the text is not for this source.
   * @param lenient true once the user (or host detection) has already picked this source, so
   *   looser shapes such as a bare handle are accepted
   */
  toCandidates(query: string, lenient: boolean): FeedCandidate[] | null;
  /** Shown when the user picks this source's chip for a link it cannot read. */
  mismatchMessage: string;
  /** Platform parse rules applied on top of the generic RSS, Atom and JSON Feed parse. */
  transform?(content: ParsedFeedContent): ParsedFeedContent;
  resolveIcon?: IconResolver;
}

/** A source that reads ordinary feeds and adds its own URL rules, parse rules and icon on top. */
export function createFeedSource(spec: FeedSourceSpec): SourceAdapter {
  const parse: ContentParser = (content) => {
    const parsed = parseFeedContent(content);
    return parsed && spec.transform ? spec.transform(parsed) : parsed;
  };

  return {
    type: spec.type,
    fetchesFullArticle: spec.fetchesFullArticle,
    matches: (query) => spec.toCandidates(query, false) !== null,
    async discover(query) {
      const candidates = spec.toCandidates(query, true);
      if (!candidates?.length) {
        return unsupported(spec.mismatchMessage);
      }
      return fetchCandidates(spec.type, candidates, parse, spec.resolveIcon);
    },
    async fetch(input) {
      const link = withScheme(input.link);
      const fetched = await fetchAndParse(link, input.validators, parse);
      if (!fetched.success) {
        return fetched;
      }
      if ('notModified' in fetched.data) {
        return { success: true, data: fetched.data };
      }
      const { parsed, validators } = fetched.data;
      return { success: true, data: { validators, parsed: { type: spec.type, link, title: parsed.title, description: parsed.description, items: parsed.items, icon: undefined } } };
    },
    parse,
  };
}
