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
  setThemeKey: (_key) => {},
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
  const [customThemes, setCustomThemes] = useState(() => loadCustomThemes());
  const mediaRef = useRef(null);

  // Aggregate themes (preset + custom)
  const themes = useMemo(() => {
    // getAllThemes reads custom from localStorage; but we also keep local state for immediate UI
    return { ...getAllThemes(), ...customThemes };
  }, [customThemes]);

  // Apply theme whenever themeKey or themes change
  useEffect(() => {
    const apply = () => {
      if (themeKey === "system-auto") {
        const mode = getSystemMode();
        const sysKey = mode === "dark" ? "system-dark" : "system-light";
        const theme = themes[sysKey] || themes["system-dark"];
        applyTheme(theme);
      } else {
        const theme = themes[themeKey] || themes["system-dark"];
        applyTheme(theme);
      }
    };

    apply();

    // Manage media query listener for system-auto
    if (themeKey === "system-auto" && typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mediaRef.current = mq;
      const onChange = () => apply();
      mq.addEventListener?.("change", onChange);
      return () => mq.removeEventListener?.("change", onChange);
    }
  }, [themeKey, themes]);

  const setThemeKey = (key) => {
    setThemeKeyState(key);
    // Persist the choice; allow clearing when system-auto to reflect that behavior
    setStoredThemeKey(key);
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
      value={{ themeKey, setThemeKey, themes, addCustomTheme, removeCustomTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}