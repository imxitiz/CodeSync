# Tab-Level Permissions — Architecture Spec

> **Status**: Draft spec for implementation  
> **Target**: CodeSync `ts-conversion` branch  
> **Author**: @oracle  
> **Date**: 2026-06-29

---

## 1. Overview & Goals

The current permission system applies **room-wide** `UserPermissions` to each user. The owner can grant `canEdit`, `canCreateTab`, etc. to a user across **all tabs** in the room.

This spec adds **tab-level permissions** so that:

1. The owner can grant edit access on **specific tabs only**.
2. A user with `canEdit=false` at room level can still be an **EDITOR** on a specific restricted tab.
3. If no tab-level override exists, the system falls back to room-level permissions.
4. All changes are **additive and backward-compatible** — rooms without tab permissions behave identically to today.

### Design Principles

- **Least privilege**: VIEWER is the default. All users can read all tabs; write access is explicitly granted.
- **Layered resolution**: Owner → Tab override → Room permissions → Default (VIEWER).
- **Server-authoritative**: All permission checks happen server-side. Client state is a UX hint only.
- **No breaking changes**: `UserPermissions` booleans remain. New tab-level layer is additive.

---

## 2. Data Structures

### 2.1 Permission Level (Enum)

Replace the boolean `UserPermissions` model with a **permission level** per (user, tab) pair. Room-level permissions are preserved as the fallback.

```typescript
// codesync-server/src/validation.ts

/**
 * Permission levels for a (user, tab) pair or room-wide default.
 * Ordered by privilege: VIEWER < EDITOR < REQUESTED (pending).
 * 
 * - VIEWER: can read code, cannot modify. Default for all joiners.
 * - EDITOR: can read + write code on this tab (or room-wide).
 * - REQUESTED: user has asked to become EDITOR; awaiting owner approval.
 */
export type TabPermissionLevel = "VIEWER" | "EDITOR" | "REQUESTED";
```

### 2.2 Tab Permission Entry

A single tab can have explicit overrides for multiple users. Stored as a map of `username → TabPermissionLevel`.

```typescript
// codesync-server/src/validation.ts

export type TabPermissionEntry = {
  /** Username → level override for this specific tab. */
  levels: Map<string, TabPermissionLevel>;
};
```

### 2.3 RoomState Extension

```typescript
// codesync-server/src/roomManager.ts — RoomState type

export type RoomState = {
  roomId: string;
  clients: Client[];
  creator: string | null;
  createdAt: number | null;
  ownerHasDisconnected: boolean;
  tabs: Map<string, TabData>;
  permissions: Map<string, UserPermissions>;  // room-level fallback (UNCHANGED)
  currentEditor: string;

  // ── NEW field ──────────────────────────────────────────────
  /**
   * Tab-level permission overrides.
   * Key: tabId → permission entry for that tab.
   * If a tabId is missing here, the room-level `permissions` map is authoritative.
   */
  tabPermissions: Map<string, TabPermissionEntry>;
};
```

### 2.4 TabData Extension (optional metadata)

No changes to `TabData`. Permissions are tracked separately in `tabPermissions` keyed by `tabId`.

### 2.5 Updated `createRoomState`

```typescript
// codesync-server/src/roomManager.ts

export function createRoomState(roomId: string): RoomState {
  return {
    roomId,
    clients: [],
    creator: null,
    createdAt: null,
    ownerHasDisconnected: false,
    tabs: new Map([[DEFAULT_TAB_ID, { name: DEFAULT_TAB_NAME, code: "" }]]),
    permissions: new Map(),
    currentEditor: "",
    tabPermissions: new Map(),   // ← NEW (empty = room-level fallback)
  };
}
```

---

## 3. Permission Resolution Algorithm

### 3.1 `resolveTabPermission`

The single function that answers: *"What can `userName` do on `tabId` right now?"*

```typescript
// codesync-server/src/validation.ts

import type { RoomState } from "./roomManager.js";

/**
 * Resolve the effective permission level for a (user, tab) pair.
 *
 * Resolution order:
 *   1. OWNER → always EDITOR on every tab.
 *   2. Tab-level override → authoritative for that user on that tab.
 *   3. Room-level fallback → check UserPermissions.canEdit + currentEditor slot.
 *   4. Default → VIEWER.
 *
 * Tab-level OVERRIDES the room-level. So a user can be:
 *   - VIEWER room-wide but EDITOR on tab-X.
 *   - EDITOR room-wide but VIEWER on tab-Y (owner restricted a specific tab).
 */
export function resolveTabPermission(
  room: RoomState,
  userName: string,
  tabId: string
): TabPermissionLevel {
  // 1. Owner is always EDITOR.
  if (room.creator === userName) {
    return "EDITOR";
  }

  // 2. Tab-level override takes precedence.
  const tabOverride = room.tabPermissions.get(tabId);
  if (tabOverride) {
    const level = tabOverride.levels.get(userName);
    if (level) {
      return level;  // "EDITOR" | "VIEWER" | "REQUESTED" — authoritative
    }
  }

  // 3. Room-level fallback.
  const roomPerms = room.permissions.get(userName);
  if (roomPerms?.canEdit === true) {
    // Room-level editor: respect single-editor slot model.
    // If no one is in the editor slot OR they are the editor → EDITOR.
    // Someone else holds the slot → VIEWER.
    if (room.currentEditor === "" || room.currentEditor === userName) {
      return "EDITOR";
    }
  }

  // 4. Default.
  return "VIEWER";
}
```

