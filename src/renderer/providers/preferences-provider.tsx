import { createContext, useCallback, useContext, useState, type PropsWithChildren } from "react";
import { loadPreferences, savePreference, type Preferences } from "@/lib/preferences";

interface PreferencesContextType {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const usePreferences = (): PreferencesContextType => {
  const context = useContext(PreferencesContext);

  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }

  return context;
};

export const PreferencesProvider = ({ children }: PropsWithChildren) => {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);

  const setPreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    savePreference(key, value);
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <PreferencesContext.Provider value={{ preferences, setPreference }}>
      {children}
    </PreferencesContext.Provider>
  );
};
