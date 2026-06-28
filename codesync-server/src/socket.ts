import type { ServerType } from "@hono/node-server";
import type { Socket } from "socket.io";
import { Server as SocketServer } from "socket.io";
import { ACTIONS } from "./actions.js";
import { verifyReclaimToken } from "./reclaim.js";
import {
  createRoomState,
  destroyRoomState,
  disconnectClient,
  joinRoom,
  transferOwner,
  type RoomState,
} from "./roomManager.js";
import {
  isValidCode,
  isValidTabId,
  MAX_TABS_PER_ROOM,
  normalizePermissions,
  sanitizeTabName,
  type TabData,
  type UserPermissions,
} from "./validation.js";

const ROOM_CODE_TTL_MS = 8 * 60 * 60 * 1000;
const ROOM_CLEANUP_DELAY_MS = 500;
const MAX_ROOM_ID_LENGTH = 256;
const MAX_USERNAME_LENGTH = 32;

export function setupSocket(
  httpServer: ServerType,
  isAllowedOrigin: (origin: string | undefined) => boolean,
  ownerSecret: string
): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error("CORS policy: This origin is not allowed"));
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // All room state lives in this map. Each room is a RoomState.
  const rooms = new Map<string, RoomState>();
  const roomTtlTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const userSocketMap = new Map<string, string>(); // socketId → username
  const userActiveTabMap = new Map<string, string>(); // socketId → tabId

  const getRoom = (roomId: string): RoomState => {
    let room = rooms.get(roomId);
    if (!room) {
      room = createRoomState(roomId);
      rooms.set(roomId, room);
    }
    return room;
  };

  const cancelTtl = (roomId: string) => {
    const t = roomTtlTimers.get(roomId);
    if (t) {
      clearTimeout(t);
      roomTtlTimers.delete(roomId);
    }
  };

  const scheduleTtl = (roomId: string) => {
    const existing = roomTtlTimers.get(roomId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      const room = rooms.get(roomId);
      if (room) destroyRoomState(room);
      rooms.delete(roomId);
      roomTtlTimers.delete(roomId);
    }, ROOM_CODE_TTL_MS);
    roomTtlTimers.set(roomId, timer);
  };

  const emitToSocket = (socketId: string, event: string, payload: unknown) => {
    io.to(socketId).emit(event, payload);
  };

  io.on("connection", (socket: Socket) => {
    socket.on(ACTIONS.JOIN, ({ roomId, userName, reclaimToken }) => {
      // ---- Input validation ----
      if (
        typeof roomId !== "string" ||
        roomId.length === 0 ||
        roomId.length > MAX_ROOM_ID_LENGTH
      ) {
        emitToSocket(socket.id, ACTIONS.DUPLICATE_USER, { username: userName });
        socket.disconnect();
        return;
      }
      if (
        typeof userName !== "string" ||
        userName.length === 0 ||
        userName.length > MAX_USERNAME_LENGTH
      ) {
        emitToSocket(socket.id, ACTIONS.DUPLICATE_USER, { username: userName });
        socket.disconnect();
        return;
      }

      cancelTtl(roomId);
      const room = getRoom(roomId);
      const now = Date.now();

      const result = joinRoom(
        room,
        socket.id,
        userName,
        ownerSecret,
        reclaimToken,
        now
      );

      if (!result.ok) {
        emitToSocket(socket.id, ACTIONS.DUPLICATE_USER, { username: userName });
        socket.disconnect();
        return;
      }

      userSocketMap.set(socket.id, userName);
      userActiveTabMap.set(socket.id, "tab-main");

      // Join the Socket.IO room
      socket.join(roomId);

      // If the owner reclaimed by kicking a stale socket, disconnect that socket.
      // (joinRoom already removed it from room.clients; we just need to tell it.)
      // We can't easily know which socket was kicked here — that's handled by
      // the caller if needed. For now, the stale socket will get a DISCONNECTED
      // broadcast when it next tries to interact.

      // Broadcast JOINED to existing clients.
      for (const client of room.clients) {
        if (client.socketId === socket.id) continue;
        emitToSocket(client.socketId, ACTIONS.JOINED, {
          clients: room.clients,
          username: userName,
          socketId: socket.id,
          roomcreator: room.creator,
        });
      }

      // JOINED to the joining socket.
      emitToSocket(socket.id, ACTIONS.JOINED, {
        clients: room.clients,
        username: userName,
        socketId: socket.id,
        roomcreator: room.creator,
      });

      // TAB_SYNC to the joining socket.
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
      });

      // Fresh reclaim token for the owner.
      if (result.freshToken) {
        emitToSocket(socket.id, ACTIONS.RECLAIM_RESULT, {
          ok: true,
          token: result.freshToken,
        });
      } else if (result.reclaimOk === false && result.reclaimToken) {
        // Reclaim failed — tell the client.
        emitToSocket(socket.id, ACTIONS.RECLAIM_RESULT, {
          ok: false,
          reason: "invalid-or-expired",
        });
      }
    });

