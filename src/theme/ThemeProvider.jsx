import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyTheme,
  getAllThemes,
  getStoredThemeKey,
  setStoredThemeKey,
  saveCustomThemes,
  loadCustomThemes,
  getSystemMode,
} from "./themes";

// React Context for theme
const ThemeContext = createContext({
  themeKey: "system-auto",
  currentMode: "auto",
  setThemeKey: (_key) => {},
  setCurrentMode: (_mode) => {},
  themes: {},
  addCustomTheme: (_key, _theme) => {},
  removeCustomTheme: (_key) => {},
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
  const [currentMode, setCurrentMode] = useState(() => {
    return "auto";
  });
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

        if (typeof window !== "undefined" && window.localStorage) {
          const storedMode = window.localStorage.getItem("codesync.themeMode");
          if (storedMode && storedMode !== currentMode) {
            setCurrentMode(storedMode);
          }
        }

        const customThemesData = loadCustomThemes();
        setCustomThemes(customThemesData);
        setIsInitialized(true);
      } catch (error) {
        console.warn('Theme initialization failed:', error);
        setIsInitialized(true); // Continue with defaults
      }
    };

    const handleThemeReinit = () => {
      console.log('Theme reinitialization requested');
      initializeTheme();
    };

    // Initialize immediately if DOM is ready, otherwise wait
    if (typeof window !== "undefined") {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTheme);
      } else {
        initializeTheme();
      }
      
      // Listen for theme reinit events (from SW compatibility layer)
      window.addEventListener('theme-reinit', handleThemeReinit);
    }

    return () => {
      if (typeof window !== "undefined") {
        document.removeEventListener?.('DOMContentLoaded', initializeTheme);
        window.removeEventListener?.('theme-reinit', handleThemeReinit);
      }
    };
  }, []);

  // Aggregate themes (preset + custom)
  const themes = useMemo(() => {
    // getAllThemes reads custom from localStorage; but we also keep local state for immediate UI
    return { ...getAllThemes(), ...customThemes };
  }, [customThemes]);

  // Apply theme whenever themeKey, currentMode, or themes change (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    const apply = () => {
      try {
        if (themeKey === "system-auto") {
          const systemMode = getSystemMode();
          const theme = themes["system"];
          applyTheme(theme, currentMode === "auto" ? systemMode : currentMode);
        } else {
          const theme = themes[themeKey];
          if (theme) {
            // For new format themes with modes
            if (theme.modes) {
              const modeToUse = currentMode === "auto" ? getSystemMode() : currentMode;
              applyTheme(theme, modeToUse);
            } else {
              // Legacy format - use theme.mode
              applyTheme(theme);
            }
          }
        }
      } catch (error) {
        console.warn('Theme application failed:', error);
      }
    };

    // Ensure DOM is ready before applying theme
    if (typeof window !== "undefined") {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
      } else {
        // Use requestAnimationFrame for better timing with cached content
        requestAnimationFrame(apply);
      }
    }

    // Manage media query listener for system-auto or auto mode
    if ((themeKey === "system-auto" || currentMode === "auto") && typeof window !== "undefined" && window.matchMedia) {
      try {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        mediaRef.current = mq;
        const onChange = () => {
          requestAnimationFrame(apply);
        };
        mq.addEventListener?.("change", onChange);
        return () => {
          mq.removeEventListener?.("change", onChange);
          document.removeEventListener?.('DOMContentLoaded', apply);
        };
      } catch (error) {
        console.warn('Media query listener setup failed:', error);
      }
    }
    
    return () => {
      if (typeof document !== "undefined" && document.removeEventListener) {
        document.removeEventListener('DOMContentLoaded', apply);
      }
    };
  }, [themeKey, currentMode, themes, isInitialized]);

  const setThemeKey = (key) => {
    setThemeKeyState(key);
    // Persist the choice; allow clearing when system-auto to reflect that behavior
    setStoredThemeKey(key);
  };

  const updateCurrentMode = (mode) => {
    setCurrentMode(mode);
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem("codesync.themeMode", mode);
      } catch (error) {
        console.warn('Failed to save theme mode:', error);
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
    const next = { ...customThemes };
    delete next[key];
    setCustomThemes(next);
    saveCustomThemes(next);
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
        removeCustomTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}