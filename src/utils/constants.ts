export const ACTIONS = {
  JOIN: "join",
  JOINED: "joined",
  DISCONNECTED: "disconnected",
  CODE_CHANGE: "code-change",
  SYNC_CODE: "sync-code",
  LEAVE: "leave",
  USER_JOINED: "user-joined",
  USER_LEFT: "user-left",
  CHANGE_EDITOR: "change-editor",
  EDITOR_CHANGED: "editor-changed",
  GRANT_EDIT: "grant-edit",
  EDIT_GRANTED: "edit-granted",
  REVOKE_EDIT: "revoke-edit",
  EDIT_REVOKED: "edit-revoked",
  SET_CURRENT_EDITOR: "set_current_editor",
  DUPLICATE_USER: "duplicate-user",
} as const;

export type ACTIONS = (typeof ACTIONS)[keyof typeof ACTIONS];

export const BACKEND_API_URL: string =
  import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3000";

const CUSTOM_BACKEND_KEY = "codesync_custom_backend_url";

const normalizeBackendUrl = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

const readCustomBackendUrl = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!window.localStorage) {
    return null;
  }
  try {
    return window.localStorage.getItem(CUSTOM_BACKEND_KEY);
  } catch {
    return null;
  }
};

const writeCustomBackendUrl = (value: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (!window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(CUSTOM_BACKEND_KEY, value);
  } catch {}
};

const removeCustomBackendUrl = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (!window.localStorage) {
    return;
  }
  try {
    window.localStorage.removeItem(CUSTOM_BACKEND_KEY);
  } catch {}
};

/**
 * Get the effective backend URL.
 * Returns the user-configured custom URL from localStorage if set,
 * otherwise falls back to the default BACKEND_API_URL.
 */
export const getBackendUrl = (): string => {
  const custom = normalizeBackendUrl(readCustomBackendUrl());
  return custom || BACKEND_API_URL;
};

export const isValidBackendUrl = (value: string): boolean =>
  Boolean(normalizeBackendUrl(value));

/**
 * Set a custom backend URL (stored in localStorage).
 * Only accepts http(s) origins without a path, query, or hash.
 */
export const setCustomBackendUrl = (url: string): void => {
  const normalized = normalizeBackendUrl(url);
  if (!normalized) {
    return;
  }
  writeCustomBackendUrl(normalized);
};

/**
 * Clear the custom backend URL, reverting to the default.
 */
export const clearCustomBackendUrl = (): void => {
  removeCustomBackendUrl();
};

/**
 * Check if a custom backend URL is currently set.
 */
export const hasCustomBackendUrl = (): boolean =>
  Boolean(normalizeBackendUrl(readCustomBackendUrl()));
