# CodeSync Security Guide

## Overview

CodeSync is a real-time collaborative code editor with a React frontend and Hono/Bun backend using Socket.IO. This document covers security considerations.

## Secrets

| Secret | Purpose | How to Set |
|--------|---------|------------|
| `VITE_BACKEND_API_URL` | Frontend → backend URL | `.env` (dev only) |
| `CORS_ORIGIN` | Allowed CORS origins | `codesync-server/.env` comma-separated |

**Never commit real `.env` values to git.** Use `.env.example` for documentation.

## Known Issues

### 🟡 CORS_ORIGIN=* in .env

The committed `.env` has `CORS_ORIGIN=*` which allows all origins. This is fine for local dev only.

**Fix for production:** Set explicit origins in `codesync-server/.env`:
```
CORS_ORIGIN=https://your-frontend.vercel.app
```

### 🟡 No Rate Limiting on Socket.IO

The WebSocket server has no connection rate limiting. An attacker could flood connections.

**Fix:** Add a connection rate limiter middleware in `codesync-server/src/socket.ts`.

### 🟡 No Authentication on Rooms

Anyone with a room ID can join. There's no room-level auth beyond the creator flag.

**Consider:** Adding optional room passwords for sensitive collaborations.

### 🟡 Code Content Not Sanitized

Code shared in rooms is rendered in CodeMirror. While CodeMirror doesn't execute code, be cautious about:
- Exfiltration via `fetch()` code patterns in shared snippets
- XSS through CodeMirror plugin rendering

## Security Checklist for Production

- [ ] Set `CORS_ORIGIN` to explicit frontend URL
- [ ] Add Socket.IO connection rate limiting
- [ ] Add HTTPS redirect
- [ ] Set `NODE_ENV=production`
- [ ] Add Content-Security-Policy headers
- [ ] Consider room-level auth for sensitive use cases

---

*Last updated: 2026-06-26 — Updated to reflect Hono migration*
