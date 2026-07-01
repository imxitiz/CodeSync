# Findings

## 2026-06-27: Spoon-Feeding Anti-Pattern

### Problem
When delegating UX overhaul to 3 parallel agents, the orchestrator wrote extremely detailed prompts telling each agent exactly which files to edit, which functions to change, which CSS variables to use, and the specific implementation steps. This is micro-management, not orchestration.

### Root Cause
The orchestrator prompt had no explicit principle forbarding spoon-feeding. The instinct was to "be helpful" by providing complete instructions.

### Lesson
**Delegation = goal + spec + task file. NOT step-by-step implementation instructions.**

The correct pattern:
1. Create TODO.md with a marker table (who picks what)
2. Point to the spec file
3. Spawn agents
4. Agents read spec, break down work themselves, mark their own tasks
5. Orchestrator monitors TODO.md, reconciles conflicts, verifies result

**Self-check before every delegation:** "Did I tell them HOW to do the work, or just WHAT needs to be done?" If the former, delete half the prompt.

### Files Changed
- `~/agents/agents/orchestrator/AGENTS.md` — Added "Autonomy First — NO Spoon-Feeding" as principle #1, added "Delegation Style" section, added lesson to Self-Evolution Protocol

---

## 2026-06-27: Agent C — Tab Bar, Empty State, Connection Status

### Files Created
- `src/pages/EditorPageModern/EmptyState.tsx` — Centered overlay with FiCode icon, "Start typing to collaborate..." text, room context, fade-in animation. Shows only when `activeTab?.code === ""` && `tabs.length === 1`.
- `src/pages/EditorPageModern/ConnectionStatus.tsx` — Three-state animated indicator. Connecting: pulsing gray dot + "Connecting..." text. Connected: solid emerald-500 dot, no text (tooltip only). Disconnected: red-500 pulse + "Reconnecting in Ns..." countdown. Tooltip shows server URL. Mobile: dot only.

### Files Modified
- `src/pages/EditorPageModern/EditorPageModern.tsx`:
  - Tab bar: added `border-t-2 border-t-primary` for active tab colored top accent
  - Tab bar: added `shadow-sm` for active tab elevation
  - Tab bar: integrated `getFileIcon(tab.name)` for file-type icons
  - Tab bar: close button always visible on active tab, `group-hover` on inactive
  - Tab bar: added `✎` rename discovery icon on hover with "Double-click to rename" tooltip
  - Tab bar: added `ref` callback with `scrollIntoView({ inline: 'center', block: 'nearest' })` for auto-scroll
  - Tab bar: added `scrollbar-none` to container
  - Tab bar: added `aria-label` on close buttons
  - Editor canvas: added `<EmptyState>` overlay conditionally rendered when `activeTab?.code === ""` && `tabs.length === 1`
- `src/index.css`: added `--animate-fade-in` to `@theme inline` block with `@keyframes fadeIn` for empty state fade-in

### Decisions
- Used `animate-fade-in` (Tailwind v4 theme token) instead of `animate-[fadeIn_200ms...]` arbitrary value — cleaner integration
- `EmptyState` is conditionally rendered at the parent level (not internally) so CodeMirror still mounts underneath and receives keystrokes immediately
- `ConnectionStatus` component is standalone (not wired into TopBar which has its own StatusDot)
- Used `✎` (U+270E) for rename discovery icon per spec

### What Couldn't Be Done
- ConnectionStatus not wired into TopBar — the TopBar agent created their own StatusDot with similar functionality; would need coordination to consolidate

---

## 2026-06-27: UI Annoyances Fix (Actual Implementation)

### Problems Identified
1. **Hardcoded color `#000` in Avatar component** - `fgColor="#000"` in EditorPageModern.tsx
2. **Hardcoded Tailwind colors in ParticipantsDrawer** - `bg-emerald-400 text-emerald-950` for editor badge
3. **Hardcoded `text-white` in button destructive variant** - Should use `text-destructive-foreground`

### Files Fixed
1. `src/pages/EditorPageModern/EditorPageModern.tsx:562` - Changed `fgColor="#000"` to `fgColor="var(--foreground)"`
2. `src/pages/EditorPageModern/ParticipantsDrawer.tsx:151` - Changed editor badge from `bg-emerald-400 text-emerald-950` to `bg-success text-success-foreground`
3. `src/components/ui/button.tsx:14` - Changed destructive variant from `text-white` to `text-destructive-foreground`

