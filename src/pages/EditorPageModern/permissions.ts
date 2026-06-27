import type { UserPermissions } from "./types";

export const DEFAULT_TAB_ID = "tab-main";
export const DEFAULT_TAB_NAME = "main.js";

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

/** Single source of truth — add new permissions here. */
export const PERMISSION_KEYS: (keyof UserPermissions)[] = [
  "canEdit",
  "canCreateTab",
  "canDeleteTab",
  "canRenameTab",
];

export const PERMISSION_LABELS: Record<keyof UserPermissions, string> = {
  canEdit: "Can Edit Code",
  canCreateTab: "Can Create Tabs",
  canDeleteTab: "Can Delete Tabs",
  canRenameTab: "Can Rename Tabs",
};

/**
 * Normalizes permissions so that when `canEdit` is true, all other fields
 * are guaranteed booleans (no `undefined` leakage). When `canEdit` is false
 * the other permissions are preserved — only `canEdit` is forced to `false`.
 */
export const normalizeEditorPermissions = (
  permissions: UserPermissions,
): UserPermissions => {
  if (!permissions.canEdit) {
    return { ...permissions, canEdit: false };
  }

  return {
    canEdit: true,
    canCreateTab: permissions.canCreateTab,
    canDeleteTab: permissions.canDeleteTab,
    canRenameTab: permissions.canRenameTab,
  };
};

export const withEditorAccess = (
  permissions: UserPermissions = DEFAULT_PERMISSIONS,
): UserPermissions =>
  normalizeEditorPermissions({
    ...permissions,
    canEdit: true,
  });

export const togglePermission = (
  permissions: UserPermissions,
  key: keyof UserPermissions,
): UserPermissions =>
  normalizeEditorPermissions({
    ...permissions,
    [key]: !permissions[key],
  });

export const canShowTabPermissionControls = (
  permissions: UserPermissions,
): boolean => permissions.canEdit;