socket.on(
      ACTIONS.CODE_CHANGE,
      ({
        roomId,
        tabId,
        code,
      }: {
        roomId: string;
        tabId: string;
        code: string;
      }) => {
        if (!socket.rooms.has(roomId)) {
          return;
        }
        const room = rooms.get(roomId);
        if (!room) {
          return;
        }
        const userName = userSocketMap.get(socket.id);
        if (!userName) {
          return;
        }

        // Only owner or current editor can edit
        const isOwner = room.creator === userName;
        const isEditor = room.currentEditor === userName;
        if (!isOwner && !isEditor) {
          return;
        }

        if (!isValidTabId(tabId) || !isValidCode(code)) {
          return;
        }

        const tab = room.tabs.get(tabId);
        if (!tab) {
          return;
        }
        tab.code = code;

        // Broadcast to room (excluding sender)
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {
          tabId,
          code,
          currenteditor: room.currentEditor,
        });
      }
    );

    socket.on(
      ACTIONS.TAB_CODE_REQUEST,
      ({
        roomId,
        tabId,
      }: {
        roomId: string;
        tabId: string;
      }) => {
        if (!socket.rooms.has(roomId)) {
          return;
        }
        if (!isValidTabId(tabId)) {
          return;
        }
        const room = rooms.get(roomId);
        if (!room) {
          return;
        }
        const tab = room.tabs.get(tabId);
        if (!tab) {
          return;
        }
        socket.emit(ACTIONS.TAB_CODE, { tabId, code: tab.code });
      }
    );

    socket.on(
      ACTIONS.SET_CURRENT_EDITOR,
      ({
        roomId,
        currenteditor,
      }: {
        roomId: string;
        currenteditor: string;
      }) => {
        const userName = userSocketMap.get(socket.id);
        if (!userName) {
          return;
        }

        const room = rooms.get(roomId);
        if (!room) {
          return;
        }

        const isOwner = room.creator === userName;
        const currentEditor = room.currentEditor;
        const canRelease = currenteditor === "" && currentEditor === userName;
        const perms = room.permissions.get(userName) ?? {
          canEdit: false,
          canCreateTab: false,
          canDeleteTab: false,
          canRenameTab: false,
        };
        const canTakeEdit = currenteditor !== "" && perms.canEdit;

        if (!(isOwner || canRelease || canTakeEdit)) {
          return;
        }

        room.currentEditor = currenteditor;

        // If someone is taking edit from another user, revoke their canEdit
        if (
          currenteditor !== "" &&
          currentEditor !== "" &&
          currentEditor !== currenteditor
        ) {
          const oldEditorPerms = room.permissions.get(currentEditor);
          if (
            oldEditorPerms &&
            room.creator !== currentEditor &&
            oldEditorPerms.canEdit
          ) {
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
    );

    socket.on(ACTIONS.TAB_CREATE, ({ roomId, tabId, name }) => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) {
        return;
      }

      if (!(socket.rooms.has(roomId) && isValidTabId(tabId))) {
        return;
      }
      const sanitizedName = sanitizeTabName(name);
      if (!sanitizedName) {
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        return;
      }
      const roomCreator = room.creator;
      const perms = room.permissions.get(userName) ?? {
        canEdit: false,
        canCreateTab: false,
        canDeleteTab: false,
        canRenameTab: false,
      };
      if (roomCreator !== userName && !perms.canCreateTab) {
        return;
      }

      if (!room.tabs.has(tabId) && room.tabs.size < MAX_TABS_PER_ROOM) {
        room.tabs.set(tabId, { name: sanitizedName, code: "" });
        io.in(roomId).emit(ACTIONS.TAB_CREATE, {
          tabId,
          name: sanitizedName,
        });
      }
    });

    socket.on(ACTIONS.TAB_CLOSE, ({ roomId, tabId }) => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) {
        return;
      }
      if (!isValidTabId(tabId)) {
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        return;
      }
      const roomCreator = room.creator;
      const perms = room.permissions.get(userName) ?? {
        canEdit: false,
        canCreateTab: false,
        canDeleteTab: false,
        canRenameTab: false,
      };
      if (roomCreator !== userName && !perms.canDeleteTab) {
        return;
      }

      if (room.tabs.size > 1) {
        room.tabs.delete(tabId);
        io.in(roomId).emit(ACTIONS.TAB_CLOSE, { tabId });
      }
    });

    socket.on(ACTIONS.TAB_RENAME, ({ roomId, tabId, name }) => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) {
        return;
      }
      if (!isValidTabId(tabId)) {
        return;
      }
      const sanitizedName = sanitizeTabName(name);
      if (!sanitizedName) {
        return;
      }

      const room = rooms.get(roomId);
      if (!room) {
        return;
      }
      const roomCreator = room.creator;
      const perms = room.permissions.get(userName) ?? {
        canEdit: false,
        canCreateTab: false,
        canDeleteTab: false,
        canRenameTab: false,
      };
      if (roomCreator !== userName && !perms.canRenameTab) {
        return;
      }

      const tab = room.tabs.get(tabId);
      if (tab) {
        tab.name = sanitizedName;
      }

      io.in(roomId).emit(ACTIONS.TAB_RENAME, { tabId, name: sanitizedName });
    });

    socket.on(ACTIONS.TAB_SWITCH, ({ roomId, tabId }) => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) {
        return;
      }
      if (!isValidTabId(tabId)) {
        return;
      }

      userActiveTabMap.set(socket.id, tabId);
      socket.in(roomId).emit(ACTIONS.TAB_SWITCH, { username: userName, tabId });
    });

    socket.on(
      ACTIONS.PERMISSIONS_UPDATE,
      ({
        roomId,
        username,
        permissions,
      }: {
        roomId: string;
        username: string;
        permissions: unknown;
      }) => {
        if (!socket.rooms.has(roomId)) {
          return;
        }

        const userName = userSocketMap.get(socket.id);
        if (!userName) {
          return;
        }

        const room = rooms.get(roomId);
        if (!room || room.creator !== userName) {
          return;
        }

        const normalized = normalizePermissions(permissions);
        if (!normalized) {
          return;
        }

        room.permissions.set(username, normalized);
        io.in(roomId).emit(ACTIONS.PERMISSIONS_UPDATE, {
          username,
          permissions: normalized,
        });
      }
    );

    socket.on(ACTIONS.DESTROY_ROOM, ({ roomId, reclaimToken }) => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) return;

      const room = rooms.get(roomId);
      if (!room || room.creator !== userName) return;

      if (typeof reclaimToken !== "string" || reclaimToken.length === 0) {
        return;
      }
      const now = Date.now();
      const verified = verifyReclaimToken(
        ownerSecret,
        reclaimToken,
        room.roomId,
        userName,
        now
      );
      if (!verified.valid) return;

      io.in(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userName,
      });

      destroyRoomState(room);
      rooms.delete(roomId);
      const t = roomTtlTimers.get(roomId);
      if (t) {
        clearTimeout(t);
        roomTtlTimers.delete(roomId);
      }
      io.to(roomId).disconnectSockets(true);
    });

    socket.on(ACTIONS.TRANSFER_OWNER, ({ roomId, newOwner }) => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) return;

      const room = rooms.get(roomId);
      if (!room) return;

      const now = Date.now();
      const result = transferOwner(room, socket.id, newOwner, ownerSecret, now);

      if (result.ok) {
        io.in(roomId).emit(ACTIONS.OWNER_TRANSFERRED, {
          oldOwner: userName,
          newOwner,
          token: result.freshToken,
        });
      }
    });

    socket.on("disconnecting", () => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) return;

      const roomsForSocket = [...socket.rooms].filter((r) => r !== socket.id);
      for (const roomId of roomsForSocket) {
        const room = rooms.get(roomId);
        if (!room) continue;

        const { wasOwner } = disconnectClient(room, socket.id);

        socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
          socketId: socket.id,
          username: userName,
        });

        if (wasOwner) {
          // Owner left — broadcast so clients can update UI.
          socket.in(roomId).emit(ACTIONS.RECLAIM_RESULT, {
            ok: false,
            owner: null,
          });
        }

        setTimeout(() => {
          if (!io.sockets.adapter.rooms.get(roomId)) {
            // Last socket left
            if (wasOwner && room.clients.length === 0) {
              // Owner was last person — destroy immediately.
              destroyRoomState(room);
              rooms.delete(roomId);
              const t = roomTtlTimers.get(roomId);
              if (t) {
                clearTimeout(t);
                roomTtlTimers.delete(roomId);
              }
            } else {
              // Non-owner or other clients remain — schedule TTL.
              scheduleTtl(roomId);
            }
          }
        }, ROOM_CLEANUP_DELAY_MS);
      }

      userActiveTabMap.delete(socket.id);
      userSocketMap.delete(socket.id);
    });
  });

  return io;
}
