import { Redis } from "ioredis";
import { config } from "../config.js";

// ioredis singleton. One client for the whole server process.
// retryStrategy gives Redis time to come up (e.g. docker compose startup)
// without crashing the server immediately on a cold start.
export const redis = new Redis(config.redisUrl, {
	maxRetriesPerRequest: 10,
	retryStrategy(times: number): number {
		// Exponential backoff: 200ms, 400ms, 800ms ... capped at 10s.
		const delay = Math.min(200 * 2 ** (times - 1), 10_000);
		console.warn(
			`[Redis] reconnecting (attempt ${times}, next try in ${delay}ms)`,
		);
		return delay;
	},
	enableReadyCheck: true,
	lazyConnect: false,
});

redis.on("connect", () => console.log("[Redis] connected"));
redis.on("ready", () => console.log("[Redis] ready"));
redis.on("error", (err: Error) =>
	console.error("[Redis] error:", err.message),
);
redis.on("close", () => console.warn("[Redis] connection closed"));
redis.on("reconnecting", () => console.log("[Redis] reconnecting..."));

// Lua: delete a tab from a room's tabs hash ONLY if more than one tab remains.
// Returns 1 if deleted, 0 if refused (would leave the room with no tabs).
// Keys[1] = codesync:room:{roomId}:tabs ; Argv[1] = tabId
redis.defineCommand("deleteTabIfMultiple", {
	numberOfKeys: 1,
	lua: `
local count = redis.call('HLEN', KEYS[1])
if count > 1 then
  redis.call('HDEL', KEYS[1], ARGV[1])
  return 1
else
  return 0
end
`,
});

export const disconnectRedis = async (): Promise<void> => {
	await redis.quit();
};
