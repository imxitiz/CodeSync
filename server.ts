import http from "node:http";
import path, { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import cors from "cors";
import type { Request, Response } from "express";
import express from "express";
import type { Socket } from "socket.io";
import { Server } from "socket.io";
import { ACTIONS } from "./action.js";

// Use import.meta.url if available (ESM), otherwise use process.argv[1]
const currentFile =
  import.meta.url || pathToFileURL(process.argv[1] || "server.ts").href;
const __filename = fileURLToPath(currentFile);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const TRAILING_SLASH_REGEX = /\/$/;
const normalize = (origin: string) => origin.replace(TRAILING_SLASH_REGEX, "");

const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
];

const envOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowAll = envOrigins.length === 1 && envOrigins[0] === "*";

const allowedOrigins = new Set(
  [...defaultOrigins, ...envOrigins.filter((o) => o !== "*")].map(normalize)
);

// Also allow any localhost port in development
const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const isDev = process.env.NODE_ENV !== "production";

const ROOM_CLEANUP_DELAY_MS = 500;

// allow requests with no origin (like mobile apps, curl, or server-to-server)
const corsOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  if (!origin) {
    return callback(null, true);
  }
  if (allowAll) {
    return callback(null, true);
  }
  if (isDev && LOCALHOST_REGEX.test(normalize(origin))) {
    return callback(null, true);
  }
  if (allowedOrigins.has(normalize(origin))) {
    return callback(null, true);
  }
  return callback(new Error("CORS policy: This origin is not allowed"), false);
};

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Health check endpoint to wake up server
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// API endpoint for general server info (optional)
app.get("/api/info", (_req: Request, res: Response) => {
  res.json({
    name: "CodeSync Server",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

const userSocketMap = new Map<string, string>();
const roomCreatorMap = new Map<string, string>();

// Multi-tab state: roomId -> { tabId -> { name, code } }
type TabData = { name: string; code: string };
const roomTabsMap = new Map<string, Map<string, TabData>>();

// Track which tab each socket is viewing: socketId -> tabId
const userActiveTabMap = new Map<string, string>();

// Track current editor per room: roomId -> username
const roomCurrentEditorMap = new Map<string, string>();

// Permissions per room per user: roomId -> { username -> permissions }
type UserPermissions = {
  canEdit: boolean;
  canCreateTab: boolean;
  canDeleteTab: boolean;
  canRenameTab: boolean;
};
const roomPermissionsMap = new Map<string, Map<string, UserPermissions>>();

const DEFAULT_PERMISSIONS: UserPermissions = {
  canEdit: false,
  canCreateTab: false,
  canDeleteTab: false,
  canRenameTab: false,
};

const OWNER_PERMISSIONS: UserPermissions = {
  canEdit: true,
  canCreateTab: true,
  canDeleteTab: true,
  canRenameTab: true,
};

const DEFAULT_TAB_ID = "tab-main";
const DEFAULT_TAB_NAME = "main.js";

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
  roomCurrentEditorMap.get(roomId) || "";

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
      username: userSocketMap.get(sid) || "",
      activeTabId: userActiveTabMap.get(sid) || DEFAULT_TAB_ID,
    }))
    .filter((u) => u.username);
};

const getAllconnectedClients = (roomId: string) =>
  [...(io.sockets.adapter.rooms.get(roomId) || [])].map((socketId) => ({
    socketId,
    username: userSocketMap.get(socketId),
  }));

