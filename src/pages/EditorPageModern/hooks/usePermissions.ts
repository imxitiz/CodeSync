import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import {
  DEFAULT_PERMISSIONS,
  cascadePermissionRevocation,
  normalizeEditorPermissions,
  withEditorAccess,
} from "../permissions";
import type { UserPermissions } from "../types";

export const usePermissions = (
  _roomId: string | undefined,
  roomCreator: string | null,
  emitPermissionsUpdate: (targetUser: string, permissions: UserPermissions) => void,
  emitCurrentEditor: (username: string) => void
) => {
  const [permissions, setPermissions] = useState<Record<string, UserPermissions>>({});

  const updatePermissions = useCallback(
    (targetUser: string, newPermissions: UserPermissions) => {
      const normalized = normalizeEditorPermissions(newPermissions);
      setPermissions((prev) => ({ ...prev, [targetUser]: normalized }));
      emitPermissionsUpdate(targetUser, normalized);
    },
    [emitPermissionsUpdate]
  );

  const grantEditor = useCallback(
    (username: string) => {
      // 1. Grant editor access with defaults & normalize
      const newPerms = withEditorAccess(permissions[username] || DEFAULT_PERMISSIONS);

      // 2. Cascade revocation: others lose edit capability
      const nextPermissions = cascadePermissionRevocation(permissions, roomCreator);
      nextPermissions[username] = newPerms;

      // 3. Update state and notify server for all changed users
      setPermissions(nextPermissions);
      
      // Emit updates for everyone who changed
      for (const user of Object.keys(nextPermissions)) {
        if (nextPermissions[user] !== permissions[user]) {
            emitPermissionsUpdate(user, nextPermissions[user] as UserPermissions);
        }
      }

      // 4. Update current editor globally
      emitCurrentEditor(username);
      
      toast.success(`${username} can now edit the code`);
    },
    [permissions, roomCreator, emitPermissionsUpdate, emitCurrentEditor]
  );

  const takeControl = useCallback((ownerUsername: string) => {
      const nextPermissions = cascadePermissionRevocation(permissions, roomCreator);
      setPermissions(nextPermissions);
      
      for (const user of Object.keys(nextPermissions)) {
          if (nextPermissions[user] !== permissions[user]) {
              emitPermissionsUpdate(user, nextPermissions[user] as UserPermissions);
          }
      }
      
      emitCurrentEditor(ownerUsername);
  }, [permissions, roomCreator, emitPermissionsUpdate, emitCurrentEditor]);

  return {
    permissions,
    setPermissions,
    updatePermissions,
    grantEditor,
    takeControl,
  };
};