### Already Fixed (per findings.md)
The following issues were already addressed in previous work:
- Wrap button text: `src/components/TopBar/TopBar.tsx:252` shows "Wrap:On"/"Wrap:Off"
- Theme presets: `shadow-color` values updated to use theme tokens
- Status dots and badges in TopBar and ClientModern components use theme tokens
- `--success` and `--warning` tokens added to `src/index.css`

### Verification
- All modified files pass Biome linting
- Type check passes

---

## 2026-06-27: Agent B — Participants Drawer + Shortcuts Panel

### Files Created
- `src/pages/EditorPageModern/ParticipantsDrawer.tsx` — Right-side slide-out drawer (fixed inset-y-0 right-0, w-72, translateX transition, 200ms). Header with count + close button. Participant list with avatar, username, active tab badge, editor badge, follow button, permissions gear. Inline permissions editor with Grant All / Revoke All. Footer with "Copy Invite Link" + "Done". Focus management: focuses close on open, restores on close. Escape to close. Backdrop dim (bg-background/50, no blur).
- `src/pages/EditorPageModern/ShortcutsPanel.tsx` — Centered modal (max-w-sm) with backdrop. Sections: General, Editor. Each row: action + `<kbd>` badges (bg-muted border rounded px-1.5 py-0.5 text-xs font-mono). Animation: scale 0.95→1 + fade, 150ms. Escape to close. Focus management.

### Files Modified
- `src/pages/EditorPageModern/EditorPageModern.tsx`:
  - Removed old inline participants modal (full-screen overlay with ClientModern cards)
  - Removed old `PermissionsEditor` function (moved into ParticipantsDrawer)
  - Added `showShortcuts`, `showOverflow` state
  - Added `?` key listener (skips when input focused, when drawer/panel open)
  - Wired `<ParticipantsDrawer>` and `<ShortcutsPanel>` at end of AppShell
  - Added overflow menu (`⋯` button) with Participants + Shortcuts triggers
  - Updated `copyRoomId` → `copyInviteLink` (full URL with origin)
  - Added `copied` state for checkmark feedback on room ID pill
  - Removed unused imports: `ClientModern`, `OWNER_PERMISSIONS`, `PERMISSION_KEYS`, `PERMISSION_LABELS`, `Button`

### Decisions
- ParticipantsDrawer uses inline permissions editor (not extracted to separate file) — keeps related UI together
- ShortcutsPanel is a separate component (not inline) — cleaner separation
- Overflow menu added to top bar for future extensibility (spec mentioned collapse to `⋯` on tablet)
- `copyInviteLink` name chosen over `copyRoomId` to clarify behavior (copies full URL, not just ID)

### Coordination Notes
- Agent A's TopBar component was referenced in the file but not yet integrated — the inline top bar is still present
- Agent C's EmptyState and ConnectionStatus components imported but not yet wired
- The overflow menu's "Zen mode" item is `sm:hidden` since Zen button is always visible on desktop

---

## 2026-06-29: Tab-Level Permissions — Architectural Research

### Context
CodeSync currently has a room-wide binary permission model (`UserPermissions` with `canEdit`, `canCreateTab`, `canDeleteTab`, `canRenameTab`). The room creator gets `OWNER_PERMISSIONS` (all true); everyone else gets `DEFAULT_PERMISSIONS` (all false). The owner can update any user's permissions via `PERMISSIONS_UPDATE`. The `currentEditor` system allows only one user at a time to hold the "active editor" role.

**Goal**: Extend to per-tab permission levels (OWNER / EDITOR / VIEWER / REQUESTED), with inheritance from room defaults and persistence across reconnects.

### Research Sources
- Codelit.io: "Collaborative Editing System Design" (2026) — Permission model patterns
- VS Code Live Share: Read-only session mode, per-terminal read/write control
- Google Docs: Owner / Editor / Commenter / Viewer hierarchy, Suggesting mode
- GitBook: Cascading permission inheritance (org → site → collection → space)
- Builder.io: ACL pattern with deny-first precedence, glob-based resource matching
- Hygraph: Granular permission system scoped to model + stage + locale
- CodeMirror 6: `EditorState.readOnly` facet, `EditorView.editable` facet
- Socket.IO: Room-based broadcasting, per-socket emission
- Academic: "Access Control in Collaborative Systems" (Tolone et al., 2005) — ACL vs capability-list tradeoffs
- Permify: ReBAC modeling of Google Docs-style access

