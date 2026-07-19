# Socket.IO Rate Limiting & Idempotency — Research Findings

**Date:** 2026-07-01  
**Focus:** Rate limiting for auth/permission events, user-level vs connection-level limits, idempotent patterns for real-time permission systems  
**Sources:** Socket.IO docs, WebSocket security guides (2025–2026), Redis rate limiting docs, production hardening guides

---

## 1. Socket.IO Rate Limiting Patterns for Authentication/Authorization Events

### Core Principle
Authentication/authorization events must be rate-limited separately from general events because:
- They are high-value targets (brute-force, token stuffing, privilege escalation)
- A compromised session can abuse these events even if general message rate is limited
- Auth events are fewer in number but higher in risk

### Pattern 1: Per-Socket Middleware Rate Limiter
Socket.IO provides `socket.use()` as a per-socket middleware that intercepts every outgoing event before it reaches the handler.

```typescript
// Server-side: per-socket token bucket
io.on("connection", (socket) => {
  socket.use((_packet, next) => {
    if (!limiter.consume(socket.id)) {
      return next(new Error("rate-limit"));
    }
    next();
  });

  socket.on("error", (err) => {
    if (err.message === "rate-limit") {
      socket.emit("rate:limited", { retryAfter: 1000 });
    }
  });
});
```

**Recommendation:** Apply a stricter token bucket on auth-related events (e.g., `token:refresh`, `permission:update`, `user:role:change`). A compromised session that's already authenticated cannot brute-force from inside an open socket.

### Pattern 2: Connection-Level vs Message-Level (Layered Defense)
HTTP-level rate limiters (nginx, Express middleware) catch the long-polling handshake but **NOT** WebSocket frames. WebSocket requires application-layer message rate limiting.

| Layer | Tool | Protects Against | Covers |
|---|---|---|---|
| L1: Network | nginx `limit_conn`, Cloudflare | Connection floods | IP-level connection limits |
| L2: Handshake | `io.use()` middleware | Unauthorized connections | Token validation, per-connection auth |
| L3: Message | `socket.use()` | Message flooding | Per-socket message rate |
| L4: Event-type | Handler-level checks | Specific abuse vectors | Auth/permission event rate limits |

### Pattern 3: Event-Type Specific Rate Limits
Not all events are equal. Rate limits should vary by event criticality:

```typescript
const RATE_LIMITS = {
  "token:refresh": { capacity: 5, refillPerSec: 1 },      // Strict — auth abuse
  "permission:update": { capacity: 10, refillPerSec: 2 }, // Moderate — privilege escalation
  "room:join": { capacity: 10, refillPerSec: 5 },         // Looser — legitimate reconnects
  "cursor:move": { capacity: 60, refillPerSec: 30 },      // Very loose — UI must work
};
```

### Pattern 4: Distributed (Redis-Backed) Rate Limiting for Multi-Instance
In-memory rate limiters fail horizontally. Use Redis for atomic, shared state.

**Redis Token Bucket (Lua script for atomicity):**
```typescript
const result = await redis.eval(
  `local key = KEYS[1]
   local capacity = tonumber(ARGV[1])
   local refill_rate = tonumber(ARGV[2])
   local now = tonumber(ARGV[3])
   
   local data = redis.call('HMGET', key, 'tokens', 'last_refill')
   local tokens = tonumber(data[1]) or capacity
   local last_refill = tonumber(data[2]) or now
   
   local elapsed = now - last_refill
   tokens = math.min(capacity, tokens + elapsed * refill_rate)
   
   if tokens < 1 then
     return 0
   end
   tokens = tokens - 1
   redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
   redis.call('EXPIRE', key, 60)
   return 1`,
  1,
  `rate:${key}`,
  capacity,
  refillPerSec,
  Date.now() / 1000
);
```

**Key Redis patterns:**
- Per-user: `rate:user:{userId}:{eventType}`
- Per-connection: `rate:socket:{socketId}`
- Global: `rate:global:events`
- Use `EVALSHA` after first load for lower latency

### Pattern 5: Graceful Degradation & UX
Rate limiting must never silently drop legitimate auth events.

| Event Category | Approach | User Feedback |
|---|---|---|
| Auth token refresh | Strict limit + explicit error | Show "Too many attempts, try again in Xs" |
| Permission change | Moderate limit + retry queue | Notify backoff, preserve intent |
| Cursor movement | Very loose OR volatile events | Skip feedback — UI handles naturally |

Use `next(new Error("rate-limit"))` which triggers `connect_error` on client. For `socket.use()`, the event is not processed but the client knows why.

---

## 2. User-Level vs Connection-Level Rate Limiting for Collaborative Apps

### The Single-Socket Anti-Pattern
A per-connection rate limit alone is trivially bypassed: a malicious user opens 100 sockets, each with its own limit, to aggregate 100x traffic.

### Pattern: Dual-Limit Enforcement
Enforce **both** per-connection AND per-user (or per-IP) limits:

