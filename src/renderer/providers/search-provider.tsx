import { createContext, useContext, useState, type PropsWithChildren } from "react";

interface SearchContextType {
  query: string;
  setQuery: (query: string) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearch = (): SearchContextType => {
  const context = useContext(SearchContext);

  if (context === undefined) {
    throw new Error("useSearch must be used within a SearchProvider");
  }

  return context;
};

// Mounted above the router outlet so the query survives navigating to the
// reader and back, while a restart of the app still starts with an empty search.
export const SearchProvider = ({ children }: PropsWithChildren) => {
  const [query, setQuery] = useState("");

  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      {children}
    </SearchContext.Provider>
  );
};
