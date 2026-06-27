// Pure validation & permission logic extracted from socket.ts for testability

export type UserPermissions = {
  canEdit: boolean;
  canCreateTab: boolean;
  canDeleteTab: boolean;
  canRenameTab: boolean;
};

export type TabData = { name: string; code: string };

export const DEFAULT_TAB_ID = "tab-main";
export const DEFAULT_TAB_NAME = "main.js";
export const MAX_TABS_PER_ROOM = 10;
export const MAX_TAB_ID_LENGTH = 80;
export const MAX_TAB_NAME_LENGTH = 64;
export const MAX_CODE_LENGTH = 1_000_000;
export const TAB_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export const DEFAULT_PERMISSIONS: UserPermissions = {
  canEdit: false,
  canCreateTab: false,
  canDeleteTab: false,
  canRenameTab: false,
};

export const OWNER_PERMISSIONS: UserPermissions = {
  canEdit: true,
  canCreateTab: true,
  canDeleteTab: true,
  canRenameTab: true,
};

export const sanitizeTabName = (name: unknown): string | null => {
  if (typeof name !== "string") {
    return null;
  }
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_TAB_NAME_LENGTH) {
    return null;
  }
  return trimmed;
};

export const isValidTabId = (tabId: unknown): tabId is string =>
  typeof tabId === "string" &&
  tabId.length > 0 &&
  tabId.length <= MAX_TAB_ID_LENGTH &&
  TAB_ID_REGEX.test(tabId);

export const isValidCode = (code: unknown): code is string =>
  typeof code === "string" && code.length <= MAX_CODE_LENGTH;

export const normalizePermissions = (
  value: unknown
): UserPermissions | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const input = value as Record<string, unknown>;
  const allowedKeys = [
    "canEdit",
    "canCreateTab",
    "canDeleteTab",
    "canRenameTab",
  ];
  if (Object.keys(input).some((key) => !allowedKeys.includes(key))) {
    return null;
  }
  if (
    typeof input.canEdit !== "boolean" ||
    typeof input.canCreateTab !== "boolean" ||
    typeof input.canDeleteTab !== "boolean" ||
    typeof input.canRenameTab !== "boolean"
  ) {
    return null;
  }
  return {
    canEdit: input.canEdit as boolean,
    canCreateTab: input.canCreateTab as boolean,
    canDeleteTab: input.canDeleteTab as boolean,
    canRenameTab: input.canRenameTab as boolean,
  };
};

/**
 * Compute effective permissions for a user.
 * If canEdit is false, all other permissions are forced to false.
 * If canEdit is true, other permissions are preserved.
 */
export const computeEffectivePermissions = (
  permissions: UserPermissions
): UserPermissions => {
  if (!permissions.canEdit) {
    return { ...DEFAULT_PERMISSIONS };
  }
  return {
    canEdit: true,
    canCreateTab: permissions.canCreateTab,
    canDeleteTab: permissions.canDeleteTab,
    canRenameTab: permissions.canRenameTab,
  };
};

/**
 * Check if a user can perform a given action based on their permissions
 * and the current editor state.
 */
export const canUserEdit = (
  userName: string,
  roomCreator: string,
  userPerms: UserPermissions,
  currentEditor: string
): boolean => {
  if (roomCreator === userName) {
    return true;
  }
  if (!userPerms.canEdit) {
    return false;
  }
  return currentEditor === "" || currentEditor === userName;
};
