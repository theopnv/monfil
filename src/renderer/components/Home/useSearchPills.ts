// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback, useEffect } from "react";
import { announce } from "@/lib/announcer";
import { notifyUndo } from "@/lib/notifications";
import { usePreferences } from "@/providers/preferences-provider";
import { useActiveSearchId } from "@/providers/river-scope-provider";
import { useSavedSearchActions, useSavedSearches } from "@/providers/saved-searches-provider";
import type { SavedSearchSummary } from "../../../shared/contracts";

export interface SearchPillsState {
  searches: SavedSearchSummary[];
  activeSearch: SavedSearchSummary | undefined;
  hintExample: string | undefined;
  toggle: (search: SavedSearchSummary) => void;
  remove: (search: SavedSearchSummary) => void;
  rename: (search: SavedSearchSummary, name: string) => Promise<string | undefined>;
  create: (name: string) => Promise<string | undefined>;
  update: () => Promise<string | undefined>;
  applyExample: (example: string) => void;
  dismissHint: () => void;
}

/**
 * Ties the saved-search pills to the search box. The query text stays the source of truth for the
 * river; a pill only fills it in and remembers which pill did.
 */
export function useSearchPills(searchQuery: string, setSearchQuery: (query: string) => void): SearchPillsState {
  const { searches, hintExample } = useSavedSearches();
  const actions = useSavedSearchActions();
  const { setPreference } = usePreferences();
  const [activeId, setActiveId] = useActiveSearchId();
  const activeSearch = searches.find((search) => search.id === activeId);

  useEffect(() => {
    if (activeId !== undefined && searchQuery.trim() === "") {
      setActiveId(undefined);
    }
  }, [activeId, searchQuery, setActiveId]);

  const toggle = useCallback((search: SavedSearchSummary) => {
    if (search.id === activeId) {
      setActiveId(undefined);
      setSearchQuery("");
      announce(`Cleared saved search ${search.name}.`);
      return;
    }
    setActiveId(search.id);
    setSearchQuery(search.query);
    // A job must stay in its search on the days after it was read, so a pill shows read and unread matches.
    setPreference("hideReadItems", false);
    announce(`Showing saved search ${search.name}.`);
  }, [activeId, setActiveId, setSearchQuery, setPreference]);

  const create = useCallback(async (name: string) => {
    const query = searchQuery.trim();
    const result = await actions.create(name, query);
    if (!result.success) {
      return result.error.message;
    }
    setActiveId(result.data.id);
    announce(`Saved search ${result.data.name} created.`);
    return undefined;
  }, [actions, searchQuery, setActiveId]);

  const update = useCallback(async () => {
    if (!activeSearch) {
      return undefined;
    }
    const result = await actions.update(activeSearch.id, { query: searchQuery.trim() });
    if (!result.success) {
      return result.error.message;
    }
    announce(`Saved search ${activeSearch.name} updated.`);
    return undefined;
  }, [actions, activeSearch, searchQuery]);

  const rename = useCallback(async (search: SavedSearchSummary, name: string) => {
    const result = await actions.update(search.id, { name });
    if (!result.success) {
      return result.error.message;
    }
    announce(`Saved search renamed to ${result.data.name}.`);
    return undefined;
  }, [actions]);

  const remove = useCallback((search: SavedSearchSummary) => {
    void actions.remove(search.id).then((result) => {
      if (!result.success) {
        return;
      }
      if (search.id === activeId) {
        setActiveId(undefined);
        setSearchQuery("");
      }
      announce(`Saved search ${search.name} deleted. Undo is available.`);
      notifyUndo(`Deleted "${search.name}"`, () => {
        void actions.create(search.name, search.query).then((restored) => {
          if (restored.success) {
            announce(`Saved search ${search.name} restored.`);
          }
        });
      });
    });
  }, [actions, activeId, setActiveId, setSearchQuery]);

  const applyExample = useCallback((example: string) => {
    setSearchQuery(example);
  }, [setSearchQuery]);

  const dismissHint = useCallback(() => {
    void actions.dismissHint();
  }, [actions]);

  return { searches, activeSearch, hintExample, toggle, remove, rename, create, update, applyExample, dismissHint };
}
