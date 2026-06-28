import type { Server } from "node:http";
import { createAdaptorServer } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomBytes } from "node:crypto";
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

const allowedOrigins = new Set(
  [...defaultOrigins, ...envOrigins.filter((o) => o !== "*")].map(normalize)
);

const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) {
    return true;
  }
  if (allowAll) {
    return true;
  }
  if (isDev && LOCALHOST_REGEX.test(normalize(origin))) {
    return true;
  }
  return allowedOrigins.has(normalize(origin));
};

// ---------------------------------------------------------------------------
// Owner-reclaim secret
// ---------------------------------------------------------------------------
// Used to sign HMAC tokens that let the original room owner reclaim creator
// rights after an accidental disconnect. MUST be set in production so tokens
// survive server restarts. If unset, a random secret is generated and the
// server will fail to start (fail-secure — we do NOT silently allow unverified
// reclaims).
// ---------------------------------------------------------------------------
let OWNER_SECRET: string | undefined = process.env.CODESYNC_OWNER_SECRET;
if (!OWNER_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[codesync] FATAL: CODESYNC_OWNER_SECRET env var is required in production.\n" +
        "Generate one:  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
    process.exit(1);
  }
  // Dev only — ephemeral, logged so the developer knows it's temporary.
  const devSecret = randomBytes(32).toString("hex");
  console.warn(
    `[codesync] WARNING: CODESYNC_OWNER_SECRET not set — using ephemeral dev secret.\n` +
      `Tokens will NOT survive server restarts. Set it for persistent dev:\n` +
      `  export CODESYNC_OWNER_SECRET=${devSecret}`
  );
  process.env.CODESYNC_OWNER_SECRET = devSecret;
  OWNER_SECRET = devSecret;
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowed = isAllowedOrigin(origin);
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
setupSocket(httpServer, isAllowedOrigin, OWNER_SECRET);

// Now start listening — the 'listening' event fires, engine.io's init() runs,
// the ws.WebSocketServer is created, and WebSocket upgrades work.

// Try to find an available port by incrementing if the current one is in use
const startServer = (port: number, maxPort = port + 10): void => {
  httpServer.once("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      if (port + 1 > maxPort) {
        console.error(`No available port found up to ${maxPort}, giving up.`);
        process.exit(1);
      }
      httpServer.removeAllListeners("error");
      startServer(port + 1, maxPort);
    } else {
      console.error("Server error:", err);
      process.exit(1);
    }
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
  });
};

startServer(PORT);