io.on("connection", (socket: Socket) => {
  socket.on(
    ACTIONS.JOIN,
    ({ roomId, userName }: { roomId: string; userName: string }) => {
      userSocketMap.set(socket.id, userName);

      socket.join(roomId);
      let roomCreator: string | undefined;
      if (roomCreatorMap.has(roomId)) {
        roomCreator = roomCreatorMap.get(roomId);
      } else {
        roomCreatorMap.set(roomId, userName);
        roomCreator = userName;
      }

      const clients = getAllconnectedClients(roomId);
      if (
        clients.length > 1 &&
        clients.filter((client) => client.username === userName).length > 1
      ) {
        userSocketMap.delete(socket.id);
        socket.emit(ACTIONS.DUPLICATE_USER, {
          username: userName,
        });
        socket.leave(roomId);
        socket.disconnect();
        return;
      }

      // Ensure tabs and permissions exist for the room
      const tabs = getOrCreateRoomTabs(roomId);
      const perms = getOrCreateRoomPermissions(roomId);
      if (!roomCurrentEditorMap.has(roomId)) {
        setRoomCurrentEditor(roomId, "");
      }

      // Set owner permissions if this is the creator
      if (roomCreator === userName) {
        perms.set(userName, { ...OWNER_PERMISSIONS });
      } else if (!perms.has(userName)) {
        perms.set(userName, { ...DEFAULT_PERMISSIONS });
      }

      // Set default active tab for this socket
      userActiveTabMap.set(socket.id, DEFAULT_TAB_ID);

      // Broadcast editable state to all clients in the room
      for (const { socketId } of clients) {
        io.to(socketId).emit(ACTIONS.JOINED, {
          clients,
          username: userName,
          socketId: socket.id,
          roomcreator: roomCreator,
        });
      }

      // Send tab data and permissions to the joining user
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
      const userName = userSocketMap.get(socket.id);
      if (!userName) {
        return;
      }
      const roomCreator = roomCreatorMap.get(roomId);
      const perms = getOrCreateRoomPermissions(roomId);
      const userPerms = perms.get(userName) || DEFAULT_PERMISSIONS;
      const currentEditor = getRoomCurrentEditor(roomId);
      const canEdit = roomCreator === userName || userPerms.canEdit;

      if (!canEdit) {
        return;
      }

      if (roomCreator !== userName && currentEditor !== userName) {
        return;
      }

      // Store code on server
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
      io.to(socketId).emit(ACTIONS.CODE_CHANGE, {
        tabId,
        code,
        currenteditor,
      });
    }
  );

  socket.on(
    ACTIONS.SET_CURRENT_EDITOR,
    ({ roomId, currenteditor }: { roomId: string; currenteditor: string }) => {
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

  // Tab management events
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
      const roomCreator = roomCreatorMap.get(roomId);
      const perms = getOrCreateRoomPermissions(roomId);
      const userPerms = perms.get(userName) || DEFAULT_PERMISSIONS;
      if (roomCreator !== userName && !userPerms.canCreateTab) {
        return;
      }
      const tabs = roomTabsMap.get(roomId);
      if (tabs) {
        tabs.set(tabId, { name, code: "" });
      }
      io.in(roomId).emit(ACTIONS.TAB_CREATE, { tabId, name });
    }
  );

  socket.on(
    ACTIONS.TAB_CLOSE,
    ({ roomId, tabId }: { roomId: string; tabId: string }) => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) {
        return;
      }
      const roomCreator = roomCreatorMap.get(roomId);
      const perms = getOrCreateRoomPermissions(roomId);
      const userPerms = perms.get(userName) || DEFAULT_PERMISSIONS;
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
      const roomCreator = roomCreatorMap.get(roomId);
      const perms = getOrCreateRoomPermissions(roomId);
      const userPerms = perms.get(userName) || DEFAULT_PERMISSIONS;
      if (roomCreator !== userName && !userPerms.canRenameTab) {
        return;
      }
      const tabs = roomTabsMap.get(roomId);
      if (tabs) {
        const tab = tabs.get(tabId);
        if (tab) {
          tab.name = name;
        }
      }
      io.in(roomId).emit(ACTIONS.TAB_RENAME, { tabId, name });
    }
  );

  socket.on(
    ACTIONS.TAB_SWITCH,
    ({
      roomId,
      tabId,
      username,
    }: {
      roomId: string;
      tabId: string;
      username: string;
    }) => {
      userActiveTabMap.set(socket.id, tabId);
      socket.in(roomId).emit(ACTIONS.TAB_SWITCH, { username, tabId });
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
      permissions: UserPermissions;
    }) => {
      const userName = userSocketMap.get(socket.id);
      if (!userName) {
        return;
      }
      const roomCreator = roomCreatorMap.get(roomId);
      if (roomCreator !== userName) {
        return;
      }
      const perms = getOrCreateRoomPermissions(roomId);
      perms.set(username, permissions);
      io.in(roomId).emit(ACTIONS.PERMISSIONS_UPDATE, {
        username,
        permissions,
      });
    }
  );

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    for (const room of rooms) {
      socket.in(room).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap.get(socket.id),
      });

      // Check if the room is empty after the user leaves
      setTimeout(() => {
        if (io.sockets.adapter.rooms.get(room) === undefined) {
          roomCreatorMap.delete(room);
          roomTabsMap.delete(room);
          roomPermissionsMap.delete(room);
          roomCurrentEditorMap.delete(room);
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
    // socket.leave() doesn't take arguments in Socket.IO v4
  });
});

app.use(express.static("dist"));

// Catch-all handler: send back index.html for non-API routes
app.get("*", (req: Request, res: Response) => {
  // Ensure API routes are not handled by this catch-all
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "API endpoint not found" });
    return;
  }
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  // Server started successfully
  // biome-ignore lint/suspicious/noConsole: Needed
  console.log(`Server is running on port ${PORT}`);
});