### 3.2 `canWriteTab` — convenience predicate

```typescript
// codesync-server/src/validation.ts

export function canWriteTab(
  room: RoomState,
  userName: string,
  tabId: string
): boolean {
  return resolveTabPermission(room, userName, tabId) === "EDITOR";
}
```

### 3.3 `canReadTab` — all users can read all tabs

```typescript
// codesync-server/src/validation.ts

export function canReadTab(
  _room: RoomState,
  _userName: string,
  _tabId: string
): boolean {
  // VIEWER level grants read access. Since VIEWER is the default,
  // all authenticated room members can read all tabs.
  return true;
}
```

### 3.4 Reclassification of Existing Room-Level Permissions

The existing `UserPermissions` booleans remain **room-level** controls:

| Room-Level Boolean | Meaning After This Change |
|---|---|
| `canEdit` | Grants EDITOR level on **all tabs** (unless a tab override says otherwise). Must still hold `currentEditor` slot per-tab for write to complete. |
| `canCreateTab` | Room-wide. Unchanged. |
| `canDeleteTab` | Room-wide. Unchanged. |
| `canRenameTab` | Room-wide. Unchanged. |

A user with `canEdit=false` room-wide CAN still write to specific tabs if the owner grants them tab-level EDITOR override. The currentEditor slot is checked **per write operation, per tab**.

### 3.5 Current Editor Slot — Per-Tab Behavior

Previously `currentEditor` was room-wide (one slot total). With tab-level permissions, the server must allow **multiple concurrent editors on different tabs** while still preventing write collisions on the same tab.

This spec introduces a **per-tab editor slot** while keeping the existing `currentEditor` field for backward compat (it tracks the "primary" or last-granted slot).

```typescript
// codesync-server/src/roomManager.ts — RoomState (additional field)

export type RoomState = {
  // ... existing fields ...

  // ── NEW ────────────────────────────────────────────────────
  /**
   * Per-tab editor slot: tabId → username.
   * If a tabId is missing here, no one holds the editor slot for that tab.
   * This allows multiple users to edit different tabs concurrently.
   */
  tabEditors: Map<string, string>;
};
```

**Revised `resolveTabPermission` Step 3** (room-level fallback with per-tab editor slot):

```typescript
  // 3. Room-level fallback.
  const roomPerms = room.permissions.get(userName);
  if (roomPerms?.canEdit === true) {
    const tabSlotHolder = room.tabEditors.get(tabId);
    // Per-tab slot: free or held by this user → EDITOR.
    // Held by someone else → VIEWER (read-only on this tab).
    if (!tabSlotHolder || tabSlotHolder === userName) {
      return "EDITOR";
    }
  }
```

---

## 4. New Socket Events

All new action constants are added to **`shared/actions.ts`** (single source of truth). Both client and server import from there.

### 4.1 Action Constants

```typescript
// shared/actions.ts — append to ACTIONS object

TAB_PERMISSION_REQUEST: "tab-permission-request",   // Client → Server: user asks for edit on tab
TAB_PERMISSION_GRANT: "tab-permission-grant",       // Client → Server: owner grants level
TAB_PERMISSION_REVOKE: "tab-permission-revoke",     // Client → Server: owner revokes level
TAB_PERMISSIONS_UPDATE: "tab-permissions-update",   // Server → Client: broadcast permission change
```

### 4.2 Payload Shapes

#### `TAB_PERMISSION_REQUEST` (Client → Server)

```typescript
{
  roomId: string;    // Room to operate in
  tabId: string;     // Tab the user wants to edit
  userName: string;  // Sender identity (server derives this from socket mapping)
}
```

- **Who**: Any non-owner user with room-level `canEdit=false` or tab-level `VIEWER`.
- **Effect**: Sets the user's tab-level permission to `"REQUESTED"`. Broadcast to owner.

#### `TAB_PERMISSION_GRANT` (Client → Server)

```typescript
{
  roomId: string;
  tabId: string;
  targetUser: string;               // User to grant
  level: "EDITOR" | "VIEWER";       // New level (REQUESTED is not grantable)
}
```

- **Who**: Owner only (`room.creator === userName`).
- **Effect**: Sets `tabPermissions[tabId].levels[targetUser] = level`. Broadcasts `TAB_PERMISSIONS_UPDATE` to all clients in room.

#### `TAB_PERMISSION_REVOKE` (Client → Server)

```typescript
{
  roomId: string;
  tabId: string;
  targetUser: string;
}
```

- **Who**: Owner only.
- **Effect**: Removes the user's tab-level entry (delete from map). After deletion, room-level permissions apply again. Broadcasts update.

#### `TAB_PERMISSIONS_UPDATE` (Server → Client, broadcast)

```typescript
{
  tabId: string;
  permissions: Record<string, TabPermissionLevel>;  // username → level, for this tab only
}
```

All clients receive this and update their local tab-permission state. The joining socket already receives all permissions via `TAB_SYNC`.

### 4.3 Event Flow Diagram

