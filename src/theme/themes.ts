// Theme registry and helpers for applying OKLCH/HSL-based design tokens
// Now loads preset themes from ./presets/*.js so you can drop new files instead of bloating this file.

export const THEME_STORAGE_KEY = "codesync.theme";
export const CUSTOM_THEMES_STORAGE_KEY = "codesync.customThemes";

// Type definitions
export type ThemeTokens = {
  [key: string]: string;
};

export type LegacyTheme = {
  name?: string;
  mode: "light" | "dark";
  tokens: ThemeTokens;
};

export type ModernTheme = {
  name: string;
  modes: {
    light: ThemeTokens;
    dark: ThemeTokens;
  };
  defaultMode: "light" | "dark";
};

export type Theme = LegacyTheme | ModernTheme;

// Type guard functions
export function isModernTheme(theme: Theme): theme is ModernTheme {
  return "modes" in theme && "defaultMode" in theme;
}

function slugify(name: string | null | undefined): string {
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
// biome-ignore lint/suspicious/noExplicitAny: Vite glob requires any type for dynamic imports
const presetModules = (import.meta as any).glob("./presets/*.ts", {
  eager: true,
  import: "default",
}) as Record<string, Theme>;

const JS_FILE_REGEX = /\.js$/i;
/**
 * Create a key for the theme using file name or theme name+mode.
 * Keeps "system" stable for the consolidated system theme.
 */
function keyFromTheme(filePath: string, theme: Theme): string {
  const fileBase = filePath.split("/").pop()?.replace(JS_FILE_REGEX, "") || "";
  if (fileBase === "system") {
    return "system";
  }
  const base = theme?.name ? slugify(theme.name) : slugify(fileBase);
  return base;
}

function buildPresetThemes(): Record<string, Theme> {
  const out: Record<string, Theme> = {};
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
export function applyTheme(
  theme: Theme | null | undefined,
  mode: string | null = null
): void {
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
  const activeMode: "light" | "dark" =
    (mode as "light" | "dark") ||
    (isModernTheme(theme) ? theme.defaultMode : theme.mode) ||
    "dark";

  // Toggle dark mode class for Tailwind variant utilities
  if (activeMode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Get tokens for the active mode
  let tokens: ThemeTokens = {};
  if (isModernTheme(theme)) {
    tokens = theme.modes[activeMode];
  } else if (theme.mode === activeMode) {
    tokens = theme.tokens;
  }

  for (const key of Object.keys(tokens)) {
    const value = tokens[key];
    if (value !== undefined) {
      root.style.setProperty(`--${key}`, value);
    }
  }
}

// Load custom themes saved in localStorage
export function loadCustomThemes(): Record<string, Theme> {
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

export function saveCustomThemes(customThemes: Record<string, Theme>): void {
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

export function getAllThemes(): Record<string, Theme> {
  // Merge preset themes (from files) with custom themes (from localStorage)
  return { ...presetThemes, ...loadCustomThemes() };
}

export function getStoredThemeKey(): string | null {
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

export function setStoredThemeKey(key: string | null): void {
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
export function parseCssVariables(cssText: string): {
  lightTokens: ThemeTokens;
  darkTokens: ThemeTokens;
} {
  const extractBlock = (selector: string): string => {
    const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`, "m");
    const m = cssText.match(re);
    return m ? m[1] || "" : "";
  };

  const parseVars = (block: string): ThemeTokens => {
    const vars: ThemeTokens = {};
    const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let match: RegExpExecArray | null;
    while (true) {
      match = re.exec(block);
      if (!match) {
        break;
      }
      if (match[1] && match[2]) {
        vars[match[1]] = match[2].trim();
      }
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
export function createThemeFromCss(
  baseName: string,
  cssText: string
): ModernTheme {
  const { lightTokens, darkTokens } = parseCssVariables(cssText);

  const modes: { light?: ThemeTokens; dark?: ThemeTokens } = {};

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
    modes: modes as { light: ThemeTokens; dark: ThemeTokens },
    defaultMode: modes.dark ? "dark" : "light",
  };
}
