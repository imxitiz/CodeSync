import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyTheme,
  getAllThemes,
  getStoredThemeKey,
  getSystemMode,
  loadCustomThemes,
  saveCustomThemes,
  setStoredThemeKey,
} from "./themes";

// Type definitions for theme system
type ThemeTokens = {
  [key: string]: string;
};

type LegacyTheme = {
  name?: string;
  mode: "light" | "dark";
  tokens: ThemeTokens;
};

type ModernTheme = {
  name: string;
  modes: {
    light: ThemeTokens;
    dark: ThemeTokens;
  };
  defaultMode: "light" | "dark";
};

type Theme = LegacyTheme | ModernTheme;

// Type guard functions
function isModernTheme(theme: Theme): theme is ModernTheme {
  return "modes" in theme && "defaultMode" in theme;
}

type ThemeContextValue = {
  themeKey: string;
  currentMode: string;
  setThemeKey: (key: string) => void;
  setCurrentMode: (mode: string) => void;
  themes: Record<string, Theme>;
  addCustomTheme: (key: string, theme: Theme) => void;
  removeCustomTheme: (key: string) => void;
};

type ThemeProviderProps = {
  children: ReactNode;
};

// React Context for theme
const ThemeContext = createContext<ThemeContextValue>({
  themeKey: "system-auto",
  currentMode: "auto",
  setThemeKey: (_key: string) => {
    // Default context function - should be overridden by provider
  },
  setCurrentMode: (_mode: string) => {
    // Default context function - should be overridden by provider
  },
  themes: {},
  addCustomTheme: (_key: string, _theme: Theme) => {
    // Default context function - should be overridden by provider
  },
  removeCustomTheme: (_key: string) => {
    // Default context function - should be overridden by provider
  },
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  // Enhanced initialization for service worker compatibility
  const [themeKey, setThemeKeyState] = useState<string>(() => {
    // Delay localStorage access until after mount for better SW compatibility
    return "system-auto";
  });
  const [currentMode, setCurrentMode] = useState<string>(() => "auto");
  const [customThemes, setCustomThemes] = useState<Record<string, Theme>>({});
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const mediaRef = useRef<MediaQueryList | null>(null);

  // Initialize theme after component mounts (better SW compatibility)
  useEffect(() => {
    const initializeTheme = () => {
      try {
        const stored = getStoredThemeKey();
        if (stored && stored !== themeKey) {
          setThemeKeyState(stored);
        }

        if (window?.localStorage) {
          const storedMode = window.localStorage.getItem("codesync.themeMode");
          if (storedMode && storedMode !== currentMode) {
            setCurrentMode(storedMode);
          }
        }

        const customThemesData = loadCustomThemes();
        if (customThemesData) {
          setCustomThemes(customThemesData as Record<string, Theme>);
        }
        setIsInitialized(true);
      } catch (_error) {
        // Ignore initialization errors for better SW compatibility
        setIsInitialized(true); // Continue with defaults
      }
    };

    const handleThemeReinit = () => {
      initializeTheme();
    };

    // Initialize immediately if DOM is ready, otherwise wait
    if (typeof window !== "undefined") {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeTheme);
      } else {
        initializeTheme();
      }

      // Listen for theme reinit events (from SW compatibility layer)
      window.addEventListener("theme-reinit", handleThemeReinit);
    }

    return () => {
      if (typeof window !== "undefined") {
        document.removeEventListener?.("DOMContentLoaded", initializeTheme);
        window.removeEventListener?.("theme-reinit", handleThemeReinit);
      }
    };
  }, [currentMode, themeKey]);

  // Aggregate themes (preset + custom)
  const themes = useMemo((): Record<string, Theme> => {
    // getAllThemes reads custom from localStorage; but we also keep local state for immediate UI
    const allThemes = getAllThemes();
    return { ...allThemes, ...customThemes } as Record<string, Theme>;
  }, [customThemes]);

  // Apply theme whenever themeKey, currentMode, or themes change (only after initialization)
  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    const getEffectiveMode = () =>
      currentMode === "auto" ? getSystemMode() : currentMode;

    const applyThemeForKey = () => {
      try {
        if (themeKey === "system-auto") {
          const theme = themes.system;
          applyTheme(theme, getEffectiveMode());
        } else {
          const theme = themes[themeKey];
          if (theme) {
            // For new format themes with modes
            if (isModernTheme(theme as Theme)) {
              applyTheme(theme, getEffectiveMode());
            } else {
              // Legacy format - use theme.mode
              applyTheme(theme);
            }
          }
        }
      } catch (_error) {
        // Ignore initialization errors for better SW compatibility
      }
    };

    const setupDomReadyApplication = () => {
      if (typeof window !== "undefined") {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", applyThemeForKey);
        } else {
          // Use requestAnimationFrame for better timing with cached content
          requestAnimationFrame(applyThemeForKey);
        }
      }
    };

    const setupMediaQueryListener = () => {
      if (
        (themeKey === "system-auto" || currentMode === "auto") &&
        typeof window !== "undefined" &&
        window.matchMedia
      ) {
        try {
          const mq = window.matchMedia("(prefers-color-scheme: dark)");
          mediaRef.current = mq;
          const onChange = () => {
            requestAnimationFrame(applyThemeForKey);
          };
          mq.addEventListener?.("change", onChange);
          return () => {
            mq.removeEventListener?.("change", onChange);
            document.removeEventListener?.(
              "DOMContentLoaded",
              applyThemeForKey
            );
          };
        } catch (_error) {
          // Ignore media query setup errors
        }
      }
      return () => {
        if (document?.removeEventListener) {
          document.removeEventListener("DOMContentLoaded", applyThemeForKey);
        }
      };
    };

    setupDomReadyApplication();
    const cleanupMediaQuery = setupMediaQueryListener();

    return () => {
      cleanupMediaQuery();
    };
  }, [themeKey, currentMode, themes, isInitialized]);

  const setThemeKey = (key: string): void => {
    setThemeKeyState(key);
    // Persist the choice; allow clearing when system-auto to reflect that behavior
    setStoredThemeKey(key);
  };

  const updateCurrentMode = (mode: string): void => {
    setCurrentMode(mode);
    if (window?.localStorage) {
      try {
        window.localStorage.setItem("codesync.themeMode", mode);
      } catch (_error) {
        // Ignore localStorage errors
      }
    }
  };

  // Allow adding/removing custom themes
  const addCustomTheme = (key: string, theme: Theme): void => {
    const next = { ...customThemes, [key]: theme };
    setCustomThemes(next);
    saveCustomThemes(next);
    // Immediately apply if selected
    if (key === themeKey) {
      applyTheme(theme);
    }
  };

  const removeCustomTheme = (key: string): void => {
    const updatedThemes = { ...customThemes };
    delete updatedThemes[key];
    setCustomThemes(updatedThemes);
    saveCustomThemes(updatedThemes);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeKey,
        currentMode,
        setThemeKey,
        setCurrentMode: updateCurrentMode,
        themes,
        addCustomTheme,
        removeCustomTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
