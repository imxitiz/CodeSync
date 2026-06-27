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
