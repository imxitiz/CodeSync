# CodeSync

CodeSync is a real-time collaborative code editor that allows multiple users to work together on code simultaneously. Built with React + Hono + Socket.IO, it provides a seamless experience for code collaboration, making it to share code and ideas in real-time.

## Features

- **Real-time Collaboration**: Edit code together with others in real-time.
- **Multi-Tab Editing**: Create, close, rename, and switch between code tabs.
- **Room Management**: Create or join rooms with unique Room IDs.
- **Editable Control**: The room creator can assign or revoke editing privileges.
- **Themeable UI**: Multiple themes via CSS custom properties (light/dark).
- **PWA Support**: Installable as a Progressive Web App.
- **User Authentication**: Users can join with unique usernames.
- **Copy Room ID and Code**: Easily share the Room ID and copy code snippets.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript | `react@^18.3.1` |
| Build Tool | Vite + vite-react-ssg | `vite@^5.4.10` |
| Styling | Tailwind CSS v4 | `tailwindcss@^4.1.13` |
| UI Components | shadcn/ui + Radix | — |
| Code Editor | CodeMirror 6 | `@uiw/react-codemirror` |
| Backend | Hono | `hono@^4.6.3` |
| Runtime | Bun | — |
| Real-time | Socket.IO | `socket.io@^4.8.1` |
| Linter/Formatter | Biome (ultracite) | — |

## Project Structure

```
codesync/
├── src/                    # Frontend source (React SPA)
│   ├── pages/              # HomePageModern, EditorPageModern
│   ├── components/         # Editor, ThemeSwitcher, AppShell, UI primitives
│   ├── theme/              # Theme system (presets, provider)
│   ├── utils/              # Socket client, health check, constants
│   └── lib/                # Shared utilities (cn)
├── codesync-server/        # Backend server
│   └── src/
│       ├── index.ts        # Hono app + CORS + health endpoints
│       ├── socket.ts       # Socket.IO room/permission/tab management
│       └── actions.ts      # Shared action constants
├── scripts/                # Build scripts (theme downloader)
├── biome.jsonc             # Biome linter/formatter config
├── vercel.json             # Vercel SPA rewrite
└── package.json            # Frontend deps & scripts
```

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- Node.js 18+ (alternative)

### Installation

```bash
# Install frontend dependencies
bun install

# Install server dependencies
cd codesync-server && bun install && cd ..
```

### Development

```bash
# Terminal 1: Start the backend server (Hono on :3000)
cd codesync-server && bun run dev

# Terminal 2: Start the frontend (Vite on :5173)
bun run dev
```

Open http://localhost:5173 in your browser.

### Environment Variables

Create `.env` in the project root:

```env
# Frontend → Backend URL
VITE_BACKEND_API_URL=http://localhost:3000
```

Create `.env` in `codesync-server/`:

```env
PORT=3000
# CORS origins (comma-separated, or * for all — dev only)
CORS_ORIGIN=http://localhost:5173
```

### Build for Production

```bash
# Build frontend (SSG → dist/)
bun run build

# Type-check
bun run type-check

# Lint
bun run check
```

## Deployment

### Frontend (Vercel)

1. Set `VITE_BACKEND_API_URL` to your backend URL (e.g., `https://your-server.onrender.com`)
2. Deploy the `dist/` folder — `vercel.json` handles SPA routing

### Backend (Render/Railway/Fly.io)

1. Set environment variables:
   - `CORS_ORIGIN`: Your frontend URL
   - `PORT`: Server port (default: 3000)
2. Run: `cd codesync-server && bun run start`

### API Endpoints

| Method | Route | Response |
|--------|-------|----------|
| GET | `/api/health` | `{ status, message, timestamp }` |
| GET | `/api/info` | `{ name, version, runtime, status, timestamp }` |
| WS | Socket.IO | Real-time collaboration events |

## Socket.IO Protocol

| Event | Direction | Description |
|-------|-----------|-------------|
| `join` | Client → Server | Join a room |
| `joined` | Server → All | Room state + participants |
| `code-change` | Bidirectional | Code sync |
| `sync-code` | Server → Client | Initial code sync |
| `set_current_editor` | Bidirectional | Track active editor |
| `grant-edit` / `revoke-edit` | Owner → User | Permission management |
| `tab-create` / `tab-close` / `tab-rename` | Bidirectional | Tab management |
| `disconnected` | Server → All | User left |

## Health Check & Server Wake-up

The application includes automatic server wake-up functionality:

- **Health Check**: Frontend checks server health before connecting
- **Auto Wake-up**: Server is pinged when user focuses on input fields
- **Retry Logic**: Automatic retry with user feedback during connection
- **Smooth UX**: Users can enter details while server wakes up

## License

MIT

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding standards, and PR guidelines.
