# CodeSync — Real-time collaborative code editor

## TL;DR

**Purpose**: Browser-based collaborative code editor with live sync via Socket.IO, themeable UI, and PWA support.

**Top 3 commands**:
```bash
bun install                  # install deps
bun run dev:front            # start Vite dev server (frontend only)
bun run server               # start Express + Socket.IO backend (port 3000)
```

**Owner**: sachinthapa572 · **Repo**: `sachinthapa572/CodeSync` · **Branch**: `ts-conversion`

---

## Quick Start

```bash
# Install
bun install

# Frontend dev server (Vite, default :5173)
bun run dev:front

# Backend server (Express + Socket.IO, :3000)
bun run server

# Build (frontend SSG + backend compile)
bun run build

# Build frontend only (SSG)
bun run build:frontend

# Build backend only (tsc → dist/)
bun run build:backend

# Production start (build + serve)
bun run dev

# Type-check
bun run type-check

# Lint
bun run lint

# Format
bun run format
```

**Env vars**: Copy `.env.example` → `.env`. Key vars:
| Variable | Default | Purpose |
|---|---|---|
| `VITE_BACKEND_API_URL` | `http://localhost:3000` | Frontend → backend URL |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origins (comma-separated, `*` for all) |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (React SPA / PWA)                  │
│  ┌──────────┐  ┌────────────┐  ┌─────────┐ │
│  │ HomePage  │  │ EditorPage │  │ Themes  │ │
│  └────┬─────┘  └─────┬──────┘  └────┬────┘ │
│       │               │              │      │
│       │        Socket.IO client      │      │
│       └───────────┬──────────────────┘      │
└───────────────────┼─────────────────────────┘
                    │ WebSocket (port 3000)
