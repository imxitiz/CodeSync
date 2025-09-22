// Theme registry and helpers for applying OKLCH/HSL-based design tokens
// Now loads preset themes from ./presets/*.js so you can drop new files instead of bloating this file.

export const THEME_STORAGE_KEY = "codesync.theme";
export const CUSTOM_THEMES_STORAGE_KEY = "codesync.customThemes";

function slugify(name) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "custom"
  );
}

// Build preset themes from files in ./presets
// Each preset file must export default: { name, mode: "light"|"dark", tokens: {...} }
const presetModules = import.meta.glob("./presets/*.js", {
  eager: true,
  import: "default",
});

const JS_FILE_REGEX = /\.js$/i;
/**
 * Create a key for the theme using file name or theme name+mode.
 * Keeps "system" stable for the consolidated system theme.
 */
function keyFromTheme(filePath, theme) {
  const fileBase = filePath.split("/").pop().replace(JS_FILE_REGEX, "");
  if (fileBase === "system") {
    return "system";
  }
  const base = theme?.name ? slugify(theme.name) : slugify(fileBase);
  return theme?.mode ? `${base}-${theme.mode}` : base;
}

function buildPresetThemes() {
  const out = {};
  for (const [path, theme] of Object.entries(presetModules)) {
    if (!theme || typeof theme !== "object") {
      continue;
    }
    const k = keyFromTheme(path, theme);
    out[k] = theme;
  }
  return out;
}

export const presetThemes = buildPresetThemes();

// Apply theme with specific mode - enhanced for service worker compatibility
export function applyTheme(theme, mode = null) {
  // Enhanced checks for service worker cached content
  if (!theme) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }

  // Ensure DOM is ready and document is available
  if (!document?.documentElement) {
    // If document is not ready, try again after DOM loads
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        applyTheme(theme, mode)
      );
      return;
    }
    // Last resort - wait for next tick
    setTimeout(() => applyTheme(theme, mode), 0);
    return;
  }

  const root = document.documentElement;

  // Determine which mode to use
  const activeMode = mode || theme.defaultMode || "dark";

  // Toggle dark mode class for Tailwind variant utilities
  if (activeMode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Get tokens for the active mode
  const tokens = theme.modes?.[activeMode] || theme.tokens || {};

  for (const key of Object.keys(tokens)) {
    root.style.setProperty(`--${key}`, tokens[key]);
  }
}

// Load custom themes saved in localStorage
export function loadCustomThemes() {
  if (typeof window === "undefined") {
    return {};
  }

  // Ensure localStorage is available (can be null in some SW contexts)
  if (!window.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch (_error) {
    return {};
  }
}

export function saveCustomThemes(customThemes) {
  if (typeof window === "undefined") {
    return;
  }

  // Ensure localStorage is available
  if (!window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(
      CUSTOM_THEMES_STORAGE_KEY,
      JSON.stringify(customThemes)
    );
  } catch (_error) {}
}

export function getAllThemes() {
  // Merge preset themes (from files) with custom themes (from localStorage)
  return { ...presetThemes, ...loadCustomThemes() };
}

export function getStoredThemeKey() {
  // return null if not set to allow system preference default via ThemeProvider (system-auto)
  if (typeof window === "undefined") {
    return null;
  }

  // Ensure localStorage is available
  if (!window.localStorage) {
    return null;
  }

  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) || null;
  } catch (_error) {
    return null;
  }
}

export function setStoredThemeKey(key) {
  if (typeof window === "undefined") {
    return;
  }

  // Ensure localStorage is available
  if (!window.localStorage) {
    return;
  }

  try {
    if (key === null || key === "system-auto") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, key);
    }
  } catch (_error) {}
}

// Helpers for "System" mode
export function getSystemMode() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Parse CSS variables exported from tweakcn (.css content)
// Returns { lightTokens, darkTokens }
export function parseCssVariables(cssText) {
  const extractBlock = (selector) => {
    const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`, "m");
    const m = cssText.match(re);
    return m ? m[1] : "";
  };

  const parseVars = (block) => {
    const vars = {};
    const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let match;
    while (true) {
      match = re.exec(block);
      if (!match) {
        break;
      }
      vars[match[1]] = match[2].trim();
    }
    return vars;
  };

  const lightBlock = extractBlock(":root");
  const darkBlock = extractBlock("\\.dark");

  const lightTokens = parseVars(lightBlock);
  const darkTokens = parseVars(darkBlock);

  return { lightTokens, darkTokens };
}

// Build single theme from tweakcn CSS string with both light and dark modes
export function createThemeFromCss(baseName, cssText) {
  const { lightTokens, darkTokens } = parseCssVariables(cssText);

  const modes = {};

  if (Object.keys(lightTokens).length) {
    modes.light = lightTokens;
  }

  if (Object.keys(darkTokens).length) {
    modes.dark = darkTokens;
  }

  // If only one mode exists, duplicate it to the other
  if (modes.light && !modes.dark) {
    modes.dark = { ...modes.light };
  } else if (modes.dark && !modes.light) {
    modes.light = { ...modes.dark };
  }

  return {
    name: baseName,
    modes,
    defaultMode: modes.dark ? "dark" : "light",
  };
}

// Legacy function for backward compatibility - creates separate themes
export function createThemesFromCss(baseName, cssText, includeDark = true) {
  const theme = createThemeFromCss(baseName, cssText);
  const themes = {};
  const safe = (s) =>
    String(s || "custom")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  if (theme.modes.light) {
    themes[`${safe(baseName)}-light`] = {
      name: `${baseName} Light`,
      mode: "light",
      tokens: theme.modes.light,
    };
  }

  if (includeDark && theme.modes.dark) {
    themes[`${safe(baseName)}-dark`] = {
      name: `${baseName} Dark`,
      mode: "dark",
      tokens: theme.modes.dark,
    };
  }

  return themes;
}
