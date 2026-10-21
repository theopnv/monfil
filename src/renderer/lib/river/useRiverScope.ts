// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback, useMemo } from 'react';
import { visibleFeedIds } from './feed-visibility';
import { useDebouncedValue } from '../useDebouncedValue';
import { useRiverScopeState } from '../../providers/river-scope-provider';
import { useActiveWorkspaceId } from '../../providers/workspace-provider';
import { usePreferences } from '../../providers/preferences-provider';
import { useSearch } from '../../providers/search-provider';
import type { RiverScope } from '../queries';
import type { FeedSummary } from '../../../shared/contracts';

export interface RiverScopeResult {
  scope: RiverScope;
  visibleFeedIdsSet: ReadonlySet<number>;
  showOnlyLinks: ReadonlySet<string>;
  setShowOnlyLinks: (updater: (prev: ReadonlySet<string>) => ReadonlySet<string>) => void;
  debouncedSearch: string;
}

/**
 * Builds the `RiverScope` Home's river and the reader's navigation both query with, from the
 * focus selection of the active workspace, the hide-read preference and the debounced search query. Sharing this
 * derivation (rather than each screen computing its own) is what makes the two share one cache entry.
 */
export function useRiverScope(feeds: FeedSummary[], saved = false): RiverScopeResult {
  const { getShowOnlyLinks, setShowOnlyLinks: setShowOnlyLinksFor } = useRiverScopeState();
  const workspaceId = useActiveWorkspaceId();
  const showOnlyLinks = getShowOnlyLinks(workspaceId);
  const setShowOnlyLinks = useCallback(
    (updater: (prev: ReadonlySet<string>) => ReadonlySet<string>) => setShowOnlyLinksFor(workspaceId, updater),
    [setShowOnlyLinksFor, workspaceId],
  );
  const { preferences } = usePreferences();
  const { query: searchQuery } = useSearch(saved);
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 250);

  const visibleFeedIdsSet = useMemo(() => visibleFeedIds(feeds, showOnlyLinks), [feeds, showOnlyLinks]);

  const scope = useMemo<RiverScope>(() => ({
    workspaceId,
    ...(saved ? { saved: true } : { feedIds: [...visibleFeedIdsSet] }),
    ...(!saved && preferences.hideReadItems ? { unreadOnly: true } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [workspaceId, saved, visibleFeedIdsSet, preferences.hideReadItems, debouncedSearch]);

  return { scope, visibleFeedIdsSet, showOnlyLinks, setShowOnlyLinks, debouncedSearch };
}
