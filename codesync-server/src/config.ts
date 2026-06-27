// Centralized server configuration. Single source of truth for env reads.
// All runtime config is read here once at module load; handlers must not
// touch process.env directly.

const TRAILING_SLASH_REGEX = /\/$/;
const normalize = (origin: string): string =>
	origin.replace(TRAILING_SLASH_REGEX, "");

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

const allowedOrigins = new Set(
	[...defaultOrigins, ...envOrigins.filter((o) => o !== "*")].map(normalize),
);

export const isAllowedOrigin = (origin: string | undefined): boolean => {
	if (!origin) return true;
	if (allowAll) return true;
	if (config.isDev && LOCALHOST_REGEX.test(normalize(origin))) return true;
	return allowedOrigins.has(normalize(origin));
};

export const config = {
	port: Number(process.env.PORT) || 3000,
	corsOrigin: process.env.CORS_ORIGIN ?? "",
	nodeEnv: process.env.NODE_ENV ?? "development",
	redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
	get isDev(): boolean {
		return this.nodeEnv !== "production";
	},
} as const;

// Exported for diagnostic logging in index.ts.
export const corsDiagnostics = {
	envCorsOrigin: process.env.CORS_ORIGIN,
	parsedEnvOrigins: envOrigins,
	allowAll,
	nodeEnv: process.env.NODE_ENV,
};
