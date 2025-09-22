import http from "node:http";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";
import { ACTIONS } from "./action.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const TRAILING_SLASH_REGEX = /\/$/;
const normalize = (origin) => origin.replace(TRAILING_SLASH_REGEX, "");

const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
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

const ROOM_CLEANUP_DELAY_MS = 500;

// allow requests with no origin (like mobile apps, curl, or server-to-server)
const corsOrigin = (origin, callback) => {
  if (!origin) {
    return callback(null, true);
  }
  if (allowAll) {
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
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// API endpoint for general server info (optional)
app.get("/api/info", (_req, res) => {
  res.json({
    name: "CodeSync Server",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

const userSocketMap = new Map();
const roomCreatorMap = new Map();

const getAllconnectedClients = (roomId) =>
  [...io.sockets.adapter.rooms.get(roomId)].map((socketId) => ({
    socketId,
    username: userSocketMap.get(socketId),
  }));

io.on("connection", (socket) => {
  socket.on(ACTIONS.JOIN, ({ roomId, userName }) => {
    userSocketMap.set(socket.id, userName);

    socket.join(roomId);
    let roomCreator = null;
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

    // Broadcast editable state to all clients in the room
    for (const { socketId } of clients) {
      io.to(socketId).emit(ACTIONS.JOINED, {
        clients,
        username: userName,
        socketId: socket.id,
        roomcreator: roomCreator,
      });
    }
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code, currenteditor }) => {
    socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code, currenteditor });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code, currenteditor }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code, currenteditor });
  });

  socket.on(ACTIONS.SET_CURRENT_EDITOR, ({ roomId, currenteditor }) => {
    socket.in(roomId).emit(ACTIONS.SET_CURRENT_EDITOR, { currenteditor });
  });

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
        }
      }, ROOM_CLEANUP_DELAY_MS);
    }
    userSocketMap.delete(socket.id);
    socket.leave();
  });
});

app.use(express.static("dist"));

// Catch-all handler: send back index.html for non-API routes
app.get("*", (req, res) => {
  // Ensure API routes are not handled by this catch-all
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {});