┌───────────────────┼─────────────────────────┐
│  Express Server   │                         │
│  ┌────────────────┴───────────┐             │
│  │  Socket.IO (rooms, sync)   │             │
│  ├────────────────────────────┤             │
│  │  REST: /api/health, /info  │             │
│  ├────────────────────────────┤             │
│  │  Static file serving (dist)│             │
│  └────────────────────────────┘             │
└─────────────────────────────────────────────┘
```

**Flow**: User enters room ID + username → health check → Socket.IO connect → `JOIN` event → server broadcasts to room → CodeMirror syncs code via `CODE_CHANGE` events.

---

## Key Paths

| Path | Purpose |
|---|---|
| `server.ts` | Express + Socket.IO backend, CORS, room management |
| `shared/actions.ts` | **Single source of truth** for Socket.IO event constants (DRY) |
| `codesync-server/src/actions.ts` | Re-exports from `shared/actions.ts` for server convenience |
| `src/utils/constants.ts` | Re-exports ACTIONS from `shared/actions.ts` + `BACKEND_API_URL` |
| `src/utils/socket.ts` | Socket.IO client initialization |
| `src/utils/healthCheck.ts` | Server health check before socket connect |
| `src/utils/swDetection.ts` | Service worker cache detection utilities |
| `src/pages/HomePageModern/` | Landing page — room creation/join |
| `src/pages/EditorPageModern/` | Main editor page — toolbar, participants, CodeMirror |
| `src/components/AppShell.tsx` | Shared layout shell (header + theme provider) |
| `src/components/Editor.tsx` | CodeMirror editor integration |
| `src/components/EditorWrapper.tsx` | Lazy-loaded CodeMirror with loading state |
| `src/components/ClientModern.tsx` | Participant avatar component |
| `src/components/ThemeSwitcher.tsx` | Theme selection toggle |
| `src/components/ui/` | shadcn/ui primitives (button, card, input, select) |
| `src/theme/ThemeProvider.tsx` | React context for theme state |
| `src/theme/themes.ts` | Theme registry, token types, `applyTheme()` |
| `src/theme/presets/` | Theme preset files (drop-in, auto-registered via Vite glob) |
| `src/lib/utils.ts` | `cn()` utility (clsx + tailwind-merge) |
| `vite.config.ts` | Vite config with React, Tailwind CSS v4, PWA plugins |
| `biome.jsonc` | Biome linter/formatter config (extends ultracite) |
| `components.json` | shadcn/ui config (new-york style, neutral base) |
| `vercel.json` | Vercel deployment rewrites |

---

## Core Modules & Responsibilities

### Socket Events (`shared/actions.ts` — Single Source of Truth)
Both server and frontend import from `shared/actions.ts`. Do NOT duplicate.
```typescript
const ACTIONS = {
  JOIN: "join",           // Client → Server: join room
  JOINED: "joined",       // Server → Client: room state + participants
  CODE_CHANGE: "code-change",  // Bidirectional: code sync
  SYNC_CODE: "sync-code",     // Server → specific client: initial sync
  SET_CURRENT_EDITOR: "set_current_editor",  // Track active editor
  GRANT_EDIT: "grant-edit",   // Room creator grants edit access
  REVOKE_EDIT: "revoke-edit", // Room creator revokes edit access
  DUPLICATE_USER: "duplicate-user",  // Reject duplicate usernames
  DISCONNECTED: "disconnected",     // User left notification
  // ...see shared/actions.ts for full list
} as const;
```

### Theme System (`src/theme/`)
- **ThemeProvider**: React context managing active theme + mode (light/dark).
- **themes.ts**: Loads preset files via `import.meta.glob("./presets/*.ts")`. Themes define OKLCH/HSL CSS custom properties for `light` and `dark` modes.
- **Adding a theme**: Create `src/theme/presets/MyTheme.ts` exporting `default: ModernTheme`. Auto-registered.

### Editor (`src/components/Editor.tsx` + `EditorWrapper.tsx`)
- CodeMirror 6 via `@uiw/react-codemirror` with JavaScript language support.
- `EditorWrapper` lazy-loads the editor with `React.lazy` + `Suspense`.
- Editor styling uses CSS variables from the active theme (not hardcoded colors).

### Server (`server.ts`)
- Express serves static `dist/` in production with SPA catch-all.
- Socket.IO manages rooms: `userSocketMap` (socketId → username), `roomCreatorMap` (roomId → creator).
- CORS: explicit origin list + regex wildcard for any localhost port in dev mode.
- Room cleanup: delayed 500ms after last user disconnects.

---

## Message / API Protocols

### Socket.IO Events

**JOIN** (client → server):
```json
{ "roomId": "abc-123", "userName": "alice" }
```

**JOINED** (server → all clients in room):
```json
{
  "clients": [{ "socketId": "...", "username": "alice" }],
  "username": "alice",
  "socketId": "...",
  "roomcreator": "alice"
}
```

**CODE_CHANGE** (bidirectional):
```json
{ "roomId": "abc-123", "code": "console.log('hi')", "currenteditor": "alice" }
```

### REST Endpoints

| Method | Route | Response |
|---|---|---|
| GET | `/api/health` | `{ status: "ok", message, timestamp }` |
| GET | `/api/info` | `{ name, version, status, timestamp }` |

---

## Code Style & Conventions

- **Language**: TypeScript strict mode (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- **Linter/Formatter**: Biome (extends `ultracite`). Run `bun run lint` / `bun run format`.
- **Indent**: 2 spaces, LF line endings, 80-char line width.
- **Imports**: Use `@/*` path alias for `src/*`. Prefer named exports for components.
- **Naming**: PascalCase for components/types, camelCase for functions/variables, UPPER_SNAKE for constants.
- **Styling**: Tailwind CSS v4 with CSS custom properties. Use theme tokens (`bg-primary`, `text-foreground`) — never hardcode hex colors. Prefer `cn()` from `@/lib/utils` for conditional classes.
- **UI Components**: shadcn/ui (new-york style). Primitives live in `src/components/ui/`. Use `cursor-pointer` on interactive elements.
- **Functions**: Keep under ~50 lines. Extract into separate modules when longer.
- **No unused imports/variables**: Enforced as errors by Biome.

---

## Configuration & Feature Flags

| Config File | Purpose |
|---|---|
| `.env` / `.env.example` | Runtime env vars (`VITE_BACKEND_API_URL`, `CORS_ORIGIN`) |
| `biome.jsonc` | Linter + formatter rules (extends ultracite) |
| `tsconfig.json` | TypeScript strict config with path aliases |
| `tsconfig.prod.json` | Production TS config (if different) |
| `components.json` | shadcn/ui component generator config |
| `vite.config.ts` | Vite plugins (React, Tailwind v4, PWA) |
| `vercel.json` | Vercel deployment routing |

**Feature toggles**: Currently none. When adding, use env vars prefixed with `VITE_FEATURE_` for frontend flags, or server-side env vars for backend flags.

---

## Testing Strategy

**Current state**: No test framework is configured yet.

**Recommended setup**:
```bash
bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom
```

**Priority test targets** (when adding tests):
1. **Socket event handling** — `server.ts` room join/leave/duplicate logic.
2. **Health check** — `healthCheck.ts` success/timeout/failure paths.
3. **Theme system** — `applyTheme()` sets correct CSS variables, preset loading.
4. **Action constants** — `shared/actions.ts` is the single source; server/frontend re-export.
5. **CORS logic** — `corsOrigin()` allows/blocks correct origins.

**Key commands** (once configured):
```bash
bun run test            # run all tests
bun run test --watch    # watch mode
bun run test --coverage # with coverage
```

---

## Troubleshooting — Top 8 Problems & Fixes

| # | Problem | Fix |
|---|---|---|
| 1 | CORS errors in browser | Check `CORS_ORIGIN` in `.env`. In dev, any localhost port is auto-allowed. In production, add your frontend URL. |
| 2 | Socket won't connect | Ensure backend is running (`bun run server`). Check `VITE_BACKEND_API_URL` matches the actual server port. |
| 3 | Vite port conflict | Vite auto-increments port (5173 → 5174). Dev CORS allows any localhost port. |
| 4 | Stale service worker | Hard refresh (`Ctrl+Shift+R`) or clear site data. Check `swDetection.ts` utilities. |
| 5 | Theme not applying | Verify preset file exports `default: ModernTheme` with `name`, `modes.light`, `modes.dark`, `defaultMode`. |
| 6 | Build fails (SSG) | Run `bun run build:frontend` — uses `vite-react-ssg`. Check for server-only code in components. |
| 7 | Type errors | Run `bun run type-check`. Strict mode is on — fix `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` issues. |
| 8 | Duplicate user rejected | Server rejects same username in same room. Use a different username or refresh. |

---

## Adding New Features — Step-by-Step

1. **Create feature folder**: `src/features/<name>/` or extend existing page/component.
2. **Add components**: Keep in `src/components/` or co-locate in the feature folder. Export via barrel `index.ts`.
3. **Socket events**: Add new action to `shared/actions.ts` ONLY. Both server and frontend import from there — no duplication needed. Handle on both client and server.
4. **Styling**: Use Tailwind + theme CSS variables. No hardcoded colors. Use `cn()` for conditional classes.
5. **Environment config**: Add new env vars to both `.env.example` and document in this file's Configuration section.
6. **Feature flag** (if applicable): Gate behind `VITE_FEATURE_<NAME>` env var.
7. **Type safety**: Export types from a shared types file. TypeScript strict mode must pass.
8. **Test**: Add tests for service/business logic. Mock Socket.IO and external I/O.
9. **Lint/format**: Run `bun run lint && bun run type-check` before committing.

---

## Maintenance Guidelines

Update this file (`AGENTS.md`) when:
- Adding/removing a **build command** or changing the package manager.
- Changing **architecture** (new service, new server, monorepo split).
- Adding/changing **env vars** or config file schemas.
- Adding/changing **Socket.IO events** or REST API endpoints.
- Changing **deployment** targets or CI pipelines.

---

## Self-Update Policy

- Update `AGENTS.md` only for **significant** changes: architecture/service-boundary changes; package manager or CI/build command changes; config or feature flag schema changes; public API or persistence schema changes.
- Do **not** update for small bug fixes, cosmetic refactors, or private non-behavior edits unless they change a verbatim instruction/command in this file.
- When updating, **improve and merge** into existing content — do not replace human-written guidance without documented justification in the PR.
- Do not include changelog entries or who/when metadata inside AGENTS.md.

---

## SWE Best Practices

# !!BEST SWE PRACTICES FOR AI TO FOLLOW WHEN WORKING ON ANY PROJECT!!

## Model Context Protocol (MCP)
As an AI coding agent, you may have access to external tools via the Model Context Protocol (MCP). Use external tools only when they directly improve accuracy, verification, or understanding of a task—prioritizing efficiency, safety, and relevance. User instructions take precedence.

## Code Style
- Favor strict, type-safe code when the language supports it (TS `strict` mode, typed Python, Rust, etc.).
- Use functional patterns (pure functions, immutability) where appropriate.
- Atomic modules: limit functions/modules to ~50 lines. Refactor when longer.

## Identity & Mantra
You are an industrial-grade Software Architect & Systems Engineer. Code must be production-quality, maintainable, and scalable.
**Mantra**: "Change ONCE — reflect EVERYWHERE."

## Architectural Standards (Layered Law)
Enforce a layered architecture with at least two abstraction layers between major components:
1. Presentation / Trigger (UI, CLI, Cron) — dumb wrappers.
2. Controller / Orchestrator — validate & route.
3. Service Layer (business logic) — single source of truth for rules/transactions.
4. Repository / Adapter — I/O, DB, API calls.
5. Infrastructure / Config — env and connection settings.

### Dependency Rule
- Inner layers must not depend on outer layers. Use dependency injection; do not instantiate externals inside services.

## Core Development Rules
- Centralize constants/config in `/config`.
- No hardcoded values (strings, URLs, timeouts).
- Wrap common patterns (retry, logging, try/catch) in utilities.

## Performance & Resilience
- Async-first I/O.
- Timeouts (default ≤ 5s), retries with exponential backoff, circuit-breakers for critical external calls.
- Null-safety: guard inputs aggressively.

## Customizability & Feature Flags
- Assume tomorrow everything changes. Put changes behind feature flags.
- Use adapter pattern for external systems.

## Folder Structure (Feature-based)
- Organize by feature. Each feature folder must export via an `index` barrel file.

## Tooling Standards
- Prefer Bun when present; then pnpm; then npm. Use language-native tooling (cargo, go, pipenv) per project.
- TypeScript strict mode recommended for JS projects.

## Testing
- Focus tests on Service Layer. Use TDD for critical logic.
- Tests must be fast and deterministic (mock external IO).

## Mandatory Checklist (developer & agent)
Before any commit:
- Everything configurable? (no hardcoding)
- ≥2 abstraction layers between producer and consumer
- Dependencies injected
- External calls have timeouts & retries
- Business logic isolated in Service layer
- Changing a feature should touch ≤3 files (architecture permitting)

## Ultimate Rule
If a change requires many manual edits, refactor until change is localized.

---

## Editor & IDE Rules

- Do not modify `.editorconfig`, `.vscode/*`, `idea/*`, or other IDE workspace settings except when absolutely necessary. Editor files are personal and noisy — changes must be proposed in PR with justification and marked OPTIONAL.
- If format/lint rules must change, prefer adding or updating a centralized formatter config (`biome.jsonc`, `tsconfig`) and a `pre-commit` hook rather than changing individual devs' IDE settings.
- Agents should respect repo formatter settings. If running formatters, do so via CLI commands (e.g., `bun run format`), not by pushing IDE-specific settings.
- If you must change editor settings, add a clear PR section titled "Editor settings change — rationale & rollback" and make the change opt-in.

---

## Commit & PR Rules

- Commit message for AGENTS.md edits: `AGENTS.md: <short summary>`
- PR title: `docs(agents): update AGENTS.md — <short summary>`
- PR body must include:
  - Brief justification of AGENTS.md edits (1–3 lines)
  - Quality checklist results (see below)
  - Commands run & key test outputs
- PRs should be small, focused, and reversible.

### Quality Checklist

- [ ] All required sections present
- [ ] ≥3 runnable command examples (Bun)
- [ ] Self-Update Policy present
- [ ] SWE Best Practices copied
- [ ] Editor rules present

---

## How to Continue — Next Steps

1. Add Vitest + testing-library setup
2. Add CI pipeline (GitHub Actions)
3. Extract socket event handlers to service layer
4. Add room persistence (Redis/DB)
5. Add multi-file/tab editor support
6. Add syntax highlighting for more languages
7. Add user authentication layer
8. Add E2E tests (Playwright)

---

*This is a living document. Update it when the project's architecture, commands, or conventions change materially. Do not add changelog entries or authorship metadata here.*
