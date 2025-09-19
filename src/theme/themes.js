// Theme registry and helpers for applying OKLCH/HSL-based design tokens
// Now loads preset themes from ./presets/*.js so you can drop new files instead of bloating this file.

export const THEME_STORAGE_KEY = "codesync.theme";
export const CUSTOM_THEMES_STORAGE_KEY = "codesync.customThemes";

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "custom";
}

// Build preset themes from files in ./presets
// Each preset file must export default: { name, mode: "light"|"dark", tokens: {...} }
const presetModules = import.meta.glob("./presets/*.js", {
  eager: true,
  import: "default",
});

/**
 * Create a key for the theme using file name or theme name+mode.
 * Keeps "system" stable for the consolidated system theme.
 */
function keyFromTheme(filePath, theme) {
  const fileBase = filePath.split("/").pop().replace(/\.js$/, "");
  if (fileBase === "system") {
    return "system";
  }
  const base = theme?.name ? slugify(theme.name) : slugify(fileBase);
  return theme?.mode ? `${base}-${theme.mode}` : base;
}

function buildPresetThemes() {
  const out = {};
  for (const [path, theme] of Object.entries(presetModules)) {
    if (!theme || typeof theme !== "object") continue;
    const k = keyFromTheme(path, theme);
    out[k] = theme;
  }
  return out;
}

export const presetThemes = buildPresetThemes();

// Apply theme with specific mode
export function applyTheme(theme, mode = null) {
  if (!theme || typeof window === "undefined" || !document?.documentElement) return;
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

  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
}

// Load custom themes saved in localStorage
export function loadCustomThemes() {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCustomThemes(customThemes) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(customThemes));
  } catch {
    // ignore
  }
}

export function getAllThemes() {
  // Merge preset themes (from files) with custom themes (from localStorage)
  return { ...presetThemes, ...loadCustomThemes() };
}

export function getStoredThemeKey() {
  // return null if not set to allow system preference default via ThemeProvider (system-auto)
  if (typeof window === "undefined") return null;
  return localStorage.getItem(THEME_STORAGE_KEY) || null;
}

export function setStoredThemeKey(key) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, key);
  } catch {
    // ignore
  }
}

// Helpers for "System" mode
export function getSystemMode() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
    while ((match = re.exec(block))) {
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
  const safe = (s) =>
    String(s || "custom").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

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
    defaultMode: modes.dark ? "dark" : "light"
  };
}

// Legacy function for backward compatibility - creates separate themes
export function createThemesFromCss(baseName, cssText, includeDark = true) {
  const theme = createThemeFromCss(baseName, cssText);
  const themes = {};
  const safe = (s) =>
    String(s || "custom").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

  if (theme.modes.light) {
    themes[`${safe(baseName)}-light`] = {
      name: `${baseName} Light`,
      mode: "light",
      tokens: theme.modes.light
    };
  }

  if (includeDark && theme.modes.dark) {
    themes[`${safe(baseName)}-dark`] = {
      name: `${baseName} Dark`,
      mode: "dark",
      tokens: theme.modes.dark
    };
  }

  return themes;
}