---

### Pattern 1: Two-Layer Permission Map (RECOMMENDED)

**Data Structure:**
```typescript
// shared/permissions.ts — Single source of truth

type PermissionLevel = "OWNER" | "EDITOR" | "VIEWER" | "REQUESTED";

type RoomPermissions = {
  /** Room-level default. Applied when no tab override exists. */
  defaultLevel: PermissionLevel;
  /** Per-user room-level overrides. Key = username. */
  userOverrides: Map<string, PermissionLevel>;
  /** Per-tab permission overrides. Key = tabId. */
  tabOverrides: Map<string, {
    /** Default for this tab (inherits from room default if absent). */
    defaultLevel?: PermissionLevel;
    /** Per-user overrides for this tab. */
    userOverrides: Map<string, PermissionLevel>;
  }>;
  /** Persistent permission memory. Survives disconnect/reconnect. */
  /** Key = username. Stores last known permission level. */
  permissionMemory: Map<string, {
    roomLevel: PermissionLevel;
    tabLevels: Map<string, PermissionLevel>;
    grantedAt: number;
    grantedBy: string;
  }>;
};
```

**Resolution Algorithm:**
```
resolvePermission(username, tabId):
  1. If username === room.creator → OWNER (always, non-overridable)
  2. Check tabOverrides[tabId].userOverrides[username] → if exists, return it
  3. Check tabOverrides[tabId].defaultLevel → if exists, return it
  4. Check room.userOverrides[username] → if exists, return it
  5. Return room.defaultLevel
```

**Tradeoffs:**
- ✅ O(1) lookup (3 map hits max)
- ✅ Inheritance is explicit — tab defaults can diverge from room defaults
- ✅ Memory-efficient — only overrides stored, not full matrix
- ⚠️ Tab deletion must cascade (clean up tabOverrides for that tabId)
- ⚠️ permissionMemory grows unbounded without TTL or cleanup

**Why this over alternatives:**
- Full matrix (user × tab) — O(users × tabs) memory, mostly redundant
- ACL per tab — more flexible but overkill for 4 permission levels
- Role-based (RBAC) — unnecessary indirection; no role hierarchy needed

---

### Pattern 2: Hybrid ACL + Permission Level (More Flexible)

**Data Structure:**
```typescript
type PermissionAction = "edit" | "create-tab" | "delete-tab" | "rename-tab" | "view";
type ACLRule = {
  subject: string;    // username or "*"
  resource: string;   // tabId, "room", or glob "tab:*"
  action: PermissionAction;
  effect: "allow" | "deny";
  priority: number;   // higher = wins
};

type PermissionStore = {
  rules: ACLRule[];
  /** Inherit from room default, then deny-first within same priority */
};
```

**Resolution:**
```
resolve(subject, resource, action):
  matching = rules.filter(r => matches(r.subject, subject) && matches(r.resource, resource) && r.action === action)
  sort by priority desc
  if any matching rule has effect "deny" at highest priority → deny
  if any matching rule has effect "allow" at highest priority → allow
  default: deny
```

**Tradeoffs:**
- ✅ Extremely flexible — can express "deny edit on tab-3 for everyone except alice"
- ✅ Glob patterns let you target "all tabs" or "tabs matching pattern"
- ❌ O(rules) lookup per check — needs indexing for production scale
- ❌ Harder to reason about (priority, deny-first)
- ❌ Overkill for CodeSync's scale (≤10 tabs, ≤20 users per room)

**Verdict**: Not recommended for CodeSync's current scale. The Two-Layer Map is simpler and sufficient.

---

### Pattern 3: Event-Sourced Permissions (Audit-Ready)

Store every permission change as an immutable event. Current state is the fold of all events.

```typescript
type PermissionEvent = {
  id: string;
  timestamp: number;
  actor: string;        // who made the change
  target: string;       // username affected
  resource: string;     // tabId or "room"
  previousLevel: PermissionLevel;
  newLevel: PermissionLevel;
};
```

