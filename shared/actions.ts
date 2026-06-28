/**
 * Shared Socket.IO action constants — SINGLE SOURCE OF TRUTH.
 *
 * Both the server (codesync-server/) and the frontend (src/) import from
 * this module. Do NOT duplicate these constants — update HERE only.
 *
 * Why: DRY principle. Socket event names must match exactly between client
 * and server. Duplicating them in two files guarantees silent mismatches
 * when one side is updated and the other is forgotten.
 */
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
  TAB_CODE_REQUEST: "tab-code-request",
  TAB_CODE: "tab-code",
  PERMISSIONS_UPDATE: "permissions-update",
  DESTROY_ROOM: "destroy-room",
  RECLAIM_RESULT: "reclaim-result",
  TRANSFER_OWNER: "transfer-owner",
  OWNER_TRANSFERRED: "owner-transferred",
} as const;

export type ActionsType = (typeof ACTIONS)[keyof typeof ACTIONS];
