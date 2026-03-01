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
const TRAILING_SLASH_REGEX = /\/+$/;

/**
 * Get the effective backend URL.
 * Returns the user-configured custom URL from localStorage if set,
 * otherwise falls back to the default BACKEND_API_URL.
 */
export const getBackendUrl = (): string => {
  if (typeof window === "undefined") {
    return BACKEND_API_URL;
  }
  const custom = localStorage.getItem(CUSTOM_BACKEND_KEY);
  return custom || BACKEND_API_URL;
};

/**
 * Set a custom backend URL (stored in localStorage).
 * The URL is normalized by trimming whitespace and removing trailing slashes.
 */
export const setCustomBackendUrl = (url: string): void => {
  const trimmed = url.trim().replace(TRAILING_SLASH_REGEX, "");
  if (trimmed) {
    localStorage.setItem(CUSTOM_BACKEND_KEY, trimmed);
  }
};

/**
 * Clear the custom backend URL, reverting to the default.
 */
export const clearCustomBackendUrl = (): void => {
  localStorage.removeItem(CUSTOM_BACKEND_KEY);
};

/**
 * Check if a custom backend URL is currently set.
 */
export const hasCustomBackendUrl = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(localStorage.getItem(CUSTOM_BACKEND_KEY));
};
