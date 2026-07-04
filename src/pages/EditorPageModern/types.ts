import type { RefObject } from "react";

export type Client = {
  socketId: string;
  username: string;
};

export type EditorTab = {
  id: string;
  name: string;
  code: string;
};

export type UserPermissions = {
  canEdit: boolean;
  canCreateTab: boolean;
  canDeleteTab: boolean;
  canRenameTab: boolean;
};

export type TabPermissionLevel = "VIEWER" | "EDITOR" | "REQUESTED";

// Level used in toggle - includes inherited (DEFAULT) state
export type ToggleLevel = TabPermissionLevel | "DEFAULT";

export type TabPermissions = {
  /** tabId → Record<username, level> */
  [tabId: string]: Record<string, TabPermissionLevel>;
};

export type TabEditors = {
  /** tabId → username (who currently holds the editor slot) */
  [tabId: string]: string;
};

export type FollowMode = "auto" | "manual" | "off";

export type EditorServerStatus = "connecting" | "connected" | "disconnected";

export type EditorSocket = {
  // biome-ignore lint/suspicious/noExplicitAny: Socket event payloads are protocol-specific and validated at event boundaries.
  emit: (event: string, data: any) => void;
  // biome-ignore lint/suspicious/noExplicitAny: Socket listener payloads are protocol-specific and validated at event boundaries.
  on: (event: string, callback: (data: any) => void) => void;
  // biome-ignore lint/suspicious/noExplicitAny: Socket listener payloads are protocol-specific and validated at event boundaries.
  off: (event: string, callback: (data: any) => void) => void;
  disconnect: () => void;
};

export type EditorSocketRef = RefObject<EditorSocket>;
