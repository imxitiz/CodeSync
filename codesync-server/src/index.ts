import { createAdaptorServer } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Server } from "node:http";
import { setupSocket } from "./socket.js";

const TRAILING_SLASH_REGEX = /\/$/;
const normalize = (origin: string) => origin.replace(TRAILING_SLASH_REGEX, "");
const LOCALHOST_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
];

const envOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowAll = envOrigins.length === 1 && envOrigins[0] === "*";
const isDev = process.env.NODE_ENV !== "production";

console.log("[CORS] CORS_ORIGIN env:", process.env.CORS_ORIGIN);
console.log("[CORS] Parsed envOrigins:", envOrigins);
console.log("[CORS] allowAll:", allowAll);
console.log("[CORS] NODE_ENV:", process.env.NODE_ENV);

const allowedOrigins = new Set(
  [...defaultOrigins, ...envOrigins.filter((o) => o !== "*")].map(normalize)
);

const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (allowAll) return true;
  if (isDev && LOCALHOST_REGEX.test(normalize(origin))) return true;
  return allowedOrigins.has(normalize(origin));
};

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = isAllowedOrigin(origin);
      console.log("[CORS] Request origin:", origin, "-> allowed:", allowed);
      return allowed ? origin : "";
    },
    credentials: true,
  })
);

// Root route — useful for Render health checks & verifying the server is alive
app.get("/", (c) =>
  c.json({
    status: "running",
    server: "CodeSync",
    timestamp: new Date().toISOString(),
    port: Number(process.env.PORT) || 3000,
  })
);

app.get("/api/health", (c) =>
  c.json({
    status: "ok",
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  })
);

app.get("/api/info", (c) =>
  c.json({
    name: "CodeSync Server",
    version: "1.0.0",
    runtime: "Bun",
    status: "running",
    timestamp: new Date().toISOString(),
  })
);

const PORT = Number(process.env.PORT) || 3000;

// Create the HTTP server via @hono/node-server but DON'T start listening yet —
// Socket.IO's engine.io needs to attach BEFORE the "listening" event fires,
// otherwise its internal WebSocket server (ws) is never initialized.
const httpServer = createAdaptorServer({
  fetch: app.fetch,
  hostname: "0.0.0.0",
  overrideGlobalObjects: false,
}) as Server;

// Attach Socket.IO FIRST — this registers its 'listening' event listener
// which calls engine.io's init() to create the ws.WebSocketServer.
setupSocket(httpServer, isAllowedOrigin);

// Now start listening — the 'listening' event fires, engine.io's init() runs,
// the ws.WebSocketServer is created, and WebSocket upgrades work.
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});
