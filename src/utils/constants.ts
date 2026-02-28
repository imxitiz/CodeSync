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
  TAB_CREATE: "tab-create",
  TAB_CLOSE: "tab-close",
  TAB_RENAME: "tab-rename",
  TAB_SWITCH: "tab-switch",
  TAB_SYNC: "tab-sync",
  PERMISSIONS_UPDATE: "permissions-update",
} as const;

export type ACTIONS = (typeof ACTIONS)[keyof typeof ACTIONS];

export const BACKEND_API_URL: string =
  import.meta.env.VITE_BACKEND_API_URL || "http://localhost:3000";
