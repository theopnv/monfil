// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";

type ShowOnlyUpdater = (prev: ReadonlySet<string>) => ReadonlySet<string>;

interface RiverScopeContextType {
  getShowOnlyLinks: (workspaceId: number) => ReadonlySet<string>;
  setShowOnlyLinks: (workspaceId: number, updater: ShowOnlyUpdater) => void;
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

  const value = useMemo(() => ({ getShowOnlyLinks, setShowOnlyLinks }), [getShowOnlyLinks, setShowOnlyLinks]);

  return (
    <RiverScopeContext.Provider value={value}>
      {children}
    </RiverScopeContext.Provider>
  );
};