```
Client (Viewer)                       Server                         Client (Owner)
      │                                 │                                 │
      │── TAB_PERMISSION_REQUEST ──────▶│                                 │
      │   {tabId, roomId}               │── broadcast TAB_PERMISSIONS_UPDATE▶
      │                                 │   to all                        │
      │                                 │                                 │
      │                                 │◀── TAB_PERMISSION_GRANT ─────────│
      │                                 │   {tabId, targetUser, level}    │
      │◀── TAB_PERMISSIONS_UPDATE ──────│                                 │
      │   {tabId, permissions}          │── broadcast TAB_PERMISSIONS_UPDATE▶
      │                                 │   to all                        │
```

---

## 5. Server Enforcement — Updated Socket Handlers

### 5.1 CODE_CHANGE

**Current**: Owner or `currentEditor === userName`.

**New**: Owner or `canWriteTab(room, userName, tabId)`.

```typescript
// codesync-server/src/socket.ts — CODE_CHANGE handler

socket.on(ACTIONS.CODE_CHANGE, ({ roomId, tabId, code }) => {
  if (!socket.rooms.has(roomId)) return;
  const room = rooms.get(roomId);
  if (!room) return;
  const userName = userSocketMap.get(socket.id);
  if (!userName) return;

  // NEW: per-tab permission check
  if (!canWriteTab(room, userName, tabId)) {
    return;  // silently reject
  }

  if (!isValidTabId(tabId) || !isValidCode(code)) return;

  const tab = room.tabs.get(tabId);
  if (!tab) return;

  tab.code = code;

  // If this user wasn't in the tab's editor slot, take it.
  room.tabEditors.set(tabId, userName);

  socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {
    tabId,
    code,
    currenteditor: userName,
    tabEditors: Object.fromEntries(room.tabEditors),  // ← NEW in payload
  });
});
```

> **Note on `currentEditor` broadcast**: The `currenteditor` field in `CODE_CHANGE` is now the **username** of whoever just wrote (per-tab). Clients can derive per-tab editor status from `tabEditors` map. If backward compat is needed for older clients, keep sending `room.currentEditor` too.

### 5.2 SET_CURRENT_EDITOR

This existing event was used to claim/release a room-wide editor slot. It remains for backward compat but now also accepts a `tabId`:

```typescript
// Extended payload
{
  roomId: string;
  currenteditor: string;   // username to assign (or "" to release)
  tabId?: string;          // ← NEW OPTIONAL: which tab. If omitted, room-wide behavior.
}
```

```typescript
// codesync-server/src/socket.ts — updated SET_CURRENT_EDITOR

socket.on(ACTIONS.SET_CURRENT_EDITOR, ({ roomId, currenteditor, tabId }) => {
  const userName = userSocketMap.get(socket.id);
  if (!userName) return;
  const room = rooms.get(roomId);
  if (!room) return;

  const isOwner = room.creator === userName;

  if (tabId) {
    // Per-tab editor slot.
    if (currenteditor === "") {
      // Release this tab's slot if user holds it.
      const holder = room.tabEditors.get(tabId);
      if (holder === userName || isOwner) {
        room.tabEditors.delete(tabId);
      } else {
        return;  // cannot release someone else's slot unless owner
      }
    } else if (currenteditor === userName) {
      // Take the slot — must have EDITOR permission on this tab.
      if (!isOwner && !canWriteTab(room, userName, tabId)) return;
      const existing = room.tabEditors.get(tabId);
      if (existing && existing !== userName) {
        // Kick existing editor if owner or self.
        if (!isOwner) return;  // only owner can bump
        // Bump: revoke the old holder's permission implicitly by taking slot
      }
      room.tabEditors.set(tabId, userName);
    } else if (isOwner) {
      // Owner assigning someone else.
      if (!canWriteTab(room, currenteditor, tabId)) return;
      room.tabEditors.set(tabId, currenteditor);
    } else {
      return;
    }

    // Sync: broadcast per-tab assignment
    io.in(roomId).emit(ACTIONS.SET_CURRENT_EDITOR, {
      currenteditor,
      tabId,
      tabEditors: Object.fromEntries(room.tabEditors),
    });
  } else {
    // Legacy room-wide behavior — currentEditor single-slot.
    const currentEditor = room.currentEditor;
    const canRelease = currenteditor === "" && currentEditor === userName;
    const perms = room.permissions.get(userName) ?? DEFAULT_PERMISSIONS;
    const canTakeEdit = currenteditor !== "" && perms.canEdit;

    if (!(isOwner || canRelease || canTakeEdit)) return;

    room.currentEditor = currenteditor;

    if (currenteditor !== "" && currentEditor !== "" && currentEditor !== currenteditor) {
      const oldEditorPerms = room.permissions.get(currentEditor);
      if (oldEditorPerms && room.creator !== currentEditor && oldEditorPerms.canEdit) {
        const revokedPerms = { ...oldEditorPerms, canEdit: false };
        room.permissions.set(currentEditor, revokedPerms);
        io.in(roomId).emit(ACTIONS.PERMISSIONS_UPDATE, {
          username: currentEditor,
          permissions: revokedPerms,
        });
      }
    }

    io.in(roomId).emit(ACTIONS.SET_CURRENT_EDITOR, { currenteditor });
  }
});
```

### 5.3 TAB_CREATE

Unchanged (operates on room-wide `canCreateTab`). Permissions for the new tab default to room-level.

### 5.4 TAB_CLOSE

Unchanged (room-wide `canDeleteTab`). **Cascade**: deleting a tab removes its `tabPermissions` entry.