```typescript
// Per-connection: applied via socket.use()
socket.use((packet, next) => {
  if (!connectionLimiter.consume(socket.id)) {
    return next(new Error("rate-limit:connection"));
  }
  // Also aggregate to user-level counter in Redis
  userLimiter.consume(socket.userId);
  next();
});
```

### Pattern: Connection Ceiling Per User (Slot Exhaustion Protection)
Limit concurrent connections per user to prevent token exhaustion (file descriptors, memory).

```typescript
const MAX_CONNECTIONS_PER_USER = 5;  // 3–5 for most apps

io.use(async (socket, next) => {
  const userId = socket.data.userId;
  const connectionKey = `connections:${userId}`;
  
  const count = await redis.sCard(connectionKey);
  if (count >= MAX_CONNECTIONS_PER_USER) {
    return next(new Error("Too many connections"));
  }
  
  await redis.sAdd(connectionKey, socket.id);
  await redis.expire(connectionKey, 1800); // 30min TTL
  
  socket.on("disconnect", async () => {
    await redis.sRem(connectionKey, socket.id);
  });
  
  next();
});
```

**Why 3–5?** Covers multiple tabs, mobile + desktop, but kills abuse. Authenticated users need far fewer than unauthenticated ones.

### Collaborative App Considerations

| Concern | Connection-Level | User-Level | Recommendation |
|---|---|---|---|
| Multi-tab editing | Each tab = separate socket | Same userId | User-level aggregation catches multi-tab abuse |
| Mobile + desktop | Separate sockets | Same userId | Connection ceiling + user aggregate |
| Room storming | Hard to detect per-socket | Visible in aggregate | Track unique rooms per user per minute |
| Reconnection loops | Visible per-socket | Visible per-user | Disconnect oldest socket when limit exceeded |

### Pattern: Aggregate User-Level Enforcement via Redis Set
```typescript
// Track ALL sockets per user, enforce globally
const userConnectionKey = `user:connections:${userId}`;
const currentCount = await redis.sCard(userConnectionKey);

if (currentCount >= MAX_PER_USER) {
  // Option A: Close oldest
  const oldest = await redis.lRange(`${userConnectionKey}:ordered`, 0, 0);
  io.to(oldest).disconnect(true);
  // Option B: Reject new with clear error
  return next(new Error("Connection limit reached. Close another tab."));
}
```

### Performance Implications

| Approach | Memory (server) | Redis Load | Precision | Abuse Protection |
|---|---|---|---|---|
| In-memory connection map | Low (single node) | None | Exact | No — not shared |
| Redis Set per user | Minimal | Low | Exact | Yes — multi-instance |
| Redis Sorted Set + TTL | Low | Medium | Exact | Yes — auto-cleanup |
| No user-level limit | N/A | N/A | N/A | Weak — multi-socket bypass |

---

## 3. Idempotent Request Patterns for Real-Time Permission Systems

### The Problem
Socket.IO preserves event ordering but arrival is **at-most-once by default**. Reconnection triggers retries, and duplicate delivery is possible at the application level:
- Client emits `permission:grant`, connection drops before ack
- Client retries on reconnect — same permission granted twice
- Server broadcasts `user:role:updated`, client processes twice
- Optimistic local UI updates compound with server echoes

### Pattern 1: Client-Generated Idempotency Keys
Every state-changing event carries a stable request ID generated client-side.

```typescript
// Client-side
const requestId = crypto.randomUUID();  // or use monotonic counter per stream

socket.emit("permission:grant", {
  requestId,
  roomId: "project-abc",
  userId: "user-456",
  role: "editor",
  timestamp: Date.now()
}, (ack) => {
  if (ack.success) {
    // Confirm; client can now mark this requestId as processed
  }
});
```

### Pattern 2: Server-Side Deduplication Cache
Track recently-processed request IDs and discard duplicates.

```typescript
const processedRequests = new Set<string>();
// For multi-instance, use Redis with TTL
// redis.sAdd(`idempotency:${requestId}`, "1"); redis.expire(..., 300)

socket.on("permission:grant", async (data, ack) => {
  const cacheKey = `idempotency:${data.requestId}`;
  
  // Check if already processed
  const exists = await redis.exists(cacheKey);
  if (exists) {
    // Return cached result or simply ack with "already processed"
    return ack({ success: true, deduplicated: true });
  }
  
  // Mark as processing atomically
  const wasSet = await redis.set(cacheKey, "1", "EX", 300, "NX");
  if (!wasSet) {
    return ack({ success: true, deduplicated: true });
  }
  
  try {
    const result = await permissionService.grant(data.roomId, data.userId, data.role);
    ack({ success: true, permission: result });
  } catch (error) {
    await redis.del(cacheKey);  // Allow retry on server error
    ack({ success: false, error: error.message });
  }
});
```

**Key design:** Use `SET NX EX` (Redis set-if-not-exists with TTL) for atomic dedup. TTL of 5 minutes covers reconnect windows without growing unbounded.

