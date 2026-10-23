// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { visibleFeedIds } from "@/lib/river/feed-visibility";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { RiverScope } from "@/lib/queries";
import { usePreferences } from "./preferences-provider";
import { useSearch } from "./search-provider";
import { useActiveWorkspaceId } from "./workspace-provider";
import type { FeedSummary } from "../../shared/contracts";

type ShowOnlyUpdater = (prev: ReadonlySet<string>) => ReadonlySet<string>;

interface RiverScopeContextType {
  getShowOnlyLinks: (workspaceId: number) => ReadonlySet<string>;
  setShowOnlyLinks: (workspaceId: number, updater: ShowOnlyUpdater) => void;
  getActiveSearchId: (workspaceId: number) => number | undefined;
  setActiveSearchId: (workspaceId: number, searchId: number | undefined) => void;
}

const NO_LINKS: ReadonlySet<string> = new Set();

const RiverScopeContext = createContext<RiverScopeContextType | undefined>(undefined);

export const useRiverScopeState = (): RiverScopeContextType => {
  const context = useContext(RiverScopeContext);

  if (context === undefined) {
    throw new Error("useRiverScopeState must be used within a RiverScopeProvider");
  }

  return context;
};

// Mounted above the router outlet, alongside SearchProvider, so the focus selection (and the
// river scope it feeds) survives navigating to the reader and back rather than resetting per route.
// Each workspace keeps its own set, so focusing a feed in one workspace never narrows another.
export const RiverScopeProvider = ({ children }: PropsWithChildren) => {
  const [showOnlyByWorkspace, setShowOnlyByWorkspace] = useState<ReadonlyMap<number, ReadonlySet<string>>>(() => new Map());

  const getShowOnlyLinks = useCallback(
    (workspaceId: number) => showOnlyByWorkspace.get(workspaceId) ?? NO_LINKS,
    [showOnlyByWorkspace],
  );

  const setShowOnlyLinks = useCallback((workspaceId: number, updater: ShowOnlyUpdater) => {
    setShowOnlyByWorkspace((prev) => {
      const current = prev.get(workspaceId) ?? NO_LINKS;
      const next = updater(current);
      if (next === current) {
        return prev;
      }
      const map = new Map(prev);
      if (next.size === 0) {
        map.delete(workspaceId);
      } else {
        map.set(workspaceId, next);
      }
      return map;
    });
  }, []);

  // The active saved search is only a highlight on the pill: the query text in the search box stays what the river is filtered by.
  const [activeSearchByWorkspace, setActiveSearchByWorkspace] = useState<ReadonlyMap<number, number>>(() => new Map());

  const getActiveSearchId = useCallback((workspaceId: number) => activeSearchByWorkspace.get(workspaceId), [activeSearchByWorkspace]);

  const setActiveSearchId = useCallback((workspaceId: number, searchId: number | undefined) => {
    setActiveSearchByWorkspace((prev) => {
      if (prev.get(workspaceId) === searchId) {
        return prev;
      }
      const map = new Map(prev);
      if (searchId === undefined) {
        map.delete(workspaceId);
      } else {
        map.set(workspaceId, searchId);
      }
      return map;
    });
  }, []);

  const value = useMemo(
    () => ({ getShowOnlyLinks, setShowOnlyLinks, getActiveSearchId, setActiveSearchId }),
    [getShowOnlyLinks, setShowOnlyLinks, getActiveSearchId, setActiveSearchId],
  );

  return (
    <RiverScopeContext.Provider value={value}>
      {children}
    </RiverScopeContext.Provider>
  );
};

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

/** The saved search whose pill is selected in the active workspace, if any. */
export function useActiveSearchId(): [number | undefined, (searchId: number | undefined) => void] {
  const { getActiveSearchId, setActiveSearchId } = useRiverScopeState();
  const workspaceId = useActiveWorkspaceId();
  const set = useCallback((searchId: number | undefined) => setActiveSearchId(workspaceId, searchId), [setActiveSearchId, workspaceId]);
  return [getActiveSearchId(workspaceId), set];
}
