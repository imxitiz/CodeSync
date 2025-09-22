import {
  createContext,
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

// React Context for theme
const ThemeContext = createContext({
  themeKey: "system-auto",
  currentMode: "auto",
  setThemeKey: (_key) => {
    // Default context function - should be overridden by provider
  },
  setCurrentMode: (_mode) => {
    // Default context function - should be overridden by provider
  },
  themes: {},
  addCustomTheme: (_key, _theme) => {
    // Default context function - should be overridden by provider
  },
  removeCustomTheme: (_key) => {
    // Default context function - should be overridden by provider
  },
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
  // Enhanced initialization for service worker compatibility
  const [themeKey, setThemeKeyState] = useState(() => {
    // Delay localStorage access until after mount for better SW compatibility
    return "system-auto";
  });
  const [currentMode, setCurrentMode] = useState(() => "auto");
  const [customThemes, setCustomThemes] = useState({});
  const [isInitialized, setIsInitialized] = useState(false);
  const mediaRef = useRef(null);

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
        setCustomThemes(customThemesData);
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
  const themes = useMemo(() => {
    // getAllThemes reads custom from localStorage; but we also keep local state for immediate UI
    return { ...getAllThemes(), ...customThemes };
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
            if (theme.modes) {
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

  const setThemeKey = (key) => {
    setThemeKeyState(key);
    // Persist the choice; allow clearing when system-auto to reflect that behavior
    setStoredThemeKey(key);
  };

  const updateCurrentMode = (mode) => {
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
  const addCustomTheme = (key, theme) => {
    const next = { ...customThemes, [key]: theme };
    setCustomThemes(next);
    saveCustomThemes(next);
    // Immediately apply if selected
    if (key === themeKey) {
      applyTheme(theme);
    }
  };

  const removeCustomTheme = (key) => {
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
