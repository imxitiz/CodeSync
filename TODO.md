# TODO.md — CodeSync UX Overhaul

> **SHARED SOURCE OF TRUTH** — All agents working on this project read this file.
> Mark tasks with your agent ID when you start. Update status in real-time.
> Write findings to `docs/shared/findings.md` when done.


---

## 🔷 MARKER: What Each Agent Should Pick Up

| Agent | Pick up tasks labeled |
|-------|----------------------|
| **Agent A** (Top Bar + Invite Link) | `TOP-BAR`, `INVITE` |
| **Agent B** (Participants Drawer + Shortcuts) | `DRAWER`, `SHORTCUTS` |
| **Agent C** (Tab Bar + Empty State + Connection) | `TAB-BAR`, `EMPTY-STATE`, `CONNECTION` |

**Dependency note:** Agent C finishes `CONNECTION` before Agent A finishes `TOP-BAR` (status dot lives in top bar). Coordinate via this file.

---

## 📋 Task List

### TOP-BAR — Redesign editor top bar with three-zone layout
- [ ] **TOP-BAR-1**: Refactor top bar into three zones: Identity (left), Presence (center), Actions (right) — `EditorPageModern.tsx`
- [ ] **TOP-BAR-2**: Add responsive overflow — collapse to `⋯` dropdown on tablet/mobile
- [ ] **TOP-BAR-3**: Group editor controls (font size, wrap) with visual separators
- [ ] **TOP-BAR-4**: Ensure all buttons have consistent `size="icon"` and `variant` patterns

### DRAWER — Convert participants modal to slide-out drawer
- [x] **DRAWER-1**: Create `ParticipantsDrawer.tsx` component — right-side slide panel, NOT a modal
- [x] **DRAWER-2**: Wire trigger to participant count button in top bar Zone 2
- [x] **DRAWER-3**: Move all participant cards + permissions editor into drawer
- [x] **DRAWER-4**: Add focus management (focus trap on open, restore on close)
- [x] **DRAWER-5**: Add backdrop dim (not blur), Escape to close, click-outside to close

**Agent B — DRAWER tasks in progress**

### TAB-BAR — Improve tab bar UX
- [x] **TAB-BAR-1**: Add 2px top border accent on active tab (`border-t-primary`) — **Agent C done**
- [x] **TAB-BAR-2**: Add file-type icons using `fileIcons.tsx` helper — **Agent C done**
- [x] **TAB-BAR-3**: Always-visible close button on active tab, hover on inactive — **Agent C done**
- [x] **TAB-BAR-4**: Add rename discovery hint (subtle icon on hover + tooltip) — **Agent C done**
- [x] **TAB-BAR-5**: Auto-scroll active tab into view via `scrollIntoView` — **Agent C done**

### EMPTY-STATE — Add empty state to editor
- [x] **EMPTY-STATE-1**: Create `EmptyState.tsx` — centered overlay with code icon + context — **Agent C done**
- [x] **EMPTY-STATE-2**: Show only when `activeTab.code === ''` AND `tabs.length === 1` — **Agent C done**
- [x] **EMPTY-STATE-3**: Auto-dismiss when user starts typing (fade out) — **Agent C done**

### CONNECTION — Improve connection status indicator
- [x] **CONNECTION-1**: Add animated states: pulsing gray (connecting), solid green (connected), red pulse (disconnected) — **Agent C done**
- [x] **CONNECTION-2**: Add tooltip with server URL — **Agent C done**
- [x] **CONNECTION-3**: Mobile: dot only; Desktop: dot + text — **Agent C done**

### INVITE — One-click invite link copy
- [ ] **INVITE-1**: Room ID pill copies full URL (`${origin}/editor/${roomId}`)
- [ ] **INVITE-2**: Show brief checkmark feedback on copy (1.5s)
- [ ] **INVITE-3**: Update toast message to "Invite link copied!"

---

## 🔴 RECONCILE — Integration Broken

**Status**: `EditorPageModern.tsx` is in a BROKEN state after agent work.
**Type-check**: 11 errors in the top bar section (lines 432-650).
**What agents created correctly**:
- `ParticipantsDrawer.tsx` ✅
- `ConnectionStatus.tsx` ✅
- `EmptyState.tsx` ✅
- `ShortcutsPanel.tsx` ✅
- `fileIcons.tsx` ✅
- `TopBar/` directory ✅
- Bottom half of EditorPageModern.tsx (lines 660-748) — wired correctly ✅

**What's broken**:
- Top half of EditorPageModern.tsx (lines 432-650) — malformed JSX, unclosed tags, duplicate/overlapping code
- The TopBar component was created but NOT properly integrated — old top bar code still exists alongside new code

**What to do**:
1. Read `EditorPageModern.tsx` lines 400-660 — identify the broken section
2. Remove the duplicate/old top bar code
3. Properly integrate the TopBar component (or rewrite the inline top bar if TopBar/ is incomplete)
4. Ensure `bun run type-check` passes with zero errors
5. Ensure `bun run lint` passes

**All 3 agents**: This is a shared problem. Agent A owns TOP-BAR integration, but all of you broke it together. Coordinate via this file.

**Agent A**: You created `TopBar/TopBar.tsx` (492 lines, looks good). Now wire it into `EditorPageModern.tsx`:
1. Read lines 432-660 of `EditorPageModern.tsx` — that's the OLD top bar code that's now broken
2. Replace that entire section with `<TopBar {...props} />` 
3. Remove the old inline connection status, avatars, buttons — all of it
4. Import TopBar from `@/components/TopBar/TopBar`
5. Run `bun run type-check` — zero errors
6. Run `bun run lint` — passes

**Agent B & C**: Don't touch the top bar. Stay out of Agent A's way. Work on your own remaining tasks or help test.

---

## 🏗️ Architecture Notes

- **Spec file**: `docs/shared/ux-redesign-spec.md` — full design decisions + token reference
- **File icons helper**: `src/pages/EditorPageModern/fileIcons.tsx` — already created
- **No new dependencies** — use existing lucide-react, shadcn, CodeMirror
- **CSS variables only** — never hardcode colors, use `--primary`, `--card`, `--muted-foreground`, etc.
- **Mobile-first** — design for <768px first, enhance up
- **A11y** — all interactive elements need `aria-label`, focus rings, keyboard nav

---

## 🚫 Rules

1. **ALWAYS update this file** when you start/complete a task — NO EXCEPTIONS
2. **NEVER** start a task another agent has marked as `in_progress`
3. **ALWAYS** read this file before starting work
4. **Write findings** to `docs/shared/findings.md` when your work is done
5. **Run `bun run type-check`** before finishing
6. **Run `bun run lint`** before finishing
7. **🔴 CHECKPOINT**: Before you consider your work DONE, you MUST update this file with:
   - [x] The task IDs you completed
   - Your agent name next to the completion note
   - Any new tasks you discovered during work
   - Any tasks you couldn't complete and why
8. **🔴 VERIFICATION**: I (the orchestrator) will check this file after you report done.
   If your tasks aren't marked completed here, your work is NOT done. Period.
9. **PICK UP NEXT**: After completing your tasks, check for any unstarted `pending` tasks and pick them up. Don't wait to be told.
10. **🔴 SELF-MAINTENANCE**: If you realize a rule or process needs changing during your work, update THIS file immediately. Don't wait for the orchestrator to tell you.

---

*Created: 2026-06-27 | Last updated: 2026-06-27*
