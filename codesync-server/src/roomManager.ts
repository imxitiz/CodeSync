// ---------------------------------------------------------------------------
// Room Manager — pure room-state logic, no Socket.IO dependency.
// All room mutation and query lives here so it can be unit-tested without
// a live server. socket.ts is a thin I/O wrapper over this module.
// ---------------------------------------------------------------------------

import { signReclaimToken, verifyReclaimToken } from "./reclaim.js";
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_TAB_ID,
  DEFAULT_TAB_NAME,
  OWNER_PERMISSIONS,
  type TabData,
  type UserPermissions,
} from "./validation.js";

export type Client = { socketId: string; username: string };

export type RoomState = {
  /** The room identifier this state belongs to (used for reclaim token binding). */
  roomId: string;
  /** Currently connected clients, in join order. */
  clients: Client[];
  /** The persistent owner username (survives disconnects until TTL/destroy). */
  creator: string | null;
  /** Wall-clock ms when the room first got an owner (used for reclaim signing). */
  createdAt: number | null;
  /** Set of socket IDs flagged as "owner who disconnected but can reclaim". */
  ownerHasDisconnected: boolean;
  /** Tab data keyed by tab ID. */
  tabs: Map<string, TabData>;
  /** Username → permissions override. */
  permissions: Map<string, UserPermissions>;
  /** Current editor username ("" = none). */
  currentEditor: string;
};

export type JoinResult = {
  ok: boolean;
  reason?: "invalid-room" | "invalid-username" | "duplicate-username";
  room: RoomState;
  /** Null unless this join is reclaiming. */
  reclaimOk: boolean | undefined;
  reclaimToken?: string;
  /** The TOKEN this joining client should persist for future reclaims (only if they are owner). */
  freshToken: string | null;
};

export type TransferResult = {
  ok: boolean;
  reason?: "not-owner" | "invalid-target" | "target-not-in-room";
  room: RoomState;
  /** Fresh token for the new owner. */
  freshToken: string | null;
};

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
  };
}

/**
 * Attempt to join a room. Pure mutation — returns a new result describing what
 * happened. The caller (socket handler) is responsible for emitting the right
 * events based on the result.
 *
 * Handles three paths:
 *   1. Creator already known → normal join, no ownership change.
 *   2. No creator, valid reclaim token → restore owner with fresh token.
 *   3. No creator, no/invalid reclaim token → first joiner becomes owner.
 *
 * Duplicate usernames:
 *   - Non-owner duplicate → rejected.
 *   - Owner token-holder rejoining with their own name → old socket is evicted
 *     (kicked) so the real owner can always reclaim their identity.
 */