```typescript
// codesync-server/src/socket.ts — TAB_CLOSE, added cascade

socket.on(ACTIONS.TAB_CLOSE, ({ roomId, tabId }) => {
  // ... existing validation ...

  if (room.tabs.size > 1) {
    room.tabs.delete(tabId);
    room.tabPermissions.delete(tabId);   // ← NEW: cascade tab permission data
    room.tabEditors.delete(tabId);       // ← NEW: clear per-tab editor slot
    io.in(roomId).emit(ACTIONS.TAB_CLOSE, { tabId });
  }
});
```

### 5.5 TAB_RENAME

Unchanged (room-wide `canRenameTab`).

### 5.6 New: TAB_PERMISSION_REQUEST Handler

```typescript
// codesync-server/src/socket.ts

socket.on(ACTIONS.TAB_PERMISSION_REQUEST, ({ roomId, tabId }) => {
  const userName = userSocketMap.get(socket.id);
  if (!userName) return;
  if (!socket.rooms.has(roomId)) return;
  if (!isValidTabId(tabId)) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const tab = room.tabs.get(tabId);
  if (!tab) return;

  // Cannot request if already EDITOR or owner.
  if (room.creator === userName) return;
  if (resolveTabPermission(room, userName, tabId) === "EDITOR") return;

  // Set REQUESTED level.
  let entry = room.tabPermissions.get(tabId);
  if (!entry) {
    entry = { levels: new Map() };
    room.tabPermissions.set(tabId, entry);
  }
  entry.levels.set(userName, "REQUESTED");

  // Broadcast so owner sees the request badge.
  io.in(roomId).emit(ACTIONS.TAB_PERMISSIONS_UPDATE, {
    tabId,
    permissions: Object.fromEntries(entry.levels),
  });

  // Notify the requester that their request was recorded.
  emitToSocket(socket.id, ACTIONS.TAB_PERMISSIONS_UPDATE, {
    tabId,
    permissions: Object.fromEntries(entry.levels),
  });
});
```

### 5.7 New: TAB_PERMISSION_GRANT Handler

```typescript
// codesync-server/src/socket.ts

socket.on(
  ACTIONS.TAB_PERMISSION_GRANT,
  ({ roomId, tabId, targetUser, level }: {
    roomId: string;
    tabId: string;
    targetUser: string;
    level: "EDITOR" | "VIEWER";
  }) => {
    const userName = userSocketMap.get(socket.id);
    if (!userName) return;
    if (!socket.rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    if (!room || room.creator !== userName) return;  // OWNER ONLY

    if (!isValidTabId(tabId)) return;
    const tab = room.tabs.get(tabId);
    if (!tab) return;

    // Target must be in the room.
    const targetClient = room.clients.find((c) => c.username === targetUser);
    if (!targetClient) return;

    // Validate level.
    if (level !== "EDITOR" && level !== "VIEWER") return;

    // Set permission.
    let entry = room.tabPermissions.get(tabId);
    if (!entry) {
      entry = { levels: new Map() };
      room.tabPermissions.set(tabId, entry);
    }
    entry.levels.set(targetUser, level);

    // If granting EDITOR, auto-assign the tab editor slot to them.
    if (level === "EDITOR") {
      room.tabEditors.set(tabId, targetUser);
    }

    // Broadcast update to all clients.
    io.in(roomId).emit(ACTIONS.TAB_PERMISSIONS_UPDATE, {
      tabId,
      permissions: Object.fromEntries(entry.levels),
    });

    // Notify target.
    emitToSocket(targetClient.socketId, ACTIONS.TAB_PERMISSIONS_UPDATE, {
      tabId,
      permissions: Object.fromEntries(entry.levels),
    });
  }
);
```

### 5.8 New: TAB_PERMISSION_REVOKE Handler

```typescript
// codesync-server/src/socket.ts

socket.on(
  ACTIONS.TAB_PERMISSION_REVOKE,
  ({ roomId, tabId, targetUser }: {
    roomId: string;
    tabId: string;
    targetUser: string;
  }) => {
    const userName = userSocketMap.get(socket.id);
    if (!userName) return;
    if (!socket.rooms.has(roomId)) return;

    const room = rooms.get(roomId);
    if (!room || room.creator !== userName) return;  // OWNER ONLY

    if (!isValidTabId(tabId)) return;

    const entry = room.tabPermissions.get(tabId);
    if (!entry) return;

    // Remove the user's tab-level override. Room-level permissions apply again.
    entry.levels.delete(targetUser);

    // Clean up empty entries to keep state lean.
    if (entry.levels.size === 0) {
      room.tabPermissions.delete(tabId);
    }

    // If they held the per-tab editor slot, release it.
    if (room.tabEditors.get(tabId) === targetUser) {
      room.tabEditors.delete(tabId);
    }

    // Broadcast.
    io.in(roomId).emit(ACTIONS.TAB_PERMISSIONS_UPDATE, {
      tabId,
      permissions: Object.fromEntries(entry.levels),
    });
  }
);
```

### 5.9 Updated TAB_SYNC — Join-Time Payload

The joining client receives tab-permission state at join time:

