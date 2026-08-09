import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);

    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }

    return context;
};

interface ThemeProviderProps {
    children: ReactNode;
    /**
     * The class to add to the root element when the theme is dark
     * @default "dark-mode"
     */
    darkModeClass?: string;
    /**
     * The default theme to use if no theme is stored in localStorage
     * @default "system"
     */
    defaultTheme?: Theme;
    /**
     * The key to use to store the theme in localStorage
     * @default "ui-theme"
     */
    storageKey?: string;
}

export const ThemeProvider = ({ children, defaultTheme = "system", storageKey = "ui-theme", darkModeClass = "dark-mode" }: ThemeProviderProps) => {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== "undefined") {
            const savedTheme = localStorage.getItem(storageKey) as Theme | null;
            return savedTheme || defaultTheme;
        }
        return defaultTheme;
    });
    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

    useEffect(() => {
        const applyTheme = () => {
            const root = window.document.documentElement;
            const effectiveTheme: ResolvedTheme =
                theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;

            root.classList.toggle(darkModeClass, effectiveTheme === "dark");
            setResolvedTheme(effectiveTheme);

            if (theme === "system") {
                localStorage.removeItem(storageKey);
            } else {
                localStorage.setItem(storageKey, theme);
            }
        };

        applyTheme();

        // Listen for system theme changes
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

        const handleChange = () => {
            if (theme === "system") {
                applyTheme();
            }
        };

        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [theme]);

    return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
};