export function joinRoom(
  room: RoomState,
  socketId: string,
  userName: string,
  ownerSecret: string,
  reclaimToken: string | undefined,
  now: number
): JoinResult {
  const isOwnerKnown = room.clients.some((c) => c.username === room.creator);
  const existingClient = room.clients.find((c) => c.username === userName);

  // ---- Duplicate handling ----
  // Also treat "username matches the disconnected owner" as a duplicate so an
  // attacker cannot squat on the owner's name while they're away.
  const isDisconnectedOwnerName =
    room.creator === userName && room.ownerHasDisconnected;

  if (existingClient || isDisconnectedOwnerName) {
    // If the joining user is the verified owner (has valid reclaim token),
    // kick the stale socket so the real owner can take over.
    if (
      typeof reclaimToken === "string" &&
      reclaimToken.length > 0 &&
      room.creator === userName
    ) {
      const verified = verifyReclaimToken(
        ownerSecret,
        reclaimToken,
        room.roomId,
        userName,
        now
      );
      if (verified.valid) {
        // Remove the stale socket for this username.
        room.clients = room.clients.filter(
          (c) => c.socketId !== existingClient?.socketId
        );
        if (existingClient) {
          room.permissions.delete(existingClient.username);
        }
        // Fall through to normal join below.
      } else {
        // Token invalid — treat as normal duplicate.
        return { ok: false, reason: "duplicate-username", room, reclaimOk: undefined, freshToken: null };
      }
    } else {
      // Genuine duplicate (no token, or token doesn't match owner name).
      return { ok: false, reason: "duplicate-username", room, reclaimOk: undefined, freshToken: null };
    }
  }

  const client: Client = { socketId, username: userName };
  room.clients.push(client);

  // ---- Determine ownership ----
  let reclaimOk: boolean | undefined;

  if (isOwnerKnown) {
    // Active creator already present — normal join, no change.
  } else if (room.creator !== null && room.ownerHasDisconnected) {
    // Creator is known but disconnected — we just verified the reclaim token
    // above (in the duplicate-handling block). Restore ownership.
    reclaimOk = true;
    room.ownerHasDisconnected = false;
  } else {
    // No creator ever — first joiner becomes owner.
    // If a reclaim token was provided, verify it's for THIS room. A token
    // from another room should not grant ownership here.
    if (
      typeof reclaimToken === "string" &&
      reclaimToken.length > 0
    ) {
      const verified = verifyReclaimToken(
        ownerSecret,
        reclaimToken,
        room.roomId,
        userName,
        now
      );
      if (!verified.valid) {
        // Token is for a different room or invalid — do NOT grant ownership.
        // The user joins as a normal participant.
        room.permissions.set(userName, { ...DEFAULT_PERMISSIONS });
        return { ok: true, reclaimOk: false, room, freshToken: null };
      }
      // Token valid for this room — grant ownership.
    }
    room.creator = userName;
    room.createdAt = now;
  }

  // ---- Grant owner permissions ----
  if (room.creator === userName) {
    room.permissions.set(userName, { ...OWNER_PERMISSIONS });
  } else if (!room.permissions.has(userName)) {
    room.permissions.set(userName, { ...DEFAULT_PERMISSIONS });
  }

  // ---- Fresh reclaim token for the owner ----
  let freshToken: string | null = null;
  if (room.creator === userName) {
    const createdAt = room.createdAt ?? now;
    freshToken = signReclaimToken(ownerSecret, {
      roomId: room.roomId,
      userName,
      joinTs: createdAt,
      v: 1,
    });
  }

  return { ok: true, reclaimOk, room, freshToken };
}

/**
 * Transfer ownership from the current owner to another participant.
 * Pure mutation — returns a description of the result.
 */
export function transferOwner(
  room: RoomState,
  oldOwnerSocketId: string,
  newOwner: string,
  ownerSecret: string,
  now: number
): TransferResult {
  // Verify the sender is the current owner.
  const sender = room.clients.find((c) => c.socketId === oldOwnerSocketId);
  if (!sender || sender.username !== room.creator) {
    return { ok: false, reason: "not-owner", room, freshToken: null };
  }

  // Target must be in the room and not the sender.
  const target = room.clients.find(
    (c) => c.username === newOwner && c.socketId !== oldOwnerSocketId
  );
  if (!target) {
    return { ok: false, reason: "target-not-in-room", room, freshToken: null };
  }

  // Commit transfer.
  room.creator = newOwner;
  room.createdAt = now;
  room.permissions.set(newOwner, { ...OWNER_PERMISSIONS });
  room.permissions.set(sender.username, { ...DEFAULT_PERMISSIONS });

  // Release editor if old owner was editing.
  if (room.currentEditor === sender.username) {
    room.currentEditor = "";
  }

  const freshToken = signReclaimToken(ownerSecret, {
    roomId: room.roomId,
    userName: newOwner,
    joinTs: now,
    v: 1,
  });

  return { ok: true, room, freshToken };
}

/**
 * Remove a client from a room. Returns the updated state and whether the
 * removed client was the owner.
 */
export function disconnectClient(
  room: RoomState,
  socketId: string
): { room: RoomState; wasOwner: boolean } {
  const client = room.clients.find((c) => c.socketId === socketId);
  const wasOwner = client?.username === room.creator;

  room.clients = room.clients.filter((c) => c.socketId !== socketId);
  if (client) {
    room.permissions.delete(client.username);
    if (room.currentEditor === client.username) {
      room.currentEditor = "";
    }
  }

  if (wasOwner) {
    room.ownerHasDisconnected = true;
  }

  return { room, wasOwner };
}

/**
 * Destroy a room entirely.
 */
export function destroyRoomState(room: RoomState): void {
  room.clients = [];
  room.creator = null;
  room.createdAt = null;
  room.ownerHasDisconnected = false;
  room.tabs = new Map([[DEFAULT_TAB_ID, { name: DEFAULT_TAB_NAME, code: "" }]]);
  room.permissions = new Map();
  room.currentEditor = "";
}