**Tradeoffs:**
- ✅ Full audit trail — who changed what, when
- ✅ Can replay to any point in time
- ✅ Easy undo (append reverse event)
- ❌ State must be computed (fold all events) — needs snapshot optimization
- ❌ More complex to implement
- ❌ Event list grows without compaction

**Verdict**: Consider for v2 when audit/compliance is needed. For v1, the Two-Layer Map with `permissionMemory` metadata is sufficient.

---

### Event Flow Design (Two-Layer Map)

**New Socket Events (add to `shared/actions.ts`):**

```typescript
ACTIONS = {
  // ... existing ...
  PERMISSION_REQUEST: "permission-request",     // user → owner: request edit on tab
  PERMISSION_GRANT: "permission-grant",         // owner → user: grant permission on tab
  PERMISSION_REVOKE: "permission-revoke",       // owner → user: revoke permission on tab
  PERMISSION_DENIED: "permission-denied",       // server → user: your request was denied
  TAB_PERMISSIONS_UPDATE: "tab-permissions-update", // server → room: permissions changed
} as const;
```

**Request → Grant → Revoke Flow:**

```
1. User clicks "Request Edit" on tab X
   Client → Server: PERMISSION_REQUEST { roomId, tabId, requestedLevel: "EDITOR" }

2. Server validates:
   - Is the user in the room?
   - Is the sender the room creator? (only owner can approve)
   - Store as REQUESTED level in tabOverrides

3. Server → Owner: PERMISSION_REQUEST { username, tabId, requestedLevel }
   (Owner sees a notification in ParticipantsDrawer)

4a. Owner approves:
   Owner → Server: PERMISSION_GRANT { roomId, username, tabId, level: "EDITOR" }
   Server updates tabOverrides[tabId].userOverrides[username] = "EDITOR"
   Server → Room: TAB_PERMISSIONS_UPDATE { username, tabId, level: "EDITOR" }
   Server → User: PERMISSION_GRANT { tabId, level: "EDITOR" }

4b. Owner denies:
   Owner → Server: PERMISSION_REVOKE { roomId, username, tabId }
   Server → User: PERMISSION_DENIED { tabId }
```

**Server-Side Enforcement (Critical):**

The existing `CODE_CHANGE` handler must be updated:

```typescript
socket.on(ACTIONS.CODE_CHANGE, ({ roomId, tabId, code }) => {
  // ... existing room/socket validation ...

  const userName = userSocketMap.get(socket.id);
  const permission = resolvePermission(room, userName, tabId);

  // OWNER or EDITOR can edit; VIEWER and REQUESTED cannot
  if (permission !== "OWNER" && permission !== "EDITOR") {
    return; // silently drop — don't even ACK
  }

  // ... rest of existing code change logic ...
});
```

Similarly for TAB_CREATE, TAB_CLOSE, TAB_RENAME — check the resolved permission level.

---

### Client-Side Enforcement (CodeMirror)

CodeMirror 6 provides two facets for controlling editability:

1. **`EditorState.readOnly`** — When `true`, editing commands (typing, delete, etc.) are disabled. The cursor is still visible. This is the primary knob.
2. **`EditorView.editable`** — When `false`, the DOM `contenteditable` attribute is removed. No cursor, no focus, fully non-interactive.

**Implementation Strategy:**

```typescript
// In Editor.tsx — compute editable state per tab
const isEditable = useMemo(() => {
  if (permission === "OWNER" || permission === "EDITOR") return true;
  return false; // VIEWER, REQUESTED → read-only
}, [permission]);

// Use both facets for defense in depth
const permissionExtensions = useMemo(() => {
  if (isEditable) return [];
  return [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false), // disables cursor too for viewers
  ];
}, [isEditable]);

// REQUESTED users get readOnly=true but editable=true (show cursor, gray out)
const requestedExtensions = useMemo(() => {
  if (permission === "REQUESTED") {
    return [EditorState.readOnly.of(true)]; // cursor visible but can't type
  }
  return [];
}, [permission]);
```

**Key Insight**: VIEWER should use `readOnly + !editable` (no cursor, clean read-only). REQUESTED should use `readOnly` only (cursor visible, indicates "waiting for access"). EDITOR/OWNER get full access.

