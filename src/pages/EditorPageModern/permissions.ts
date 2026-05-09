import type { UserPermissions } from "./types";

export const DEFAULT_TAB_ID = "tab-main";
export const DEFAULT_TAB_NAME = "main.js";

export const DEFAULT_PERMISSIONS: UserPermissions = {
  canEdit: false,
  canCreateTab: false,
  canDeleteTab: false,
  canRenameTab: false,
  allowedTabs: undefined,
};

export const OWNER_PERMISSIONS: UserPermissions = {
  canEdit: true,
  canCreateTab: true,
  canDeleteTab: true,
  canRenameTab: true,
  allowedTabs: undefined,
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
    allowedTabs: permissions.allowedTabs,
  };
};

export const withEditorAccess = (
  permissions: UserPermissions = DEFAULT_PERMISSIONS
): UserPermissions =>
  normalizeEditorPermissions({
    ...permissions,
    canEdit: true,
    // When making someone an editor, give them some sensible defaults if they don't have them
    canCreateTab: permissions.canCreateTab ?? true,
    canRenameTab: permissions.canRenameTab ?? true,
  });

export const togglePermission = (
  permissions: UserPermissions,
  key: keyof UserPermissions
): UserPermissions => {
  const next = { ...permissions, [key]: !permissions[key] };
  return normalizeEditorPermissions(next as UserPermissions);
};

export const canShowTabPermissionControls = (
  permissions: UserPermissions
): boolean => permissions.canEdit;

export const cascadePermissionRevocation = (
  permissions: Record<string, UserPermissions>,
  roomCreator: string | null
): Record<string, UserPermissions> => {
  const nextPermissions = { ...permissions };
  for (const user of Object.keys(nextPermissions)) {
    if (user !== roomCreator) {
      nextPermissions[user] = {
        ...DEFAULT_PERMISSIONS,
      };
    }
  }
  return nextPermissions;
};

export const canUserEditTab = (
  permissions: UserPermissions | undefined,
  tabId: string,
  isOwner: boolean
): boolean => {
  if (isOwner) return true;
  if (!permissions?.canEdit) return false;
  if (!permissions.allowedTabs) return true; // Undefined means all tabs
  return permissions.allowedTabs.includes(tabId);
};
