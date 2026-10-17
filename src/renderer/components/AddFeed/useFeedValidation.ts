// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect, useState } from 'react';
import { ipc } from '@/lib/ipc-client';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import type { ParsedSource, FeedFetchError, SourceType } from '../../../shared/contracts';

export type FeedValidationStatus = 'idle' | 'loading' | 'found' | 'not-found';

interface FeedValidationState {
  status: FeedValidationStatus;
  candidates: ParsedSource[];
  error: FeedFetchError | null;
}

interface FeedValidation extends FeedValidationState {
  /** The candidate the user picked, the first one until they pick another. */
  feed: ParsedSource | null;
  selectedIndex: number;
  select: (index: number) => void;
  validate: () => void;
}

const idleState: FeedValidationState = { status: 'idle', candidates: [], error: null };

function isUrlReady(query: string): boolean {
  if (query.startsWith('@')) {
    return false;
  }
  try {
    const url = new URL(query.includes('://') ? query : `https://${query}`);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

export function useFeedValidation(query: string, type?: SourceType): FeedValidation {
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebouncedValue(trimmedQuery, 450);
  const [committedQuery, setCommittedQuery] = useState<string | null>(null);
  const [state, setState] = useState<FeedValidationState>(idleState);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const validationQuery = committedQuery === trimmedQuery
    ? trimmedQuery
    : debouncedQuery === trimmedQuery && isUrlReady(debouncedQuery) ? debouncedQuery : '';

  useEffect(() => {
    setCommittedQuery((prev) => prev === trimmedQuery ? prev : null);
  }, [trimmedQuery]);

  useEffect(() => {
    if (!validationQuery) {
      setState(idleState);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading' }));

    ipc.invoke('feeds:validate-feed-url', { query: validationQuery, ...(type !== undefined ? { type } : {}) })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setState(
          result.success
            ? { status: 'found', candidates: result.data, error: null }
            : { status: 'not-found', candidates: [], error: result.error },
        );
        setSelectedIndex(0);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          status: 'not-found',
          candidates: [],
          error: {
            name: 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'An unknown error occurred',
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [validationQuery, type]);

  return {
    ...state,
    feed: state.candidates[selectedIndex] ?? null,
    selectedIndex,
    select: setSelectedIndex,
    validate: () => setCommittedQuery(trimmedQuery),
  };
}
