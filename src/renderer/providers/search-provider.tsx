// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createContext, useContext, useState, type PropsWithChildren } from "react";

interface SearchContextType {
  query: string;
  setQuery: (query: string) => void;
}

const SearchContext = createContext<{ feed: SearchContextType; saved: SearchContextType } | undefined>(undefined);

export const useSearch = (saved = false): SearchContextType => {
  const context = useContext(SearchContext);

  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }

  return saved ? context.saved : context.feed;
};

// Mounted above the router outlet so the query survives navigating to the
// reader and back, while a restart of the app still starts with an empty search.
export const SearchProvider = ({ children }: PropsWithChildren) => {
  const [query, setQuery] = useState("");
  const [savedQuery, setSavedQuery] = useState("");

  return (
    <SearchContext.Provider value={{ feed: { query, setQuery }, saved: { query: savedQuery, setQuery: setSavedQuery } }}>
      {children}
    </SearchContext.Provider>
  );
};