### Pattern 3: Sequence Numbers for Missed-Event Recovery
For server-to-client permission state broadcasts, assign sequence numbers and allow clients to request missed events on reconnect.

```typescript
// Server: maintain sequence counter per room
let sequenceMap = new Map<string, number>();

socket.on("join:room", ({ roomId }) => {
  const lastSeq = sequenceMap.get(roomId) || 0;
  // Client can request events from lastSeq+1 on reconnect
  socket.emit("room:sync:start", { roomId, lastSequence: lastSeq });
});

// On permission change
function broadcastPermissionUpdate(roomId, update) {
  const seq = (sequenceMap.get(roomId) || 0) + 1;
  sequenceMap.set(roomId, seq);
  
  io.to(roomId).emit("permission:updated", {
    ...update,
    sequence: seq,
    timestamp: Date.now()
  });
}
```

**Client reconnect flow:**
1. Socket reconnects
2. Client sends `resync:request` with `{ roomId, lastSequence }`
3. Server replays missed events from buffer or returns current authoritative state

### Pattern 4: Optimistic Concurrency Control (Version Vectors)
For collaborative permission systems where multiple users can edit simultaneously:

```typescript
interface PermissionChange {
  requestId: string;
  baseVersion: number;      // Last known server version
  changes: PermissionDelta;
  actorId: string;
  timestamp: number;
}

// Server enforces: accept only if baseVersion matches current
socket.on("permission:apply", async (change) => {
  const currentVersion = await permissionStore.getVersion(change.roomId);
  
  if (change.baseVersion !== currentVersion) {
    // Conflict — reject and return current state
    return ack({
      success: false,
      conflict: true,
      currentVersion,
      currentState: await permissionStore.getState(change.roomId)
    });
  }
  
  // Atomically increment version and apply
  await permissionStore.applyWithVersion(change);
  ack({ success: true, newVersion: currentVersion + 1 });
});
```

### Pattern 5: Volatile vs Reliable Delivery
Not all permission events need the same durability guarantees:

| Event Type | Delivery Semantics | Pattern |
|---|---|---|
| `permission:grant` | Reliable + idempotent | Ack + dedup key |
| `permission:revoke` | Reliable + idempotent | Ack + dedup key |
| `cursor:position` | Volatile (fire-and-forget) | Latest wins, no dedup needed |
| `presence:update` | Volatile + deduplicated | LWW by timestamp, server is source of truth |
| `typing:indicator` | Volatile | No storage needed |

Use `socket.volatile.emit()` for ephemeral signals. Volatile events are dropped if the client is not ready; this prevents stale cursor positions from overwriting newer state after reconnect.

### Pattern 6: Idempotent Permission State Design
Design the permission model itself to be idempotent:
- `grant(editor, userX)` run twice is same as once
- `revoke(editor, userX)` run twice is same as once
- Adding the same permission twice does not create duplicates

**State-based broadcast (not action-based):**
```typescript
// Instead of broadcasting "user gained editor access"
// Broadcast current authoritative state of permissions
io.to(roomId).emit("permissions:sync", {
  permissions: currentPermissionMap,
  version: currentVersion,
  updatedBy: actorId
});
```

Client applies idempotently: `user.permissions = incoming.permissions` — no risk of duplicate entries.

---

## Key Recommendations Summary

### Security
1. **Layer rate limits**: Connection ceiling → per-user aggregate → per-event-type bucket
2. **Strict limits on auth events**: Token refresh, permission changes, role grants
3. **Idempotency keys on all state-changing Socket.IO events** that traverse reconnection paths
4. **Deduplicate server-side** using Redis `SET NX EX` — never trust client-side dedup alone
5. **Validate permissions in event handlers**, not just at connection (socket middleware runs once per connection)

### Performance
1. **Use Redis adapter** for multi-instance broadcasts — `io.to(room).emit()` at scale needs it
2. **Use rooms as routing, not permission boundaries** — check access before `socket.join()`, then broadcast is zero-DB-query
3. **Bucket algorithm over sliding window** for rate limiting — cheaper, cheaper on Redis
4. **Fail open on Redis unavailability** — rate limiter becomes SPOF if it hard-fails

### UX
1. **Graceful degradation**: Rate limit errors should tell the client when to retry
2. **Sequence-based resync**: On reconnect, replay missed state — client doesn't lose permissions context
3. **Volatile for ephemeral signals**: Cursor, typing, presence — use volatile to avoid reconnection noise
4. **Room-based state sync**: When in doubt, rejoin rooms and fetch current state — simpler than replaying every event
5. **No duplicate UI state**: Client state merges should be idempotent (`permissions[userId] = value`, not `push`)

### Implementation Priority (for CodeSync)
1. Add `io.use()` auth middleware validating tokens at handshake
2. Implement per-socket `socket.use()` rate limiter with token bucket
3. Add per-user connection ceiling (3-5) via Redis Set
4. Add idempotency keys to `permission:update` and `role:change` events
5. Add sequence numbers for permission state broadcasts
