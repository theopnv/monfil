import { useEffect, useState } from 'react';
import { useDebouncedValue } from '@/lib/addFeed/useDebouncedValue';
import type { ParsedSource, FeedFetchError } from '../../../preload/channels';

export type FeedValidationStatus = 'idle' | 'loading' | 'found' | 'not-found';

interface FeedValidationState {
  status: FeedValidationStatus;
  feed: ParsedSource | null;
  error: FeedFetchError | null;
}

const idleState: FeedValidationState = { status: 'idle', feed: null, error: null };

export function useFeedValidation(query: string): FeedValidationState {
  const debouncedQuery = useDebouncedValue(query.trim(), 450);
  const [state, setState] = useState<FeedValidationState>(idleState);

  useEffect(() => {
    if (!debouncedQuery) {
      setState(idleState);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading' }));

    window.electron.ipcRenderer
      .invoke('feeds:validate-feed-url', debouncedQuery)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setState(
          result.success
            ? { status: 'found', feed: result.data, error: null }
            : { status: 'not-found', feed: null, error: result.error },
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          status: 'not-found',
          feed: null,
          error: {
            name: 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'An unknown error occurred',
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return state;
}