```typescript
// codesync-server/src/socket.ts — JOIN handler, TAB_SYNC emission

emitToSocket(socket.id, ACTIONS.TAB_SYNC, {
  tabs: [...room.tabs.entries()].map(([id, t]) => ({
    id,
    name: t.name,
    code: t.code,
  })),
  activeTabId: "tab-main",
  userActiveTabs: room.clients.map((c) => ({
    username: c.username,
    activeTabId: userActiveTabMap.get(c.socketId) ?? "tab-main",
  })),
  permissions: Object.fromEntries(room.permissions),
  // ── NEW ────────────────────────────────────────
  tabPermissions: Object.fromEntries(
    [...room.tabPermissions.entries()].map(([tabId, entry]) => [
      tabId,
      Object.fromEntries(entry.levels),
    ])
  ),
  tabEditors: Object.fromEntries(room.tabEditors),
});
```

### 5.10 disconnecting Handler — Preserved Tab Permissions

When a client disconnects, **room-level permissions are cleared** (existing behavior). Tab-level permissions **persist** (the data belongs to the room, not the connection).

Required change: remove the permission deletion from `disconnectClient` for tab permissions. Room permissions are still deleted (they are ephemeral). Tab overrides remain active for the session's lifetime.

```typescript
// codesync-server/src/roomManager.ts — disconnectClient — UNCHANGED

// (room.permissions.delete(client.username) still happens — this is the room-level map)
// Tab permissions in room.tabPermissions are NOT touched — they persist.
```

> **Rationale**: Tab permissions are per-room data scoped to tabs, not connections. A disconnect shouldn't reset what the owner configured. If the user reconnects with the same username, they retain their tab-level grants. This mirrors how `permission-update` UI persists grants — the owner explicitly sets them; the server doesn't auto-clear on disconnect.

---

## 6. Client State

### 6.1 New Types

```typescript
// src/pages/EditorPageModern/types.ts

export type TabPermissionLevel = "VIEWER" | "EDITOR" | "REQUESTED";

export type TabPermissions = {
  /** tabId → Record<username, level> */
  [tabId: string]: Record<string, TabPermissionLevel>;
};

export type TabEditors = {
  /** tabId → username (who currently holds the editor slot) */
  [tabId: string]: string;
};
```

### 6.2 Local State Additions

```typescript
// src/pages/EditorPageModern/EditorPageModern.tsx

const [tabPermissions, setTabPermissions] = useState<TabPermissions>({});
const [tabEditors, setTabEditors] = useState<TabEditors>({});
```

### 6.3 Derived Permission for Active Tab

```typescript
// src/pages/EditorPageModern/EditorPageModern.tsx

const activeTabPermission = useMemo<TabPermissionLevel>(() => {
  if (isOwner) return "EDITOR";
  const tabLevel = tabPermissions[activeTabId]?.[userName];
  if (tabLevel) return tabLevel;
  // Room-level fallback
  return myPermissions.canEdit ? "EDITOR" : "VIEWER";
}, [isOwner, tabPermissions, activeTabId, userName, myPermissions.canEdit]);

const canEditActiveTab = activeTabPermission === "EDITOR";
const isRequestingEdit = activeTabPermission === "REQUESTED";
```

### 6.4 Socket Event Handlers (in `useEditorRealtime`)

```typescript
// src/pages/EditorPageModern/useEditorRealtime.ts — inside init()

// TAB_SYNC — update tabPermissions and tabEditors from server snapshot
socket.on(ACTIONS.TAB_SYNC, (payload) => {
  // ... existing handling ...
  if (payload.tabPermissions) {
    setTabPermissions(payload.tabPermissions);
  }
  if (payload.tabEditors) {
    setTabEditors(payload.tabEditors);
  }
});

// TAB_PERMISSIONS_UPDATE — incremental update for a single tab
socket.on(ACTIONS.TAB_PERMISSIONS_UPDATE, ({ tabId, permissions }) => {
  setTabPermissions((prev) => ({
    ...prev,
    [tabId]: permissions,
  }));
});

// CODE_CHANGE — update tabEditors from server
socket.on(ACTIONS.CODE_CHANGE, ({ tabId, code, currenteditor, tabEditors: newTabEditors }) => {
  handleCodeChangeRef.current(code, tabId);
  if (newTabEditors) {
    setTabEditors(newTabEditors);
  }
});

// SET_CURRENT_EDITOR — update tabEditors
socket.on(ACTIONS.SET_CURRENT_EDITOR, ({ tabId, currenteditor, tabEditors: newTabEditors }) => {
  if (newTabEditors) {
    setTabEditors(newTabEditors);
  }
  // ... existing room-wide handling ...
});
```

### 6.5 New Emit Functions

```typescript
// src/pages/EditorPageModern/useEditorRealtime.ts

const emitTabPermissionRequest = useCallback(
  (tabId: string) => {
    socketRef.current?.emit(ACTIONS.TAB_PERMISSION_REQUEST, { roomId, tabId });
  },
  [roomId],
);

const emitTabPermissionGrant = useCallback(
  (tabId: string, targetUser: string, level: "EDITOR" | "VIEWER") => {
    socketRef.current?.emit(ACTIONS.TAB_PERMISSION_GRANT, {
      roomId,
      tabId,
      targetUser,
      level,
    });
  },
  [roomId],
);

const emitTabPermissionRevoke = useCallback(
  (tabId: string, targetUser: string) => {
    socketRef.current?.emit(ACTIONS.TAB_PERMISSION_REVOKE, {
      roomId,
      tabId,
      targetUser,
    });
  },
  [roomId],
);
```