---

### Permission Persistence (Reconnect Memory)

**Problem**: When a user disconnects and reconnects, their permissions should be remembered.

**Current behavior** (from `roomManager.ts`):
- `disconnectClient()` deletes `room.permissions.delete(client.username)` — permissions are LOST on disconnect.
- On rejoin, user gets `DEFAULT_PERMISSIONS` again.

**Proposed fix**: Add `permissionMemory` to `RoomState` that survives disconnection:

```typescript
type RoomState = {
  // ... existing fields ...
  /** Persists across disconnect/reconnect. Separate from live permissions. */
  permissionMemory: Map<string, {
    roomLevel: PermissionLevel;
    tabLevels: Map<string, PermissionLevel>;
    grantedAt: number;
    grantedBy: string;
  }>;
};
```

**On grant**: Write to both `permissions` (live) and `permissionMemory` (persistent).
**On disconnect**: Remove from `permissions` (live) but KEEP in `permissionMemory`.
**On rejoin**: If user exists in `permissionMemory`, restore from memory instead of `DEFAULT_PERMISSIONS`.

**TTL**: `permissionMemory` entries expire after 8 hours (same as `ROOM_CODE_TTL_MS`). This prevents stale permissions from persisting indefinitely.

---

### Edge Cases

| Edge Case | Resolution |
|---|---|
| **Tab deleted** | Cascade-delete `tabOverrides[tabId]` and `permissionMemory[username].tabLevels[tabId]`. Broadcast `TAB_PERMISSIONS_UPDATE` to inform clients. |
| **Creator leaves** | `ownerHasDisconnected = true` already exists. PERMISSION_REQUEST events queue up. If owner rejoins (reclaim), they see pending requests. If owner never returns and a new owner is established (first joiner), pending requests carry over. |
| **Creator transfers ownership** | Already handled by `transferOwner()`. New owner inherits full OWNER level. Old owner drops to their `permissionMemory` level (last known level before becoming owner, or EDITOR). |
| **User rejoins with different username** | Treated as a new user — no permission memory match. This is intentional (username IS the identity). |
| **Permission downgrade while user is editing** | Server rejects subsequent `CODE_CHANGE` events. Client receives `TAB_PERMISSIONS_UPDATE` with new level, which triggers CodeMirror `readOnly` update. Show a toast: "Your edit access was revoked." |
| **Race: two users request edit on same tab** | Owner receives both requests. Granting one doesn't auto-revoke the other — both can be EDITOR simultaneously (unlike current single-currentEditor model). |
| **Room is empty and cleaned up** | `permissionMemory` is destroyed with the room. No persistence across room destruction — by design. |

---

### Migration Strategy (From Current → Per-Tab)

**Phase 1**: Extend `UserPermissions` with `PermissionLevel` field, backward-compatible.

```typescript
type UserPermissions = {
  canEdit: boolean;         // kept for backward compat
  canCreateTab: boolean;
  canDeleteTab: boolean;
  canRenameTab: boolean;
  // NEW: unified permission level
  level?: PermissionLevel;  // optional during migration
  tabLevels?: Map<string, PermissionLevel>;
};
```

**Phase 2**: Add `tabOverrides` to `RoomState`. Add `TAB_PERMISSIONS_UPDATE` event. Update `PERMISSIONS_UPDATE` handler to accept `tabId` optionally.

**Phase 3**: Add `PERMISSION_REQUEST` flow. Update ParticipantsDrawer with per-tab permission UI.

**Phase 4**: Remove the `currentEditor` single-editor model. Any user with EDITOR or OWNER level on a tab can edit simultaneously. The `currentEditor` field is kept only to track "who last typed" for UI awareness, not as a gate.

**Phase 5**: Retire `canEdit` / `canCreateTab` / `canDeleteTab` / `canRenameTab` booleans in favor of `PermissionLevel` + capability flags derived from level:

```typescript
const LEVEL_CAPABILITIES = {
  OWNER:   { canEdit: true,  canCreateTab: true,  canDeleteTab: true,  canRenameTab: true,  canManagePermissions: true  },
  EDITOR:  { canEdit: true,  canCreateTab: true,  canDeleteTab: false, canRenameTab: true,  canManagePermissions: false },
  VIEWER:  { canEdit: false, canCreateTab: false, canDeleteTab: false, canRenameTab: false, canManagePermissions: false },
  REQUESTED: { canEdit: false, canCreateTab: false, canDeleteTab: false, canRenameTab: false, canManagePermissions: false },
} as const;
```

