# Contributing to CodeSync

Thank you for your interest in contributing! This document outlines how to get started and what to expect.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+) — required for both frontend and server
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/sachinthapa572/CodeSync.git
cd CodeSync

# Install frontend dependencies
bun install

# Install server dependencies
cd codesync-server && bun install && cd ..

# Start backend (Terminal 1)
cd codesync-server && bun run dev

# Start frontend (Terminal 2)
bun run dev
```

Open http://localhost:5173 in your browser.

## Project Architecture

CodeSync has two packages:

```
codesync/                  # Monorepo root
├── src/                   # React frontend (Vite + SSG)
│   ├── pages/             # Route pages (HomePageModern, EditorPageModern)
│   ├── components/        # UI components + shadcn/ui primitives
│   ├── theme/             # Theme system (presets, provider)
│   ├── utils/             # Socket client, health check, constants
│   └── lib/               # Shared utilities
├── codesync-server/       # Hono backend on Bun
│   └── src/
│       ├── index.ts       # Server bootstrap, CORS, health endpoints
│       ├── socket.ts      # Socket.IO room/permission/tab logic
│       ├── validation.ts  # Pure validation & permission functions
│       └── __tests__/     # Server tests
├── biome.jsonc            # Linter/formatter config (ultracite)
└── vite.config.ts         # Vite + PWA + SSG config
```

## Coding Standards

- **Language**: TypeScript strict mode (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`)
- **Linter/Formatter**: Biome (extends `ultracite`)
- **Package Manager**: Bun (no npm/yarn)
- **Indent**: 2 spaces, LF line endings, 80-char line width
- **Imports**: Use `@/*` path alias for `src/*`
- **Naming**: PascalCase for components/types, camelCase for functions/variables, UPPER_SNAKE for constants
- **Styling**: Tailwind CSS v4 with CSS custom properties — never hardcode hex colors
- **UI Components**: shadcn/ui (new-york style). Add new ones via `bunx shadcn@latest add <name>`

## Testing

```bash
# Run server tests
cd codesync-server && bun test

# Type-check frontend
bun run type-check

# Lint frontend
bun run check
```

Server tests live in `codesync-server/src/__tests__/` and use Bun's built-in test runner.

## Socket.IO Protocol

When adding new socket events:

1. Add the action constant to `codesync-server/src/actions.ts`
2. Mirror it in `src/utils/constants.ts` (frontend)
3. Implement server-side handler in `codesync-server/src/socket.ts`
4. Update the README Socket.IO Protocol table
5. Add tests for any new validation/permission logic

## Permission Model

- **Creator**: Gets `OWNER_PERMISSIONS` (full control)
- **Default**: Gets `DEFAULT_PERMISSIONS` (view-only)
- **Granular**: Owner can grant specific permissions via `PERMISSIONS_UPDATE`
- **Validation**: All permission logic is in `codesync-server/src/validation.ts` — add tests when modifying

## CORS Configuration

CORS is enforced at two layers (both must stay in sync):
1. Hono CORS middleware in `codesync-server/src/index.ts`
2. Socket.IO CORS config in `codesync-server/src/socket.ts`

The shared `isAllowedOrigin` function ensures consistency.

## Deployment

- **Frontend**: Deploy to Vercel (static SSG output in `dist/`)
- **Backend**: Deploy to any Bun-compatible host (Render, Railway, Fly.io)
- Set `CORS_ORIGIN` to your frontend URL (never `*` in production)
- Set `VITE_BACKEND_API_URL` to your backend URL

## Pull Request Guidelines

1. Create a feature branch: `feature/<short-description>`
2. Run `bun run check` and `bun run type-check` before submitting
3. Add tests for any new server-side logic
4. Update docs (README, KNOWLEDGE.md) if your change affects architecture or setup
5. Keep changes focused — one concern per PR
6. Ensure changes touch ≤3 files for simple features; refactor if spread is larger

## Code Review Focus

- **Security**: CORS bypass, permission escalation, input validation
- **Race conditions**: Socket.IO events are async — consider concurrent state mutations
- **Performance**: Rooms are in-memory — avoid O(n) lookups in hot paths
- **Type safety**: No `any` unless absolutely necessary (and document why)

---

*Last updated: 2026-06-27*