Return these from the hook.

---

## 7. UI/UX Flows

### 7.1 Owner Grants Tab Permission

**Location**: ParticipantsDrawer — expand the existing per-user permission section.

**Flow**:
1. Owner opens ParticipantsDrawer.
2. Owner clicks the ⚙ icon on a participant (existing behavior).
3. Below the existing room-level toggles, add a **"Tab Permissions"** section.
4. The section lists all tabs in the room with a dropdown per tab: `VIEWER` / `EDITOR` / `REQUESTED` (read-only display).
5. Owner changes a tab's dropdown to `EDITOR` → emits `TAB_PERMISSION_GRANT`.
6. Owner changes it back to `VIEWER` → emits `TAB_PERMISSION_REVOKE`.

**UI Sketch**:

```
┌─ Permissions for alice ─────────────────────────────┐
│  [✓] Can Edit Code                                  │
│  [✓] Can Create Tabs                                │
│  [ ] Can Delete Tabs                                │
│  [ ] Can Rename Tabs                                │
│                                                     │
│  Tab Permissions                                    │
│  ┌──────────────────────────────────────────────┐   │
│  │ main.js  │ VIEWER ▼                          │   │
│  │ utils.js │ EDITOR ▼                          │   │
│  │ test.js  │ VIEWER ▼                          │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [Grant All]  [Revoke All]                          │
└─────────────────────────────────────────────────────┘
```

### 7.2 User Requests Edit on a Tab

**Location**: Editor tab bar + read-only banner.

**Flow**:
1. User opens a tab where they are VIEWER.
2. The editor shows a **read-only banner** at the top: "You have read-only access to `main.js`. [Request Edit]".
3. User clicks "Request Edit" → emits `TAB_PERMISSION_REQUEST`.
4. The button changes to "Request sent…" (state = `REQUESTED`).
5. When owner grants, the banner disappears and the editor becomes editable.

### 7.3 Visual Indicators

**Tab Bar — Lock Icon**:
- If the current user is VIEWER on a tab, show a small 🔒 icon on the tab label.
- If EDITOR, no icon (or a ✏️ pencil icon).
- If REQUESTED, show a clock icon 🕐.

**Read-Only Banner** (above CodeMirror):
```tsx
{activeTabPermission === "VIEWER" && (
  <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
    <Lock className="size-3" />
    <span>Read-only: you cannot edit {activeTab.name}</span>
    <button
      className="ml-auto cursor-pointer rounded bg-primary/10 px-2 py-0.5 text-primary hover:bg-primary/20"
      onClick={() => emitTabPermissionRequest(activeTabId)}
      type="button"
    >
      Request Edit
    </button>
  </div>
)}

{activeTabPermission === "REQUESTED" && (
  <div className="flex items-center gap-2 border-b bg-amber-500/10 px-3 py-1.5 text-xs text-amber-600">
    <Clock className="size-3" />
    <span>Edit request pending for {activeTab.name}</span>
  </div>
)}
```

### 7.4 Permission Downgrade Mid-Edit

**Scenario**: User is editing tab-X. Owner revokes their EDITOR permission on tab-X.

**Server behavior**:
- `TAB_PERMISSIONS_UPDATE` is broadcast.
- The user's next `CODE_CHANGE` for tab-X is rejected by the server (permission check fails).
- The user's `tabEditors` entry for tab-X is cleared.

**Client behavior**:
- On receiving `TAB_PERMISSIONS_UPDATE` where their level drops to VIEWER:
  - If they were actively editing that tab, show a toast: "Your edit access to `main.js` was revoked."
  - Set the editor to read-only mode immediately.
  - Discard any pending local changes that haven't been synced (or keep them locally but disable further edits).

**Implementation**:
```typescript
// In EditorPageModern — watch for permission downgrade
useEffect(() => {
  if (activeTabPermission === "VIEWER" && wasEditingRef.current) {
    wasEditingRef.current = false;
    toast.error(`Your edit access to ${activeTab.name} was revoked`);
  }
}, [activeTabPermission, activeTab.name]);
```

---

## 8. Backward Compatibility

### 8.1 Existing Rooms Without `tabPermissions`

- `tabPermissions` is initialized as an empty `Map` in `createRoomState`.
- `resolveTabPermission` falls through to room-level when `tabPermissions.get(tabId)` returns `undefined`.
- **No behavioral change** for rooms that never use tab-level permissions.

### 8.2 Migration Strategy

**Additive only. No migration needed.**

- `tabPermissions` and `tabEditors` are new fields with safe defaults (empty maps).
- Existing `UserPermissions` booleans remain untouched.
- Old clients that don't send/receive the new events simply ignore them (Socket.IO ignores unknown events).
- Old server versions: if a new client sends `TAB_PERMISSION_REQUEST` to an old server, the server ignores it (no handler). The client should handle this gracefully (show a toast: "Server doesn't support tab permissions").

### 8.3 Boolean-to-Level Mapping

For the UI, map existing room-level booleans to the new level system:

```typescript
// Helper for display purposes
function roomLevelToTabLevel(perms: UserPermissions): TabPermissionLevel {
  return perms.canEdit ? "EDITOR" : "VIEWER";
}
```

When the owner toggles `canEdit` in the existing UI, it's equivalent to setting the user's level to EDITOR on **all tabs** (with no per-tab override). The server's `resolveTabPermission` handles this via the room-level fallback path.

