import { createAdaptorServer } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Server } from "node:http";
import { setupSocket } from "./socket.js";
import { config, corsDiagnostics, isAllowedOrigin } from "./config.js";
import { disconnectRedis, repo } from "./db/index.js";

console.log("[CORS] CORS_ORIGIN env:", corsDiagnostics.envCorsOrigin);
console.log("[CORS] Parsed envOrigins:", corsDiagnostics.parsedEnvOrigins);
console.log("[CORS] allowAll:", corsDiagnostics.allowAll);
console.log("[CORS] NODE_ENV:", corsDiagnostics.nodeEnv);

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
	}),
);

// Root route — useful for Render health checks & verifying the server is alive
app.get("/", (c) =>
	c.json({
		status: "running",
		server: "CodeSync",
		timestamp: new Date().toISOString(),
		port: config.port,
	}),
);

app.get("/api/health", async (c) => {
	// Surface Redis connectivity so the frontend health check can distinguish a
	// half-up server (HTTP alive but state store down) from a fully healthy one.
	const redisOk = await repo.ping().catch(() => false);
	return c.json({
		status: redisOk ? "ok" : "degraded",
		message: redisOk
			? "Server is healthy"
			: "Server is up but Redis is unavailable",
		redis: redisOk ? "connected" : "disconnected",
		timestamp: new Date().toISOString(),
	});
});

app.get("/api/info", (c) =>
	c.json({
		name: "CodeSync Server",
		version: "1.0.0",
		runtime: "Bun",
		status: "running",
		timestamp: new Date().toISOString(),
	}),
);

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
httpServer.listen(config.port, "0.0.0.0", () => {
	console.log(`Server running on ${config.port}`);
});

// Graceful shutdown — close the Redis connection so pending writes flush.
const shutdown = async (signal: string): Promise<void> => {
	console.log(`[Server] received ${signal}, shutting down...`);
	httpServer.close();
	await disconnectRedis();
	process.exit(0);
};
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// Surface unhandled Redis errors loudly (already logged in redis.ts, but this
// catches any promise rejections involving the client).
process.on("unhandledRejection", (reason) => {
	console.error("[Server] unhandled rejection:", reason);
});
