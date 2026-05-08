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
