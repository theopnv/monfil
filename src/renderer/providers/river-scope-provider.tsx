import { createContext, useCallback, useContext, useState, type PropsWithChildren } from "react";

interface RiverScopeContextType {
  showOnlyLinks: ReadonlySet<string>;
  setShowOnlyLinks: (updater: (prev: ReadonlySet<string>) => ReadonlySet<string>) => void;
}

const RiverScopeContext = createContext<RiverScopeContextType | undefined>(undefined);

export const useRiverScopeState = (): RiverScopeContextType => {
  const context = useContext(RiverScopeContext);

  if (context === undefined) {
    throw new Error("useRiverScopeState must be used within a RiverScopeProvider");
  }

  return context;
};

// Mounted above the router outlet, alongside SearchProvider, so the solo/hide selection (and the
// river scope it feeds) survives navigating to the reader and back rather than resetting per route.
export const RiverScopeProvider = ({ children }: PropsWithChildren) => {
  const [showOnlyLinks, setShowOnlyLinksState] = useState<ReadonlySet<string>>(() => new Set());
  const setShowOnlyLinks = useCallback((updater: (prev: ReadonlySet<string>) => ReadonlySet<string>) => {
    setShowOnlyLinksState(updater);
  }, []);

  return (
    <RiverScopeContext.Provider value={{ showOnlyLinks, setShowOnlyLinks }}>
      {children}
    </RiverScopeContext.Provider>
  );
};
