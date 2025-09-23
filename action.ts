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
} as const;

export type ACTIONS_TYPE = (typeof ACTIONS)[keyof typeof ACTIONS];
