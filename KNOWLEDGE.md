# CodeSync — KNOWLEDGE.md

> Agent-readable deep knowledge about the CodeSync project.
> Architecture decisions, gotchas, non-obvious patterns.

---

## Architecture Decisions

### Why Hono over Express (2026-06-25)

The backend was migrated from Express to Hono for:
- **Performance**: Hono is 3-5x faster on Bun, uses `uWebSockets.js` under the hood
- **TypeScript-first**: Built-in type inference for routes, middleware, env vars
- **CORS middleware**: Built-in `hono/cors` with proper origin callback
- **Bun native**: Designed for Bun runtime, zero Node.js polyfills needed
- **Smaller bundle**: ~30KB vs Express ~200KB+

### Why vite-react-ssg (not Next.js)

- **Static generation**: Pre-renders React to HTML at build time → deployable to any CDN
- **No server required**: Frontend is pure static files
- **SPA routing**: Client-side routing via react-router-dom
- **Lighter**: No Next.js server overhead, simpler build pipeline

### Socket.IO Room Lifecycle

- Rooms are **in-memory only** (no Redis/pub-sub for multi-instance)
- Room cleanup runs 500ms after last user disconnects
- Room state (creator, tabs, permissions) is lost on server restart
- **No horizontal scaling** without Redis adapter

### Permission Model

- **Creator**: Gets `OWNER_PERMISSIONS` (can edit, create/delete/rename tabs, grant/revoke)
- **Default**: Gets `DEFAULT_PERMISSIONS` (view-only, no tab management)
- **Granular**: Owner can grant specific permissions per-user via `PERMISSIONS_UPDATE`
- **No persistence**: Permissions are in-memory, reset on server restart

## Gotchas

### CORS Double-Enforcement

Both Hono CORS middleware AND Socket.IO CORS config enforce origin checks. They must stay in sync. If you change one, change the other.

### `isAllowedOrigin` Shared Logic

The `isAllowedOrigin` function in `codesync-server/src/index.ts` is passed to `setupSocket()`. If you modify CORS logic, update both the Hono middleware AND the Socket.IO config.

### Tab Sync Race Condition

When a user joins, they receive `TAB_SYNC` with all current tabs. If multiple users create tabs simultaneously, the last write wins (no conflict resolution). Acceptable for a collaborative editor.

### `userActiveTabMap` Not Cleaned on Disconnect

The `userActiveTabMap` is cleaned in `disconnecting`, but if a socket disconnects uncleanly (network drop), the cleanup still fires. However, if the server crashes, stale entries persist until restart.

## Environment-Specific Notes

### Development

- Frontend: http://localhost:5173 (Vite)
- Backend: http://localhost:3000 (Hono on Bun)
- Vite proxy not configured — CORS allows localhost origins explicitly

### Production

- Frontend: Vercel (static deploy)
- Backend: Render/Railway/Fly.io (Bun runtime)
- `CORS_ORIGIN` must match the Vercel deployment URL exactly

## Key Files

| File | Purpose | When to Edit |
|------|---------|-------------|
| `codesync-server/src/index.ts` | Hono app, CORS, server bootstrap | Adding routes, changing CORS |
| `codesync-server/src/socket.ts` | All Socket.IO logic | Room/permission/tab changes |
| `codesync-server/src/actions.ts` | Shared event constants | Adding new socket events |
| `src/utils/socket.ts` | Socket.IO client | Client-side connection logic |
| `src/utils/constants.ts` | Frontend action constants + API URL | Adding events |
| `src/pages/EditorPageModern/` | Main editor UI | UI changes |
| `src/theme/` | Theme system | Adding themes |
| `biome.jsonc` | Linter config | Code style changes |

## Testing

- Server tests: `cd codesync-server && bun test` (Bun's built-in runner)
- Test location: `codesync-server/src/__tests__/`
- What's tested: validation logic (tab IDs, code length, permissions), permission computation, edit access control
- Frontend: No test suite yet (React components need vitest/jsdom setup)
- Manual testing: Open two browser tabs, create room in one, join from other
- Health check: `curl http://localhost:3000/api/health`

---

*Last updated: 2026-06-26 — project-explorer audit*
