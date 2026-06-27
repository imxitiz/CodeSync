import type { ServerType } from "@hono/node-server";
import type { Socket } from "socket.io";
import { Server as SocketServer } from "socket.io";
import { ACTIONS } from "./actions.js";
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_TAB_ID,
  DEFAULT_TAB_NAME,
  isValidCode,
  isValidTabId,
  MAX_TABS_PER_ROOM,
  normalizePermissions,
  OWNER_PERMISSIONS,
  sanitizeTabName,
  type TabData,
  type UserPermissions,
} from "./validation.js";

const ROOM_CLEANUP_DELAY_MS = 500;
const ROOM_CODE_TTL_MS = 60 * 1000;

export function setupSocket(
  httpServer: ServerType,
  isAllowedOrigin: (origin: string | undefined) => boolean
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

  const userSocketMap = new Map<string, string>();
  const roomCreatorMap = new Map<string, string>();
  const roomTabsMap = new Map<string, Map<string, TabData>>();
  const userActiveTabMap = new Map<string, string>();
  const roomCurrentEditorMap = new Map<string, string>();
  const roomPermissionsMap = new Map<string, Map<string, UserPermissions>>();
  const roomCodeTtlTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const getOrCreateRoomTabs = (roomId: string): Map<string, TabData> => {
    let tabs = roomTabsMap.get(roomId);
    if (!tabs) {
      tabs = new Map<string, TabData>();
      tabs.set(DEFAULT_TAB_ID, { name: DEFAULT_TAB_NAME, code: "" });
      roomTabsMap.set(roomId, tabs);
    }
    return tabs;
  };

  const getOrCreateRoomPermissions = (
    roomId: string
  ): Map<string, UserPermissions> => {
    let perms = roomPermissionsMap.get(roomId);
    if (!perms) {
      perms = new Map<string, UserPermissions>();
      roomPermissionsMap.set(roomId, perms);
    }
    return perms;
  };

  const getRoomCurrentEditor = (roomId: string): string =>
    roomCurrentEditorMap.get(roomId) ?? "";

  const setRoomCurrentEditor = (roomId: string, editor: string) => {
    roomCurrentEditorMap.set(roomId, editor);
  };

  const serializeTabs = (
    tabs: Map<string, TabData>
  ): { id: string; name: string; code: string }[] =>
    [...tabs.entries()].map(([id, { name, code }]) => ({ id, name, code }));

  const serializePermissions = (
    perms: Map<string, UserPermissions>
  ): Record<string, UserPermissions> => Object.fromEntries(perms);

  const getUserActiveTabs = (
    roomId: string
  ): { username: string; activeTabId: string }[] => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) {
      return [];
    }
    return [...room]
      .map((sid) => ({
        username: userSocketMap.get(sid) ?? "",
        activeTabId: userActiveTabMap.get(sid) ?? DEFAULT_TAB_ID,
      }))
      .filter((u) => u.username);
  };

  const getAllConnectedClients = (roomId: string) =>
    [...(io.sockets.adapter.rooms.get(roomId) ?? [])].map((socketId) => ({
      socketId,
      username: userSocketMap.get(socketId),
    }));

  const scheduleRoomCodeExpiry = (roomId: string) => {
    const existingTimer = roomCodeTtlTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      roomTabsMap.delete(roomId);
      roomCodeTtlTimers.delete(roomId);
    }, ROOM_CODE_TTL_MS);
    roomCodeTtlTimers.set(roomId, timer);
  };

  const cancelRoomCodeExpiry = (roomId: string) => {
    const existingTimer = roomCodeTtlTimers.get(roomId);
    if (!existingTimer) {
      return;
    }
    clearTimeout(existingTimer);
    roomCodeTtlTimers.delete(roomId);
  };

  io.on("connection", (socket: Socket) => {
    socket.on(
      ACTIONS.JOIN,
      ({ roomId, userName }: { roomId: string; userName: string }) => {
        const existingClients = getAllConnectedClients(roomId);
        if (existingClients.some((c) => c.username === userName)) {
          socket.emit(ACTIONS.DUPLICATE_USER, { username: userName });
          socket.disconnect();
          return;
        }

        userSocketMap.set(socket.id, userName);
        socket.join(roomId);

        cancelRoomCodeExpiry(roomId);

        let roomCreator: string;
        if (roomCreatorMap.has(roomId)) {
          roomCreator = roomCreatorMap.get(roomId) as string;
        } else {
          roomCreatorMap.set(roomId, userName);
          roomCreator = userName;
        }

        const newClientEntry = { socketId: socket.id, username: userName };
        const allClients = [...existingClients, newClientEntry];

        const tabs = getOrCreateRoomTabs(roomId);
        const perms = getOrCreateRoomPermissions(roomId);
        if (!roomCurrentEditorMap.has(roomId)) {
          setRoomCurrentEditor(roomId, "");
        }

        if (roomCreator === userName) {
          perms.set(userName, { ...OWNER_PERMISSIONS });
        } else if (!perms.has(userName)) {
          perms.set(userName, { ...DEFAULT_PERMISSIONS });
        }

        userActiveTabMap.set(socket.id, DEFAULT_TAB_ID);

        for (const { socketId } of existingClients) {
          io.to(socketId).emit(ACTIONS.JOINED, {
            clients: allClients,
            username: userName,
            socketId: socket.id,
            roomcreator: roomCreator,
          });
        }

        socket.emit(ACTIONS.JOINED, {
          clients: allClients,
          username: userName,
          socketId: socket.id,
          roomcreator: roomCreator,
        });

        socket.emit(ACTIONS.TAB_SYNC, {
          tabs: serializeTabs(tabs),
          activeTabId: DEFAULT_TAB_ID,
          userActiveTabs: getUserActiveTabs(roomId),
          permissions: serializePermissions(perms),
        });
      }
    );

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
        if (!(isValidTabId(tabId) && isValidCode(code))) {
          return;
        }

        const userName = userSocketMap.get(socket.id);
        if (!userName) {
          return;
        }

        const roomCreator = roomCreatorMap.get(roomId);
        const perms = getOrCreateRoomPermissions(roomId);
        const userPerms = perms.get(userName) ?? DEFAULT_PERMISSIONS;
        const currentEditor = getRoomCurrentEditor(roomId);
        const canEdit = roomCreator === userName || userPerms.canEdit;

        if (!canEdit) {
          return;
        }
        if (roomCreator !== userName && currentEditor !== userName) {
          return;
        }

        const tabs = roomTabsMap.get(roomId);
        if (tabs) {
          const tab = tabs.get(tabId);
          if (tab) {
            tab.code = code;
          }
        }

        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {
          tabId,
          code,
          currenteditor: getRoomCurrentEditor(roomId),
        });
      }
    );

    socket.on(
      ACTIONS.SYNC_CODE,
      ({
        socketId,
        code,
        currenteditor,
        tabId,
      }: {
        socketId: string;
        code: string;
        currenteditor: string;
        tabId: string;
      }) => {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (!targetSocket) {
          return;
        }

        const senderRooms = [...socket.rooms].filter((r) => r !== socket.id);
        const hasSharedRoom = senderRooms.some((r) =>
          targetSocket.rooms.has(r)
        );

        if (hasSharedRoom) {
          targetSocket.emit(ACTIONS.CODE_CHANGE, {
            tabId,
            code,
            currenteditor,
          });
        }
      }
    );

    socket.on(
      ACTIONS.TAB_CODE_REQUEST,
      ({ roomId, tabId }: { roomId: string; tabId: string }) => {
        if (!socket.rooms.has(roomId)) {
          return;
        }
        if (!isValidTabId(tabId)) {
          return;
        }
        const tabs = roomTabsMap.get(roomId);
        if (!tabs) {
          return;
        }
        const tab = tabs.get(tabId);
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

        const roomCreator = roomCreatorMap.get(roomId);
        const currentEditor = getRoomCurrentEditor(roomId);
        const isOwner = roomCreator === userName;
        const canRelease = currenteditor === "" && currentEditor === userName;

        if (!(isOwner || canRelease)) {
          return;
        }

        setRoomCurrentEditor(roomId, currenteditor);
        socket.in(roomId).emit(ACTIONS.SET_CURRENT_EDITOR, { currenteditor });
      }
    );

    socket.on(
      ACTIONS.TAB_CREATE,
      ({
        roomId,
        tabId,
        name,
      }: {
        roomId: string;
        tabId: string;
        name: string;
      }) => {
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

        const roomCreator = roomCreatorMap.get(roomId);
        const perms = getOrCreateRoomPermissions(roomId);
        const userPerms = perms.get(userName) ?? DEFAULT_PERMISSIONS;
        if (roomCreator !== userName && !userPerms.canCreateTab) {
          return;
        }

        const tabs = roomTabsMap.get(roomId);
        if (tabs && !tabs.has(tabId) && tabs.size < MAX_TABS_PER_ROOM) {
          tabs.set(tabId, { name: sanitizedName, code: "" });
          io.in(roomId).emit(ACTIONS.TAB_CREATE, {
            tabId,
            name: sanitizedName,
          });
        }
      }
    );

    socket.on(
      ACTIONS.TAB_CLOSE,
      ({ roomId, tabId }: { roomId: string; tabId: string }) => {
        const userName = userSocketMap.get(socket.id);
        if (!userName) {
          return;
        }
        if (!isValidTabId(tabId)) {
          return;
        }

        const roomCreator = roomCreatorMap.get(roomId);
        const perms = getOrCreateRoomPermissions(roomId);
        const userPerms = perms.get(userName) ?? DEFAULT_PERMISSIONS;
        if (roomCreator !== userName && !userPerms.canDeleteTab) {
          return;
        }

        const tabs = roomTabsMap.get(roomId);
        if (tabs && tabs.size > 1) {
          tabs.delete(tabId);
          io.in(roomId).emit(ACTIONS.TAB_CLOSE, { tabId });
        }
      }
    );

    socket.on(
      ACTIONS.TAB_RENAME,
      ({
        roomId,
        tabId,
        name,
      }: {
        roomId: string;
        tabId: string;
        name: string;
      }) => {
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

        const roomCreator = roomCreatorMap.get(roomId);
        const perms = getOrCreateRoomPermissions(roomId);
        const userPerms = perms.get(userName) ?? DEFAULT_PERMISSIONS;
        if (roomCreator !== userName && !userPerms.canRenameTab) {
          return;
        }

        const tabs = roomTabsMap.get(roomId);
        if (tabs) {
          const tab = tabs.get(tabId);
          if (tab) {
            tab.name = sanitizedName;
          }
        }

        io.in(roomId).emit(ACTIONS.TAB_RENAME, { tabId, name: sanitizedName });
      }
    );

    socket.on(
      ACTIONS.TAB_SWITCH,
      ({ roomId, tabId }: { roomId: string; tabId: string }) => {
        const userName = userSocketMap.get(socket.id);
        if (!userName) {
          return;
        }
        if (!isValidTabId(tabId)) {
          return;
        }

        userActiveTabMap.set(socket.id, tabId);
        socket
          .in(roomId)
          .emit(ACTIONS.TAB_SWITCH, { username: userName, tabId });
      }
    );

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

        const roomCreator = roomCreatorMap.get(roomId);
        if (roomCreator !== userName) {
          return;
        }

        const normalized = normalizePermissions(permissions);
        if (!normalized) {
          return;
        }

        const perms = getOrCreateRoomPermissions(roomId);
        perms.set(username, normalized);
        io.in(roomId).emit(ACTIONS.PERMISSIONS_UPDATE, {
          username,
          permissions: normalized,
        });
      }
    );

    socket.on(
      ACTIONS.DESTROY_ROOM,
      ({ roomId }: { roomId: string }) => {
        const userName = userSocketMap.get(socket.id);
        if (!userName) {
          return;
        }

        const roomCreator = roomCreatorMap.get(roomId);
        if (roomCreator !== userName) {
          return;
        }

        io.in(roomId).emit(ACTIONS.DISCONNECTED, {
          socketId: socket.id,
          username: userName,
        });

        roomTabsMap.delete(roomId);
        roomCreatorMap.delete(roomId);
        roomPermissionsMap.delete(roomId);
        roomCurrentEditorMap.delete(roomId);
        userActiveTabMap.delete(socket.id);
        userSocketMap.delete(socket.id);

        const timer = roomCodeTtlTimers.get(roomId);
        if (timer) {
          clearTimeout(timer);
          roomCodeTtlTimers.delete(roomId);
        }

        io.to(roomId).disconnectSockets(true);
      }
    );

    socket.on("disconnecting", () => {
      const rooms = [...socket.rooms].filter((r) => r !== socket.id);

      for (const room of rooms) {
        socket.in(room).emit(ACTIONS.DISCONNECTED, {
          socketId: socket.id,
          username: userSocketMap.get(socket.id),
        });

        setTimeout(() => {
          if (!io.sockets.adapter.rooms.get(room)) {
            roomCreatorMap.delete(room);
            roomPermissionsMap.delete(room);
            roomCurrentEditorMap.delete(room);
            scheduleRoomCodeExpiry(room);
          }
        }, ROOM_CLEANUP_DELAY_MS);
      }

      const userName = userSocketMap.get(socket.id);
      if (userName) {
        for (const room of rooms) {
          if (getRoomCurrentEditor(room) === userName) {
            setRoomCurrentEditor(room, "");
            socket.in(room).emit(ACTIONS.SET_CURRENT_EDITOR, {
              currenteditor: "",
            });
          }
        }
      }

      userActiveTabMap.delete(socket.id);
      userSocketMap.delete(socket.id);
    });
  });

  return io;
}
