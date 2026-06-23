import type { Server as HttpServer } from "node:http";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
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
  if (!origin) return true;
  if (allowAll) return true;
  if (isDev && LOCALHOST_REGEX.test(normalize(origin))) return true;
  return allowedOrigins.has(normalize(origin));
};

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : ""),
    credentials: true,
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

const httpServer = serve(
  { fetch: app.fetch, port: PORT },
  () => console.log(`Server running on port ${PORT}`)
) as unknown as HttpServer;

setupSocket(httpServer, isAllowedOrigin);
