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
  // If nothing stored, default to system-auto
  const stored = getStoredThemeKey();
  const [themeKey, setThemeKeyState] = useState(stored || "system-auto");
  const [currentMode, setCurrentMode] = useState(() => {
    const storedMode = localStorage.getItem("codesync.themeMode");
    return storedMode || "auto";
  });
  const [customThemes, setCustomThemes] = useState(() => loadCustomThemes());
  const mediaRef = useRef(null);

  // Aggregate themes (preset + custom)
  const themes = useMemo(() => {
    // getAllThemes reads custom from localStorage; but we also keep local state for immediate UI
    return { ...getAllThemes(), ...customThemes };
  }, [customThemes]);

  // Apply theme whenever themeKey, currentMode, or themes change
  useEffect(() => {
    const apply = () => {
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
    };

    apply();

    // Manage media query listener for system-auto or auto mode
    if ((themeKey === "system-auto" || currentMode === "auto") && typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mediaRef.current = mq;
      const onChange = () => apply();
      mq.addEventListener?.("change", onChange);
      return () => mq.removeEventListener?.("change", onChange);
    }
  }, [themeKey, currentMode, themes]);

  const setThemeKey = (key) => {
    setThemeKeyState(key);
    // Persist the choice; allow clearing when system-auto to reflect that behavior
    setStoredThemeKey(key);
  };

  const updateCurrentMode = (mode) => {
    setCurrentMode(mode);
    localStorage.setItem("codesync.themeMode", mode);
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