---

### Industry Parallels

| System | Permission Model | Per-File? | Inheritance? | Notable |
|---|---|---|---|---|
| **VS Code Live Share** | Session-level read-only or read/write. Per-terminal r/w. No per-file. | No (session-level only) | No | Host controls read-only globally; individual terminals can be shared r/w |
| **Google Docs** | Owner / Editor / Commenter / Viewer per document. Suggesting mode. | No (per-document only) | Folder → file inheritance | "Suggesting" = track changes as pending ops, owner accepts/rejects |
| **GitBook** | Org → Site → Collection → Space cascading. Override at any level. | Yes (per-space) | Yes (cascading, override at each level) | Direct overrides beat inherited; site beats org |
| **Notion** | Owner / Admin / Member / Guest at workspace, page-level overrides | Yes (per-page) | Parent → child inheritance | Guest = restricted to specific pages |
| **Figma** | Owner / Editor / Viewer per file. Can-view-only links. | No (per-file only) | Project → file inheritance | View-only mode with "request edit access" button |
| **Hygraph** | Granular: model + stage + locale + action. Custom roles. | Yes (per model/stage) | Role-based + condition rules | Most complex — overkill for CodeSync |

**Key takeaway from industry**: Per-resource (per-file/per-tab) permission overrides with room-level defaults is the standard pattern. Google Docs and Figma both implement "request edit access" flows. The Two-Layer Map model aligns with how GitBook and Notion implement cascading inheritance.

---

### Recommended Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│  Server: RoomState                                          │
│                                                             │
│  permissions: Map<username, UserPermissions>     ← live     │
│  permissionMemory: Map<username, PermissionMemory> ← persistent │
│  tabOverrides: Map<tabId, TabPermissionOverrides> ← per-tab │
│                                                             │
│  resolvePermission(username, tabId): PermissionLevel        │
│    1. Owner check                                           │
│    2. Tab user override                                     │
│    3. Tab default                                           │
│    4. Room user override                                    │
│    5. Room default (VIEWER)                                 │
└─────────────────────────────────────────────────────────────┘
         │
         │  Socket events: PERMISSION_REQUEST, PERMISSION_GRANT,
         │  PERMISSION_REVOKE, TAB_PERMISSIONS_UPDATE
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Client: Editor.tsx                                         │
│                                                             │
│  permission = resolvePermission(myUsername, activeTabId)    │
│                                                             │
│  OWNER/EDITOR → readOnly=false, editable=true               │
│  REQUESTED    → readOnly=true,  editable=true  (cursor)     │
│  VIEWER       → readOnly=true,  editable=false (no cursor)  │
│                                                             │
│  On TAB_PERMISSIONS_UPDATE: re-derive extensions,           │
│  dispatch EditorState.create with new readOnly facet        │
└─────────────────────────────────────────────────────────────┘
```

**Estimated scope**: ~5 files changed (validation.ts, roomManager.ts, socket.ts, shared/actions.ts, Editor.tsx) + 2 new files (shared/permissions.ts, TabPermissionUI component)

## 2026-06-29: Tab Permissions UI in ParticipantsDrawer

### Problem
Phase 5 required adding a tab-level permission selector to the ParticipantsDrawer, plus bulk grant/revoke buttons. The `emitTabPermissionGrant` function in `useEditorRealtime` uses a literal union `"EDITOR" | "VIEWER"` rather than the broader `TabPermissionLevel` type (which also includes `"REQUESTED"`).

### Root Cause
The hook's emit signature intentionally excludes `"REQUESTED"` since that's a request state, not a grantable state. Initial typings used `TabPermissionLevel` which caused a type mismatch.

### Lesson
**Match emit function signatures exactly to their literal unions**, not to the broader type alias. When an emit function only accepts `"EDITOR" | "VIEWER"`, type the prop as that literal union — not as `TabPermissionLevel`. The select's `onChange` cast should also use `"EDITOR" | "VIEWER"` to match.
