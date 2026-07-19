# CodeSync — Agent Project Reference

> **This file is a CONTRACT between this project and every AI coding agent that enters it.**
> It is NOT documentation — it is a SPECIFICATION for agent behavior.
>
> **⚠️ This file is a LIVING DOCUMENT.** After any major change (new feature, architecture change, dependency upgrade),
> you MUST update this file to reflect reality. If the code and this file disagree, the code wins —
> fix this file to match.

---

## Table of Contents

1. [Project Identity](#project-identity)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [SWE Principles — The Layered Law](#swe-principles--the-layered-law)
5. [Architecture Map](#architecture-map)
6. [Commands](#commands)
7. [Known Issues / Tech Debt](#known-issues--tech-debt)
8. [Self-Maintenance Protocol](#self-maintenance-protocol)

---

## Project Identity

**CodeSync** — Real-time collaborative code editor with WebSocket synchronization. Monorepo with React frontend (Vite + SSG) and Bun/Hono/Socket.IO backend.

| Property | Value | Source |
|----------|-------|--------|
| Package name | `codesync-socketio` | `package.json` |
| Version | `0.0.0` | `package.json` |
| Type | Monorepo (Frontend + Backend) | `package.json` workspaces |
| Frontend | React 19 + Vite 7 + Tailwind 4 | `package.json` |
| Backend | Hono + Socket.IO on Bun | `codesync-server/package.json` |
| Real-time | Socket.IO 4.8 | `codesync-server/src/socket.ts` |
| Editor | CodeMirror 6 | `@uiw/react-codemirror` |
| Deploy | Static (SSG) + Bun server | `vercel.json`, `wrangler.jsonc` |

---

## Tech Stack

| Layer | Choice | Version | Notes |
|-------|--------|---------|-------|
| Runtime (Frontend) | Node.js | 20+ | Vite dev server |
| Runtime (Backend) | Bun | 1.1+ | `bun --watch` for dev |
| Language | TypeScript | 5.9 | Strict mode |
| Frontend Framework | React | 19.2 | Concurrent features |
| Build Tool | Vite | 7.3 | `vite-react-ssg` for SSG |
| Styling | Tailwind CSS | 4.3 | Vite plugin |
| Editor | CodeMirror 6 | 6.2 | `@uiw/react-codemirror` |
| UI Components | Radix UI | 1.6 / 2.3 | Headless, accessible |
| State | React Context + Zustand | — | `shared/` for types |
| Real-time | Socket.IO | 4.8 | Client + Server |
| HTTP Server | Hono | 4.6 | On `@hono/node-server` |
| Lint/Format | Ultracite (Biome) | 7.8 | `ultracite check/fix` |
| Type Check | TypeScript | 5.9 | `tsc --noEmit` |

---

## Project Structure

> **⚠️ This structure was verified by filesystem scan on 2026-07-02.**
> If you add/remove files, update this section.

```
CodeSync/
├── codesync-server/                 # Backend workspace
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # Entry: Hono + Socket.IO setup
│       ├── socket.ts                # Socket.IO event handlers (16KB)
│       ├── roomManager.ts           # Room state, CRDT sync (16KB)
│       ├── validation.ts            # Zod schemas for socket events
│       ├── __tests__/               # Bun tests (empty)
│       └── types.ts                 # Server-specific types
├── src/                             # Frontend source
│   ├── main.tsx                     # Entry point
│   ├── App.tsx                      # Root component
│   ├── components/                  # React components
│   │   ├── editor/                  # CodeMirror wrapper, toolbar
│   │   ├── ui/                      # Radix-based UI primitives
│   │   └── layout/                  # Panels, resizable splits
│   ├── hooks/                       # Custom React hooks
│   │   ├── useSocket.ts             # Socket.IO client connection
│   │   ├── useRoom.ts               # Room state management
│   │   └── useEditor.ts             # Editor synchronization
│   ├── context/                     # React Context providers
│   │   ├── SocketContext.tsx
│   │   └── RoomContext.tsx
│   ├── pages/                       # Page components (SSG routes)
│   │   ├── Home.tsx
│   │   ├── Room.tsx
│   │   └── Join.tsx
│   ├── styles/                      # Global styles, Tailwind
│   └── utils/                       # Helpers
├── shared/                          # Shared types (Frontend ↔ Backend)
│   ├── actions.ts                   # Socket event payloads
│   ├── room.ts                      # Room, User, Cursor types
│   └── editor.ts                    # Editor operation types
├── agents/                          # Agent workflows (internal)
├── docs/                            # Documentation
├── public/                          # Static assets
├── dist/                            # Build output (SSG)
├── .env / .env.example              # Environment variables
├── biome.jsonc                      # Biome/Ultracite config
├── tsconfig.json                    # Frontend TS config
├── vite.config.ts                   # Vite config (SSG + Tailwind)
├── vercel.json                      # Vercel deploy config
├── wrangler.jsonc                   # Cloudflare Pages config
├── package.json                     # Root workspace
└── AGENTS.md                        # This file
```

---

## SWE Principles — The Layered Law

**Every change MUST comply with these principles. No exceptions.**

### 1. The Layered Architecture (Minimum 3 Abstraction Layers)

```
┌─────────────────────────────────────────────┐
│  Frontend Pages / Components                │  ← React components, user interaction
├─────────────────────────────────────────────┤
│  Frontend State / Hooks / Context           │  ← Socket connection, room sync, editor
├─────────────────────────────────────────────┤
│  Shared Types (contract)                    │  ← Zod schemas, TypeScript interfaces
├─────────────────────────────────────────────┤
│  Backend Socket Handlers                    │  ← Event processing, validation
├─────────────────────────────────────────────┤
│  Room Manager (Business Logic)              │  ← CRDT, presence, history, ownership
├─────────────────────────────────────────────┤
│  Transport (Socket.IO + Hono)               │  ← WebSocket server, HTTP health checks
└─────────────────────────────────────────────┘
```

- **Shared types are the CONTRACT.** `shared/actions.ts`, `shared/room.ts`, `shared/editor.ts` — both sides import these.
- **Frontend hooks orchestrate.** `useSocket` → connection, `useRoom` → presence/sync, `useEditor` → operations.
- **Backend validates FIRST.** `validation.ts` (Zod) runs before any roomManager logic.
- **RoomManager is pure.** No Socket.IO imports — only takes operations, returns state changes.

### 2. The Dependency Rule

- Frontend → Shared Types ← Backend
- Frontend hooks import Shared Types
- Backend socket.ts imports Shared Types + validation.ts + roomManager.ts
- **Backend NEVER imports frontend code.** Frontend NEVER imports backend code.
- Validation runs at the boundary (socket.ts) before business logic.

### 3. Zero Hardcoding

- **Every** port, CORS origin, room limit, history size, timeout comes from environment.
- `CODESYNC_OWNER_SECRET` — required in production, validated at startup (fail-secure).
- `CORS_ORIGIN` — comma-separated, supports `*` for dev.
- `PORT` — default 3000, auto-increments on collision.
- If you find a magic number in `roomManager.ts` or `socket.ts`, extract to env/config.

### 4. Type Safety

- **Zod schemas for ALL socket events** — `validation.ts` defines `ClientToServerEvents`, `ServerToClientEvents`.
- TypeScript strict mode enabled in both `tsconfig.json` files.
- Shared types use `type` (not `interface`) for discriminated unions.
- `socket.ts` uses `Server<ClientToServerEvents, ServerToClientEvents>` for full type safety.

### 5. Separation of Concerns

| Concern | Where | Files |
|---------|-------|-------|
| HTTP server setup | Backend entry | `codesync-server/src/index.ts` |
| Socket event routing | Backend | `codesync-server/src/socket.ts` |
| Room state / CRDT / Sync | Backend | `codesync-server/src/roomManager.ts` |
| Event validation | Backend | `codesync-server/src/validation.ts` |
| Socket connection | Frontend | `src/hooks/useSocket.ts` |
| Room presence / sync | Frontend | `src/hooks/useRoom.ts` |
| Editor operations | Frontend | `src/hooks/useEditor.ts` |
| Editor component | Frontend | `src/components/editor/` |
| Shared contract | Both | `shared/*.ts` |
| UI primitives | Frontend | `src/components/ui/` |

### 6. Resilience Patterns

- **Owner reclaim tokens** — HMAC-signed tokens let original room owner reclaim rights after disconnect. `CODESYNC_OWNER_SECRET` required in production.
- **Port collision handling** — Server auto-increments port up to +10 on `EADDRINUSE`.
- **CORS with credentials** — Origin validation allows specific origins + localhost in dev. `credentials: true`.
- **Fail-secure startup** — Missing `CODESYNC_OWNER_SECRET` in production → hard exit with instructions.
- **Room cleanup** — Empty rooms auto-deleted after timeout (implemented in roomManager).

### 7. The Change-Once Rule (DRY)

Socket event types defined **once** in `shared/actions.ts` → used by:
- Frontend: `useSocket.ts` emit/listen types
- Backend: `validation.ts` Zod schemas
- Backend: `socket.ts` handler signatures

If you add a socket event, update `shared/actions.ts` only.

### 8. YAGNI (You Aren't Gonna Need It)

- No operational transform (OT) — using simple last-write-wins + cursors for MVP.
- No persistence layer — rooms in memory only. Add Redis/DB when needed.
- No authentication — rooms are public by ID. Add auth when required.
- No conflict resolution UI — show remote cursors, let users coordinate.

---

## Architecture Map

### Socket Event Contract (`shared/actions.ts`)

```typescript
// Client → Server
type ClientToServerEvents = {
  'join-room': (payload: { roomId: string; userName: string }) => void;
  'leave-room': (payload: { roomId: string }) => void;
  'editor-operation': (payload: EditorOperation) => void;
  'cursor-update': (payload: CursorPosition) => void;
  'request-sync': (payload: { roomId: string }) => void;
  'claim-ownership': (payload: { roomId: string; token: string }) => void;
};

// Server → Client
type ServerToClientEvents = {
  'room-state': (payload: RoomState) => void;
  'user-joined': (payload: User) => void;
  'user-left': (payload: { userId: string }) => void;
  'editor-operation': (payload: EditorOperation & { userId: string }) => void;
  'cursor-update': (payload: CursorPosition & { userId: string }) => void;
  'sync-response': (payload: RoomState) => void;
  'ownership-claimed': (payload: { userId: string }) => void;
  'error': (payload: { code: string; message: string }) => void;
};
```

### Room Manager (`roomManager.ts`) — Core Operations

```typescript
class RoomManager {
  // Room lifecycle
  createRoom(roomId: string): Room;
  getRoom(roomId: string): Room | undefined;
  deleteRoom(roomId: string): void;

  // User presence
  addUser(roomId: string, user: User): void;
  removeUser(roomId: string, userId: string): void;
  updateUserCursor(roomId: string, userId: string, cursor: CursorPosition): void;

  // Editor synchronization
  applyOperation(roomId: string, userId: string, op: EditorOperation): void;
  requestSync(roomId: string, userId: string): RoomState;

  // Ownership
  generateOwnerToken(roomId: string, userId: string): string;
  verifyOwnerToken(roomId: string, token: string): string | null; // returns userId
}
```

### Frontend Data Flow

```
User types in CodeMirror
    ↓
useEditor captures change → converts to EditorOperation
    ↓
useSocket emits 'editor-operation'
    ↓
Server socket.ts validates (Zod) → roomManager.applyOperation()
    ↓
roomManager broadcasts to other users in room
    ↓
Other clients: useSocket receives 'editor-operation' → useEditor applies to CodeMirror
```

---

## Commands

```bash
# Install all dependencies (root + server)
npm ci

# Development: Frontend + Backend concurrently
npm run dev

# Development: Frontend only (Vite + SSG build)
npm run dev:front

# Development: Backend only (Bun watch mode)
npm run dev:server

# Production build (SSG)
npm run build

# Type checking (both workspaces)
npm run type-check

# Lint + Format (Ultracite/Biome)
npm run check
npm run fix

# Preview production build
npm run preview

# Run backend tests
cd codesync-server && bun test

# Deploy to Vercel (frontend)
vercel --prod

# Deploy to Cloudflare Pages (frontend)
wrangler pages deploy dist
```

### Environment Variables

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `PORT` | `3000` | No | Backend HTTP/WebSocket port |
| `NODE_ENV` | `development` | No | `production` enables strict checks |
| `CORS_ORIGIN` | `http://localhost:5173,http://localhost:3000` | No | Comma-separated allowed origins |
| `CODESYNC_OWNER_SECRET` | — | **Yes (prod)** | HMAC secret for owner reclaim tokens |

---

## Known Issues / Tech Debt

- **🟡 No backend tests** — `codesync-server/src/__tests__/` exists but empty. Add Bun tests for `roomManager.ts`.
- **🟡 No persistence** — Rooms lost on server restart. Plan: Redis adapter for Socket.IO + periodic snapshots.
- **🟡 No authentication** — Anyone with room ID can join. Add JWT auth when needed.
- **🟡 CRDT not implemented** — Using last-write-wins. Add Yjs or Automerge for true conflict-free editing.
- **🟡 Single server instance** — No horizontal scaling. Socket.IO Redis adapter needed for multi-instance.
- **🟡 Frontend test coverage** — No Vitest/React Testing Library setup. Add for critical hooks.
- **🟡 `shared/` types not published** — Duplicated in both workspaces. Consider npm package or git submodule.
- **🟡 Room cleanup timeout not configurable** — Hardcoded in `roomManager.ts`. Move to env.
- **🟡 No rate limiting on socket events** — Malicious client could flood. Add per-socket rate limit.
- **✅ Type-safe socket events** — Zod + TypeScript generics on both sides.
- **✅ Owner reclaim tokens** — HMAC-signed, fail-secure in production.
- **✅ Port auto-increment** — Handles `EADDRINUSE` gracefully.
- **✅ CORS + credentials** — Proper origin validation with dev fallback.

---

## Self-Maintenance Protocol

**This section is about keeping THIS FILE accurate. It's your responsibility as an agent working in this repo.**

### When to Update This File

Update this AGENTS.md when:

- [ ] New socket event added (update Architecture Map → Socket Event Contract)
- [ ] RoomManager API changes (update Architecture Map → Room Manager)
- [ ] Frontend hook API changes (update Separation of Concerns)
- [ ] New environment variable added (update Commands → Environment Variables)
- [ ] Shared types structure changes (update Architecture Map)
- [ ] Tech debt items resolved (remove from list)
- [ ] New tech debt discovered (add to list)
- [ ] Deployment target changes (Vercel, Cloudflare, custom server)

### How to Update This File

1. **Read the current file first** (you're already here).
2. Make targeted edits — don't rewrite sections unnecessarily.
3. Keep the "verified by filesystem scan" date current.
4. Keep the Socket Event Contract in sync with `shared/actions.ts`.

---

## Quick Reference

| Task | Location |
|------|----------|
| Add socket event | 1. `shared/actions.ts` 2. `codesync-server/src/validation.ts` 3. `codesync-server/src/socket.ts` 4. `src/hooks/useSocket.ts` |
| Add editor operation | 1. `shared/editor.ts` 2. `shared/actions.ts` 3. `roomManager.ts` 4. `useEditor.ts` |
| Change CORS origins | `CORS_ORIGIN` env var (comma-separated) |
| Set owner secret | `CODESYNC_OWNER_SECRET` env var (32-byte hex) |
| Debug socket events | Browser DevTools → Network → WS → Frames |
| View room state | `roomManager.rooms` (Map) in backend console |
| Run type check | `npm run type-check` (both workspaces) |

---

*This is a living document. Update it when the project's architecture, commands, or conventions change materially. Do not add changelog entries or authorship metadata here.*