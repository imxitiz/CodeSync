# CodeSync UX Redesign Specification

> **Version**: 1.0  
> **Date**: 2026-06-27  
> **Author**: Designer Agent  
> **Status**: Ready for implementation

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Editor Page Top Bar Redesign](#2-editor-page-top-bar-redesign)
3. [Participants Drawer](#3-participants-drawer)
4. [Remote Cursors & Presence](#4-remote-cursors--presence)
5. [Tab Bar Improvements](#5-tab-bar-improvements)
6. [Empty State](#6-empty-state)
7. [Keyboard Shortcuts Panel](#7-keyboard-shortcuts-panel)
8. [Connection Status Indicator](#8-connection-status-indicator)
9. [Invite Link](#9-invite-link)
10. [Theme Switcher Improvements](#10-theme-switcher-improvements)
11. [Component Hierarchy Changes](#11-component-hierarchy-changes)
12. [Token Reference](#12-token-reference)
13. [Mobile Considerations](#13-mobile-considerations)
14. [Accessibility Notes](#14-accessibility-notes)

---

## 1. Design Philosophy

### Current Problems
- **Top bar information overload**: 12+ controls crammed into a single horizontal line with no visual grouping
- **Participants modal blocks workflow**: Full-screen overlay interrupts coding flow
- **No presence awareness**: Cannot see where other users are or what they're doing
- **Tab bar lacks visual feedback**: Active tab indicator is subtle; close buttons hidden
- **No empty state**: Blank editor feels broken, not inviting
- **Connection status is an afterthought**: Buried in a 1px dot with no actionable detail
- **Theme switcher is text-heavy**: No visual preview; import flow is intimidating

### Design Principles for This Redesign
1. **Progressive disclosure**: Show only what's needed; reveal complexity on demand
2. **Spatial grouping**: Proximity = relatedness. Group by function, not by feature list
3. **Non-blocking by default**: Use drawers, tooltips, and overlays that don't obstruct the editor
4. **Presence at a glance**: Users should understand the room state without reading text
5. **Mobile-first responsive**: Design for the small screen first, enhance for larger

---

## 2. Editor Page Top Bar Redesign

### Current Layout (Problems)
```
[Room: abc123... copy] [username ●] [avatars +2] [A+ A- Wrap] [Copy] [Take] [People] [FollowingUser] [Zen] [Leave]
```
All items are equal weight, separated by inconsistent spacing, overflow handled by horizontal scroll.

### Proposed Layout: Three-Zone Grouping

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ZONE 1: Identity    │  ZONE 2: Presence       │  ZONE 3: Actions             │
│ ← room + user       │  ← avatars + count       │  ← tools + leave              │
│                      │                          │                                │
│ [🔗 abc123...]       │ [👤👤👤 +2] [👥 5]      │ [A↕] [Wrap] [Copy] [✎/👁] [⋯] [Leave] │
│  you ●               │                          │                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Zone Definitions

#### Zone 1: Identity (Left, `flex-shrink-0`)
Contains: Room ID button + username + connection status

| Element | Behavior | Tokens |
|---------|----------|--------|
| Room ID pill | Click to copy full invite link (see §9). Shows truncated ID with copy icon. | `bg-secondary`, `text-secondary-foreground`, `border`, `font-mono text-[11px]` |
| Username | Static display, truncated to 16 chars | `text-muted-foreground text-xs` |
| Status dot | See §8 for full design | `size-2 rounded-full` |

**Layout**: `flex items-center gap-2` with the room ID pill taking the full height. Username and status dot below or inline on wider screens.

#### Zone 2: Presence (Center, `flex-1 justify-center`, hidden on mobile)
Contains: Compact avatar stack + participant count button

| Element | Behavior | Tokens |
|---------|----------|--------|
| Avatar stack | Overlapping avatars (negative `ms-2`), max 5 visible, tooltip with username on hover | `size-7`, `rounded-lg`, `ring-2 ring-background` |
| "+N" badge | Opens participants drawer (see §3) | `bg-background border text-foreground text-[10px] font-medium` |
| Participant count button | Toggles participants drawer. Shows total count. | `rounded-full px-2 py-0.5 text-xs` |

**Mobile**: Hidden. Replaced by a single `[👥 N]` button in Zone 3 that opens the drawer.

#### Zone 3: Actions (Right, `flex-shrink-0`)
Contains: editor tools + control + leave. Grouped with visual separators.

**Group A — Editor Controls** (always visible):
| Element | Icon | Title | Tokens |
|---------|------|-------|--------|
| Font size + | `MdTextIncrease` | Increase font size | `variant="ghost" size="icon"` |
| Font size - | `MdTextDecrease` | Decrease font size | `variant="ghost" size="icon"` |
| Wrap toggle | `FiWrap` (or text "Wrap") | Toggle line wrap | `variant={wrapLines ? "secondary" : "ghost"}` |

**Group B — Code Actions** (visible when code present):
| Element | Icon | Title | Tokens |
|---------|------|-------|--------|
| Copy code | `FaRegCopy` | Copy to clipboard | `variant="ghost" size="icon"` |
| Edit/Toggle | `FiEdit2` / `FiEye` | Take/release control | `variant={canEdit ? "secondary : "default"}` |

**Group C — Overflow Menu** (mobile-only on small screens, always visible on desktop):
| Element | Icon | Title |
|---------|------|-------|
| People | `FiUsers` | Open participants drawer |
| Zen | `FiEyeOff` (or custom) | Toggle zen mode |
| Leave | `FiLogOut` | Leave room |

**Separator**: `h-6 w-px bg-border mx-1.5` between groups.

### Overflow Strategy
- **Desktop (>1024px)**: All groups visible
- **Tablet (768–1024px)**: Group C collapses into `⋯` dropdown menu (shadcn DropdownMenu)
- **Mobile (<768px)**: Only Zone 1 + Zone 3 Groups B (Copy, Edit) + overflow `⋯` button. Zone 2 moved to drawer trigger in overflow menu.

### Implementation Notes
```tsx
// TopBar structure
<div className="flex h-11 items-center gap-2 border-b bg-background/90 px-2 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-3">
  <IdentityZone />      {/* flex-shrink-0 */}
  <PresenceZone />      {/* flex-1 justify-center, hidden sm:flex */}
  <ActionsZone />       {/* flex-shrink-0 ml-auto */}
</div>
```

---

## 3. Participants Drawer

### Current Problem
Full-screen centered modal with backdrop blur blocks the editor entirely. Users cannot see code changes while managing participants.

### Proposed: Right-Side Slide-Out Drawer

```
┌─────────────────────────────────────┬──────────────────┐
│                                     │  Participants (5) │
│         Editor Canvas               │  ─────────────── │
│         (still visible)             │  👤 You (owner)   │
│                                     │  👤 Alice · main  │
│                                     │  👤 Bob · utils   │
│                                     │  👤 Carol (edit)  │
│                                     │                   │
│                                     │  [Copy Invite]    │
│                                     │  [Done]           │
└─────────────────────────────────────┴──────────────────┘
```

### Behavior
- **Trigger**: Participant count button in top bar (Zone 2)
- **Animation**: Slide in from right, 200ms ease-out, with subtle backdrop dim (not blur)
- **Width**: `w-72` (288px) on desktop, full-width sheet on mobile
- **Focus management**: Focus moves to drawer on open; returns to editor on close
- **Close triggers**: Close button, Escape key, click on backdrop (optional — editor is still visible, so backdrop can be minimal)

### Drawer Content Structure

#### Header
```
Participants (5)          [X close]
```
Sticky at top, `border-b`, `px-4 py-3`

#### Participant List
Each participant card shows:
- Avatar (react-avatar, size 36)
- Username (truncated)
- Active tab name (e.g., "editing `main.js`")
- Role badges: Crown (owner), Pencil (editor)
- Action buttons (contextual):
  - **Follow** button (if not self): `FiEye` icon, toggles follow mode
  - **Permissions gear** (owner only, not for self): Opens inline permissions editor

#### Active Tab Indicator
Each participant card shows a small tab badge:
```
[avatar] Alice              [Follow]
         editing main.js    [⚙] (owner only)
```

#### Footer Actions
```
[Copy Invite Link]                    [Done]
```
`Copy Invite Link` copies the full URL (see §9). `Done` closes the drawer.

### Tokens
| Element | Tokens |
|---------|--------|
| Drawer container | `bg-card border-l shadow-xl` |
| Header | `text-sm font-semibold text-foreground` |
| Participant card | `rounded-md px-3 py-2 hover:bg-accent/40 transition-colors` |
| Active participant (followed) | `ring-1 ring-primary/30 bg-primary/5` |
| Tab badge | `text-[10px] text-muted-foreground font-mono` |
| Role badge (owner) | `bg-amber-400/20 text-amber-300 text-[10px] rounded-full px-1.5` |
| Role badge (editor) | `bg-emerald-400/20 text-emerald-300 text-[10px] rounded-full px-1.5` |

### Implementation
Use a slide-in panel (not shadcn Dialog). Implement as a fixed-position aside:
```tsx
<aside
  className="fixed inset-y-0 right-0 z-50 w-72 border-l bg-card shadow-xl transition-transform duration-200"
  style={{ transform: open ? 'translateX(0)' : 'translateX(100%)' }}
  role="dialog"
  aria-label="Participants"
  aria-hidden={!open}
>
```

---

## 4. Remote Cursors & Presence

### Current State
Single-editor model: only one user can edit at a time. No visual indication of where other users are in the code.

### Proposed: Presence Dots on Gutter

Even in read-only mode, show subtle presence indicators:

#### Gutter Dots
- Render small colored dots (4px) in the gutter next to the line where a user's cursor is
- Color matches the user's avatar color (deterministic from username hash)
- Dot has a tooltip: `Alice: line 42`

#### Active Line Highlight
- When a user is on the active line, add a subtle left-border accent (2px) in their color
- Only show for the currently-followed user (if follow mode is active)

#### Implementation Approach
Since the single-editor model persists, presence is shown via:
1. **Gutter dots**: Custom CodeMirror gutter element that reads `userActiveTabs` and cursor positions
2. **Line highlight**: CodeMirror `EditorView.decorations` on the active line of followed user

```tsx
// In Editor.tsx — add presence layer
const presenceDecorations = View.decorations.compute(state => {
  // Build decorations from remote cursor positions
  // Each user gets a unique color from a hash of their username
})
```

#### Fallback (Simpler)
If CodeMirror gutter customization is too complex for v1:
- Show a floating label at the top-right of the editor: `Alice is viewing main.js`
- Use a small banner-style indicator: `bg-primary/10 text-primary text-[11px] px-2 py-0.5 rounded-b`

---

## 5. Tab Bar Improvements

### Current State
```
[main.js] [utils.js] [+]
```
- Active tab: `bg-card` (barely visible against `bg-background`)
- Close button: hidden, only shows on hover via `group-hover`
- No file-type icons
- Double-click to rename (undiscoverable)

### Proposed Design

```
┌──────────────────────────────────────────────────────────┐
│ [📄 main.js]  [📄 utils.js ×]              [+]          │
│  ▔▔▔▔▔▔▔▔▔▔▔                                           │
└──────────────────────────────────────────────────────────┘
```

#### Active Tab Indicator
- **Bottom border accent**: 2px colored line at top of active tab using `bg-primary`
- **Background**: `bg-card` with subtle `shadow-sm` to create elevation
- **Text**: `text-foreground font-medium` (vs `text-muted-foreground` inactive)

#### File-Type Icons
Map file extensions to icons using `lucide-react` icons:

| Extension | Icon | Color |
|-----------|------|-------|
| `.js` | `SiJavascript` (or `FiFileText`) | `text-yellow-400` |
| `.ts` / `.tsx` | `SiTypescript` (or `FiFile`) | `text-blue-400` |
| `.jsx` | `SiReact` | `text-cyan-400` |
| `.json` | `FiFileJson` | `text-green-400` |
| `.css` | `SiCss3` | `text-purple-400` |
| `.html` | `SiHtml5` | `text-orange-400` |
| `.md` | `FiFileText` | `text-gray-400` |
| default | `FiFile` | `text-muted-foreground` |

Use a helper function:
```tsx
function getFileIcon(name: string): ReactNode {
  const ext = name.split('.').pop()?.toLowerCase()
  // Return appropriate icon based on ext
}
```

#### Close Button
- **Active tab**: Always visible `×` button on the right side
- **Inactive tabs**: Visible on hover (current behavior kept)
- **Minimum touch target**: `size-4` with `p-0.5` hit area

#### Rename Discovery
- Double-click keeps working
- Add a subtle `⤢` or `✎` icon that appears on hover of the tab name to hint at rename
- Tooltip on hover: "Double-click to rename"

#### Tab Overflow
- Horizontal scroll with `scrollbar-none` (already implemented)
- Active tab auto-scrolls into view via `scrollIntoView({ inline: 'center' })`

### Tokens
| Element | Tokens |
|---------|--------|
| Tab container | `bg-background/80 border-b` |
| Inactive tab | `text-muted-foreground hover:text-foreground hover:bg-accent/40` |
| Active tab | `bg-card text-foreground font-medium border-t-2 border-t-primary` |
| Close button | `text-muted-foreground hover:text-destructive hover:bg-destructive/10` |
| New tab button | `text-muted-foreground hover:text-foreground hover:bg-accent/40` |

---

## 6. Empty State

### Current State
When the editor has no code, it shows a blank CodeMirror instance — looks broken.

### Proposed: Subtle Empty State Overlay

```
┌──────────────────────────────────────────┐
│                                          │
│         ╭───────────────────╮            │
│         │  ⌨️  Start typing  │            │
│         │  to collaborate    │            │
│         ╰───────────────────╯            │
│                                          │
│     main.js · 3 people in this room      │
│     Alice is editing · Bob is viewing    │
│                                          │
└──────────────────────────────────────────┘
```

### Behavior
- **Visibility**: Only shows when `activeTab.code === ''` AND `activeTab` is the only tab
- **Position**: Centered in the editor canvas, absolutely positioned
- **Dismissal**: Automatically hides when user starts typing
- **Animation**: Fade in (opacity 0→1, 200ms), no layout shift

### Content
1. **Icon**: Large keyboard icon or code icon (`FiCode`) at `text-muted-foreground/30`
2. **Primary text**: "Start typing to collaborate..." — `text-muted-foreground text-sm`
3. **Context line**: Room name + participant count — `text-muted-foreground/60 text-xs`
4. **Activity line**: Who is currently editing/viewing — `text-muted-foreground/60 text-xs`

### Implementation
```tsx
{activeTab.code === '' && tabs.length === 1 && (
  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
    <div className="text-center space-y-2 opacity-60">
      <FiCode className="mx-auto size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">Start typing to collaborate...</p>
      <p className="text-xs text-muted-foreground/60">
        {sortedClients.length} people in this room
        {currentEditor && ` · ${currentEditor} is editing`}
      </p>
    </div>
  </div>
)}
```

### Tokens
| Element | Tokens |
|---------|--------|
| Container | `absolute inset-0 z-10 flex items-center justify-center` |
| Icon | `text-muted-foreground/30 size-8` |
| Primary text | `text-muted-foreground text-sm` |
| Context text | `text-muted-foreground/60 text-xs` |

---

## 7. Keyboard Shortcuts Panel

### Trigger
- `?` key (without modifiers, when not in an edit field)
- Help icon (`FiHelpCircle`) in the top bar overflow menu

### Panel Design
```
┌──────────────────────────────────────┐
│  Keyboard Shortcuts           [×]    │
│  ─────────────────────────────────── │
│                                      │
│  General                             │
│  ⌘/Ctrl+C      Copy code             │
│  ⌘/Ctrl+Enter  Toggle edit control   │
│  ?              Show shortcuts        │
│  Esc            Exit zen mode        │
│                                      │
│  Editor                              │
│  ⌘/Ctrl+S      Save (future)         │
│  ⌘/Ctrl+D      Duplicate line        │
│                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  CodeSync v1.0                       │
└──────────────────────────────────────┘
```

### Behavior
- **Position**: Centered modal with backdrop (can be dismissed by clicking backdrop or Escape)
- **Width**: `max-w-sm` (384px)
- **Animation**: Scale-in (0.95→1, 150ms ease-out) + fade
- **Sections**: Group by context (General, Editor, Navigation)
- **Key display**: `<kbd>` elements with `bg-muted border rounded px-1.5 py-0.5 text-xs font-mono`

### Key Bindings to Document

| Shortcut | Action | Status |
|----------|--------|--------|
| `⌘/Ctrl + C` | Copy code (when editor focused) | ✅ Implemented |
| `⌘/Ctrl + Enter` | Toggle edit control (take/release) | ✅ Implemented |
| `?` | Show shortcuts panel | 🆕 New |
| `Esc` | Exit zen mode | ✅ Implemented |
| `Esc` | Close any open drawer/panel | ✅ Implemented |
| `⌘/Ctrl + K` | Command palette (future) | 🔮 Placeholder |
| `⌘/Ctrl + +` | Increase font size | 🆕 New |
| `⌘/Ctrl + -` | Decrease font size | 🆕 New |
| `⌘/Ctrl + B` | Toggle sidebar (future) | 🔮 Placeholder |

### Implementation
```tsx
// In EditorPageModern — keyboard listener
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !editingInput) {
      setShowShortcuts(true)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

### Tokens
| Element | Tokens |
|---------|--------|
| Panel | `bg-card border rounded-lg shadow-2xl` |
| Section header | `text-xs font-semibold text-muted-foreground uppercase tracking-wider` |
| Key badge | `bg-muted border text-muted-foreground text-xs font-mono px-1.5 py-0.5 rounded` |
| Row | `flex items-center justify-between py-1.5` |

---

## 8. Connection Status Indicator

### Current State
- Connected: 1.5px green dot (barely visible)
- Disconnected: amber pill with text
- No connecting state
- No detail on hover

### Proposed: Animated Status Indicator

#### States

**Connecting** (animated):
```
○  Connecting...
```
- Pulsing gray dot with `animate-ping` effect
- Text: "Connecting..." in `text-muted-foreground text-xs`
- Tooltip: "Establishing WebSocket connection to {url}"

**Connected**:
```
●  Connected
```
- Solid emerald dot (`bg-emerald-500`)
- No text needed (dot is sufficient for normal state)
- Tooltip: "Connected to {serverUrl} · Latency: {ping}ms"

**Disconnected / Reconnecting**:
```
◌  Reconnecting in 3s...
```
- Red dot with pulse animation
- Countdown timer visible
- Tooltip: "Connection lost. Attempting to reconnect... (attempt {n}/{max})"

#### Animation
```css
@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.status-connecting { animation: status-pulse 1.5s ease-in-out infinite; }
.status-disconnected { animation: status-pulse 1s ease-in-out infinite; }
```

#### Layout
The status indicator lives in Zone 1 (Identity) of the top bar, below the room ID pill:
```
[🔗 abc123... copy]
 you ● Connected
```

On mobile, only show the dot (no text) to save space.

### Tokens
| State | Dot Color | Text Color |
|-------|-----------|------------|
| Connecting | `bg-gray-400 animate-pulse` | `text-muted-foreground` |
| Connected | `bg-emerald-500` | `text-emerald-500` (only in tooltip) |
| Disconnected | `bg-red-500 animate-pulse` | `text-red-400` |

---

## 9. Invite Link

### Current Behavior
Clicking the room ID copies just the room ID string (e.g., `abc123-def-456`). Users must manually construct the URL.

### Proposed: One-Click Copy Invite Link

#### Room ID Pill Behavior
- **Click**: Copies the full invite URL to clipboard
- **Format**: `${window.location.origin}/editor/${roomId}`
- **Toast**: "Invite link copied! Share it with collaborators."
- **Visual feedback**: The pill briefly shows a checkmark icon (✓) for 1.5s after copy

#### Implementation
```tsx
const copyInviteLink = async () => {
  const link = `${window.location.origin}/editor/${roomId}`
  try {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success("Invite link copied!")
    setTimeout(() => setCopied(false), 1500)
  } catch {
    toast.error("Failed to copy link")
  }
}
```

#### Room ID Pill Visual States
```
Default:   [abc123...] 📋
Copied:    [abc123...] ✓  (for 1.5s)
```

The copy icon (`FaRegCopy`) is replaced with a check (`FiCheck`) when copied.

#### In Participants Drawer
The drawer footer has a `[Copy Invite Link]` button that does the same thing.

---

## 10. Theme Switcher Improvements

### Current State
- Select dropdown with text names only
- No visual preview of themes
- Import flow is a full modal with textarea, file input, preview/save buttons
- Mode toggle is a custom draggable track (complex, hard to use)

### Proposed: Visual Theme Picker

#### Dropdown with Color Swatches

```
┌──────────────────────────────────┐
│ 🎨 Themes              [×]       │
│ ──────────────────────────────── │
│                                  │
│  ○ System (auto)                 │
│  ● Dracula                        │
│  ○ GitHub Dark                   │
│  ○ Nord                          │
│  ○ One Dark Pro                  │
│  ○ T3 Chat                       │
│  ○ Cyberpunk                     │
│  ○ Glass Blue                    │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  🌙  Auto  ☀️                   │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│  + Import theme…                 │
└──────────────────────────────────┘
```

#### Theme Swatch Preview
Each theme row shows a small color swatch (3 dots) representing:
- Background color
- Primary/accent color  
- Foreground color

```tsx
function ThemeSwatch({ theme }: { theme: Theme }) {
  const tokens = isModernTheme(theme) ? theme.modes[theme.defaultMode] : theme.tokens
  return (
    <div className="flex gap-0.5">
      <span className="size-2.5 rounded-full" style={{ background: tokens.background }} />
      <span className="size-2.5 rounded-full" style={{ background: tokens.primary }} />
      <span className="size-2.5 rounded-full" style={{ background: tokens.foreground }} />
    </div>
  )
}
```

#### Mode Toggle
Replace the complex draggable track with a simple segmented control:
```
[ Auto ] [ Light ] [ Dark ]
```
- Uses shadcn `ToggleGroup` or simple button group
- Active state: `bg-primary text-primary-foreground`
- Inactive: `text-muted-foreground hover:text-foreground`

#### Import Flow Simplification
Keep the import modal but add:
- **Drag-and-drop zone** at the top (more intuitive than file input)
- **Live preview** as user types/pastes (side-by-side before/after)
- **One-click import from tweakcn**: Paste URL → auto-preview → Save

#### Layout Change
Move the theme switcher from the header (AppShell) to the editor page top bar (Zone 3 overflow menu) on the editor page. Keep it in the header on the home page.

**Rationale**: Theme switching is most useful in the editor where you can see the effect. On the home page, it's less critical.

### Tokens
| Element | Tokens |
|---------|--------|
| Theme row | `flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer` |
| Active theme | `bg-primary/10 text-primary` |
| Swatch dots | `size-2.5 rounded-full ring-1 ring-border` |
| Mode toggle | `bg-muted rounded-lg p-0.5 flex gap-0.5` |
| Mode button | `px-3 py-1 rounded-md text-xs font-medium transition-colors` |

---

## 11. Component Hierarchy Changes

### New Components to Create

```
src/components/
├── TopBar/
│   ├── TopBar.tsx              # Main top bar container
│   ├── IdentityZone.tsx        # Room ID + user + status
│   ├── PresenceZone.tsx        # Avatar stack + count
│   └── ActionsZone.tsx         # Tools + overflow menu
├── ParticipantsDrawer/
│   └── ParticipantsDrawer.tsx  # Slide-out drawer
├── ShortcutsPanel/
│   └── ShortcutsPanel.tsx      # Keyboard shortcuts modal
├── EmptyState/
│   └── EditorEmptyState.tsx    # Empty editor placeholder
├── ConnectionStatus/
│   └── ConnectionStatus.tsx    # Animated status indicator
└── TabBar/
    ├── TabBar.tsx              # Improved tab bar
    └── TabItem.tsx             # Individual tab with icon
```

### Modified Components

| Component | Changes |
|-----------|---------|
| `EditorPageModern.tsx` | Refactor to use new TopBar, add drawer/panel state, remove inline participants panel |
| `AppShell.tsx` | Remove theme switcher from header (move to editor) |
| `ThemeSwitcher.tsx` | Add swatch previews, simplify mode toggle |
| `ClientModern.tsx` | Add active tab display, follow indicator |
| `Editor.tsx` | Add presence layer (gutter dots) |

### Removed Code
- Inline participants overlay (replaced by drawer)
- Inline `PermissionsEditor` (moved into drawer)
- `showParticipants` state → replaced by drawer open state

---

## 12. Token Reference

### Spacing Tokens (Tailwind defaults)
| Token | Value | Usage |
|-------|-------|-------|
| `1` | 0.25rem | Tight gaps within groups |
| `1.5` | 0.375rem | Tab padding |
| `2` | 0.5rem | Standard gaps, drawer padding |
| `3` | 0.75rem | Section padding |
| `4` | 1rem | Drawer header/footer padding |
| `11` | 2.75rem | Top bar height (`h-11`) |

### Color Tokens (CSS Custom Properties)
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--background` | oklch(1 0 0) | oklch(0.145 0 0) | Page background |
| `--foreground` | oklch(0.145 0 0) | oklch(0.985 0 0) | Primary text |
| `--card` | oklch(1 0 0) | oklch(0.205 0 0) | Elevated surfaces (tabs, drawer) |
| `--card-foreground` | oklch(0.145 0 0) | oklch(0.985 0 0) | Text on card surfaces |
| `--primary` | oklch(0.205 0 0) | oklch(0.922 0 0) | Accent actions, active indicators |
| `--muted` | oklch(0.97 0 0) | oklch(0.269 0 0) | Subtle backgrounds |
| `--muted-foreground` | oklch(0.556 0 0) | oklch(0.708 0 0) | Secondary text |
| `--accent` | oklch(0.97 0 0) | oklch(0.269 0 0) | Hover states |
| `--border` | oklch(0.922 0 0) | oklch(1 0 0 / 10%) | Dividers, borders |
| `--destructive` | oklch(0.577 0.245 27.325) | oklch(0.704 0.191 22.216) | Errors, leave button |
| `--ring` | oklch(0.708 0 0) | oklch(0.556 0 0) | Focus rings |

### Semantic Status Colors
| Status | Token |
|--------|-------|
| Connected | `bg-emerald-500` / `text-emerald-500` |
| Connecting | `bg-gray-400` (animated) |
| Disconnected | `bg-red-500` (animated) |
| Owner | `bg-amber-400` / `text-amber-950` |
| Editor | `bg-emerald-400` / `text-emerald-950` |

### Radius Tokens
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | calc(var(--radius) - 4px) | Badges, swatches |
| `--radius-md` | calc(var(--radius) - 2px) | Buttons, inputs |
| `--radius-lg` | var(--radius) | Cards, panels |
| `--radius-xl` | calc(var(--radius) + 4px) | Modals |

---

## 13. Mobile Considerations

### Breakpoints
| Name | Width | Tailwind |
|------|-------|----------|
| Mobile | < 768px | default |
| Tablet | 768–1024px | `sm:` |
| Desktop | > 1024px | `lg:` |

### Mobile Layout Changes

#### Top Bar
- **Zone 1**: Room ID pill only (truncated to 8 chars), no username
- **Zone 2**: Hidden. Replaced by `[👥 N]` button in overflow.
- **Zone 3**: Only Copy + Edit buttons visible. Everything else in `⋯` menu.

#### Participants Drawer
- Full-width bottom sheet on mobile (slide up from bottom)
- `h-[70svh]` max height
- Drag handle at top for dismissal

#### Tab Bar
- Same horizontal scroll behavior
- Touch-friendly close buttons (always visible on active tab, `size-5` hit area)

#### Empty State
- Same centered layout, slightly smaller text

#### Keyboard Shortcuts Panel
- Full-width sheet on mobile (same as participants drawer)

### Touch Targets
All interactive elements must have minimum `size-44` (44×44px) touch target on mobile:
- Tab close buttons: `p-1` around `size-3` icon = `size-5` total
- Avatar stack: `size-8` (32px) minimum
- All buttons: `size="sm"` → `h-8` (32px) minimum

---

## 14. Accessibility Notes

### Focus Management
- **Drawer open**: Focus moves to drawer's close button. Tab navigation trapped within drawer.
- **Drawer close**: Focus returns to the trigger button (participant count).
- **Shortcuts panel**: Focus moves to panel on open. Escape closes.
- **All panels**: `focus-visible:ring-2 focus-visible:ring-ring` on all interactive elements.

### ARIA Attributes
| Component | Attributes |
|-----------|------------|
| TopBar | `role="banner"` |
| Participants Drawer | `role="dialog"`, `aria-label="Participants"`, `aria-hidden={!open}` |
| Shortcuts Panel | `role="dialog"`, `aria-label="Keyboard shortcuts"` |
| Tab Bar | `role="tablist"`, individual tabs `role="tab"`, `aria-selected` |
| Tab Item | `aria-label="Tab: {name}"`, close button `aria-label="Close {name}"` |
| Connection Status | `aria-live="polite"`, `aria-label="Connection status: {status}"` |
| Empty State | `aria-hidden="true"` (decorative) |

### Keyboard Navigation
- All interactive elements must be reachable via Tab
- Drawer/Panel content must be navigable via Tab (not trapping unless modal)
- Escape closes any open drawer/panel
- `?` opens shortcuts panel (only when not in a text input)

### Color Contrast
- All text must meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
- Status dots must not be the only indicator — always pair with text or icon
- Active tab indicator uses both color AND shape (bottom border)

### Reduced Motion
```tsx
// Respect prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Disable animations for: drawer slide, status pulse, empty state fade
```

### Screen Reader Announcements
- Connection status changes: `aria-live="polite"` region
- Participant join/leave: toast announcements (already implemented)
- Tab switch: Update `document.title` to include active tab name
- Copy actions: toast confirmation (already implemented)

---

## Appendix A: Migration Checklist

### Phase 1: Foundation
- [ ] Create `TopBar/` component directory
- [ ] Create `ParticipantsDrawer/` component
- [ ] Create `ShortcutsPanel/` component
- [ ] Create `EmptyState/` component
- [ ] Create `ConnectionStatus/` component
- [ ] Create `TabBar/` component

### Phase 2: Integration
- [ ] Refactor `EditorPageModern.tsx` to use new TopBar
- [ ] Replace participants overlay with drawer
- [ ] Add keyboard shortcuts panel
- [ ] Add empty state overlay
- [ ] Implement invite link copy
- [ ] Add connection status animations

### Phase 3: Polish
- [ ] Add file-type icons to tabs
- [ ] Add presence dots to editor gutter
- [ ] Improve theme switcher with swatches
- [ ] Add mobile bottom sheet variants
- [ ] Add reduced-motion support
- [ ] Final accessibility audit

### Phase 4: Testing
- [ ] Test all drawer/panel open/close flows
- [ ] Test keyboard navigation through all zones
- [ ] Test mobile layout at 375px width
- [ ] Test with screen reader (VoiceOver or NVDA)
- [ ] Test connection status transitions (simulate disconnect)
- [ ] Test theme switching with all presets

---

## Appendix B: Open Questions for Implementation

1. **Presence dots complexity**: Full CodeMirror gutter customization is complex. Decide whether to implement in v1 or use the simpler banner fallback.
2. **Invite link URL format**: Confirm the production domain (e.g., `https://codesync.app` vs current hosting). Use `window.location.origin` for flexibility.
3. **Theme switcher location**: Confirm whether to move it entirely from the header to the editor page, or keep in both.
4. **Font size shortcut binding**: `⌘/Ctrl +` and `⌘/Ctrl -` may conflict with browser zoom. Consider `⌘/Ctrl + Shift + >` instead, or document the conflict.
5. **Command palette placeholder**: Should the `⌘K` shortcut show a "Coming soon" toast or be hidden entirely until implemented?

---

*End of specification. For questions or clarifications, refer to the design rationale above or check the existing patterns in `src/components/ui/`.*