### 8.4 `currentEditor` Field — Deprecation Path

The room-wide `currentEditor` field is kept for backward compat but becomes **secondary** to `tabEditors`. New code should prefer `tabEditors[tabId]`. The `currentEditor` field is updated to mirror the last-granted tab slot for clients that only read `currentEditor`.

---

## 9. Edge Cases

### 9.1 Tab Deleted → Permissions Cascade

**Rule**: When a tab is closed, its `tabPermissions` entry and `tabEditors` entry are deleted.

**Implementation**: See §5.4. The `TAB_CLOSE` handler calls `room.tabPermissions.delete(tabId)` and `room.tabEditors.delete(tabId)`.

**Client**: On receiving `TAB_CLOSE`, the client removes the tab from local state. Any `tabPermissions[tabId]` and `tabEditors[tabId]` entries become unreachable (garbage collected with the tab).

### 9.2 Owner Leaves → Tab Permissions Persist

**Rule**: Tab permissions are room-scoped data, not connection-scoped. They survive owner disconnect.

**Implementation**: `disconnectClient` only deletes from `room.permissions` (room-level map). `room.tabPermissions` is untouched.

**Reclaim**: When the owner reconnects with a valid reclaim token, they regain `room.creator` status and all tab permissions are still in `room.tabPermissions`.

### 9.3 User Disconnects → Tab Permissions Persist

Same as §9.2. Tab-level grants for a username persist across disconnects. Room-level permissions are cleared (existing behavior).

### 9.4 User Granted Tab A but Not Tab B → Can They See Tab B Code?

**Yes.** All users are VIEWER by default on all tabs. VIEWER grants read access. The user can:
- View code on tab B (read-only).
- See tab B in the tab bar.
- Switch to tab B.
- NOT edit tab B (server rejects `CODE_CHANGE`).

### 9.5 Max Tabs Enforcement

Unchanged. `MAX_TABS_PER_ROOM = 10` is enforced in `TAB_CREATE`. Tab permissions don't affect this limit.

### 9.6 Owner Grants EDITOR to a User Who Isn't in the Room

**Rejected.** The `TAB_PERMISSION_GRANT` handler validates that `targetUser` is in `room.clients`.

### 9.7 Duplicate Tab Permission Grant (Idempotent)

Setting `EDITOR` twice is a no-op (map overwrite). No error.

### 9.8 Revoking a Permission That Doesn't Exist

`TAB_PERMISSION_REVOKE` on a user with no tab-level entry is a no-op (the handler checks `if (!entry) return`).

### 9.9 Race: Two Owners Grant Simultaneously

Only one owner can exist at a time (`room.creator` is a single value). The `TAB_PERMISSION_GRANT` handler checks `room.creator === userName`, so only the true owner's grants are accepted.

### 9.10 User Requests Edit When They Already Have It

`TAB_PERMISSION_REQUEST` checks `resolveTabPermission(...) === "EDITOR"` and returns early. No-op.

### 9.11 Owner Demoted via TRANSFER_OWNER

When ownership transfers, the new owner gains full EDITOR access. The old owner's tab permissions are NOT cleared — they become a normal user with whatever room-level permissions they had. The new owner can then configure tab permissions for them.

---

## 10. File-by-File Change List

### 10.1 `shared/actions.ts`

**Change**: Add 4 new action constants.

```typescript
TAB_PERMISSION_REQUEST: "tab-permission-request",
TAB_PERMISSION_GRANT: "tab-permission-grant",
TAB_PERMISSION_REVOKE: "tab-permission-revoke",
TAB_PERMISSIONS_UPDATE: "tab-permissions-update",
```

### 10.2 `codesync-server/src/validation.ts`

**Changes**:
1. Add `TabPermissionLevel` type.
2. Add `TabPermissionEntry` type.
3. Add `resolveTabPermission()` function.
4. Add `canWriteTab()` convenience function.
5. Add `canReadTab()` convenience function.
6. Update `DEFAULT_PERMISSIONS` — no change needed (booleans remain).

### 10.3 `codesync-server/src/roomManager.ts`

**Changes**:
1. Add `tabPermissions: Map<string, TabPermissionEntry>` to `RoomState`.
2. Add `tabEditors: Map<string, string>` to `RoomState`.
3. Update `createRoomState()` to initialize both as empty maps.
4. Update `destroyRoomState()` to clear both maps.
5. `joinRoom()` — no change (tab permissions are room-scoped, not join-scoped).
6. `transferOwner()` — no change (tab permissions persist across ownership transfer).
7. `disconnectClient()` — no change to tab permissions (they persist). Room-level permissions still cleared.

### 10.4 `codesync-server/src/socket.ts`

**Changes**:
1. Import new functions from `validation.js`.
2. Update `CODE_CHANGE` handler — use `canWriteTab()` instead of `isOwner || isEditor`.
3. Update `SET_CURRENT_EDITOR` handler — support optional `tabId` for per-tab slot.
4. Update `TAB_CLOSE` handler — cascade delete `tabPermissions` and `tabEditors` entries.
5. Add `TAB_PERMISSION_REQUEST` handler.
6. Add `TAB_PERMISSION_GRANT` handler.
7. Add `TAB_PERMISSION_REVOKE` handler.
8. Update `TAB_SYNC` emission — include `tabPermissions` and `tabEditors`.
9. Update `CODE_CHANGE` broadcast — include `tabEditors` map.

