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

export const normalizeEditorPermissions = (
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

export const withEditorAccess = (
  permissions: UserPermissions = DEFAULT_PERMISSIONS
): UserPermissions =>
  normalizeEditorPermissions({
    ...permissions,
    canEdit: true,
  });

export const togglePermission = (
  permissions: UserPermissions,
  key: keyof UserPermissions
): UserPermissions =>
  normalizeEditorPermissions({
    ...permissions,
    [key]: !permissions[key],
  });

export const canShowTabPermissionControls = (
  permissions: UserPermissions
): boolean => permissions.canEdit;