### 10.5 `codesync-server/src/actions.ts`

**No change** — it re-exports from `shared/actions.ts`.

### 10.6 `src/utils/constants.ts`

**No change** — it re-exports from `shared/actions.ts`.

### 10.7 `src/pages/EditorPageModern/types.ts`

**Changes**:
1. Add `TabPermissionLevel` type.
2. Add `TabPermissions` type.
3. Add `TabEditors` type.

### 10.8 `src/pages/EditorPageModern/permissions.ts`

**Changes**:
1. Add helper `roomLevelToTabLevel()`.
2. Add `DEFAULT_TAB_PERMISSION_LEVEL = "VIEWER"` constant.

### 10.9 `src/pages/EditorPageModern/useEditorRealtime.ts`

**Changes**:
1. Add `tabPermissions` and `tabEditors` to the hook's return value (or accept setters via options).
2. Add `emitTabPermissionRequest`, `emitTabPermissionGrant`, `emitTabPermissionRevoke` callbacks.
3. Update `TAB_SYNC` handler — store `tabPermissions` and `tabEditors`.
4. Add `TAB_PERMISSIONS_UPDATE` handler — merge into `tabPermissions`.
5. Update `CODE_CHANGE` handler — update `tabEditors` from payload.
6. Update `SET_CURRENT_EDITOR` handler — update `tabEditors` from payload.

### 10.10 `src/pages/EditorPageModern/EditorPageModern.tsx`

**Changes**:
1. Add local state: `tabPermissions`, `tabEditors`.
2. Derive `activeTabPermission` and `canEditActiveTab` from new state.
3. Pass new state + emitters to `ParticipantsDrawer`.
4. Add read-only banner / request-edit banner above the editor.
5. Add lock icon on tabs where user is VIEWER.
6. Update `EditorWrapper` `editable` prop to use `canEditActiveTab` (already derived).
7. Update `toggleEditable` to use per-tab logic.

### 10.11 `src/pages/EditorPageModern/ParticipantsDrawer.tsx`

**Changes**:
1. Add `TabPermissionLevel` import.
2. Add props: `tabPermissions`, `tabs`, `emitTabPermissionGrant`, `emitTabPermissionRevoke`.
3. Add "Tab Permissions" section in the per-user permission panel.
4. Render a row per tab with a dropdown to set VIEWER/EDITOR.
5. Show REQUESTED badge for users who have pending requests.

### 10.12 `src/components/Editor.tsx` (if it reads `editable` prop)

**No change** — it already receives `editable` as a prop. The parent (`EditorPageModern`) now computes it from tab-level state.

### 10.13 `src/components/EditorWrapper.tsx`

**No change** — it passes `editable` through to `Editor`.

---

## 11. Testing Strategy

### 11.1 Unit Tests (Server)

File: `codesync-server/src/__tests__/tabPermissions.test.ts`

```typescript
describe("resolveTabPermission", () => {
  test("owner is always EDITOR", () => {
    const room = createRoomState("r1");
    room.creator = "alice";
    expect(resolveTabPermission(room, "alice", "tab-1")).toBe("EDITOR");
  });

  test("tab override takes precedence over room-level", () => {
    const room = createRoomState("r1");
    room.creator = "alice";
    room.permissions.set("bob", { canEdit: false, ... });
    room.tabPermissions.set("tab-1", { levels: new Map([["bob", "EDITOR"]]) });
    expect(resolveTabPermission(room, "bob", "tab-1")).toBe("EDITOR");
  });

  test("room-level fallback when no tab override", () => {
    const room = createRoomState("r1");
    room.creator = "alice";
    room.permissions.set("bob", { canEdit: true, ... });
    room.currentEditor = "bob";
    expect(resolveTabPermission(room, "bob", "tab-1")).toBe("EDITOR");
  });

  test("default is VIEWER", () => {
    const room = createRoomState("r1");
    room.creator = "alice";
    expect(resolveTabPermission(room, "bob", "tab-1")).toBe("VIEWER");
  });

  test("tab deleted cascades permissions", () => {
    const room = createRoomState("r1");
    room.creator = "alice";
    room.tabPermissions.set("tab-1", { levels: new Map([["bob", "EDITOR"]]) });
    room.tabPermissions.delete("tab-1");
    expect(resolveTabPermission(room, "bob", "tab-1")).toBe("VIEWER");
  });
});
```

### 11.2 Integration Tests

- Owner grants EDITOR on tab-X → user can write to tab-X.
- Owner revokes → user's next write is rejected.
- User requests edit → owner sees REQUESTED badge.
- Tab close → permissions cascade.
- Disconnect/reconnect → tab permissions persist.

---

## 12. Open Questions

1. **Per-tab editor slot vs. room-wide slot**: This spec introduces `tabEditors` (per-tab) alongside the existing `currentEditor` (room-wide). Should we fully deprecate `currentEditor` in a follow-up, or keep both indefinitely?

2. **REQUESTED state persistence**: Currently `REQUESTED` is stored in the tab-level map. Should it auto-expire after a timeout (e.g., 5 minutes)?

3. **Bulk operations**: Should the owner be able to "Grant EDITOR on all tabs" or "Revoke all tab permissions for user" in one action?

4. **Audit log**: Should permission changes be logged server-side for debugging?

---

*End of spec.*
