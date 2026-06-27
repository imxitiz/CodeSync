# Editor workspace UX notes

## Decision

The editor route should behave like a bounded workspace, not a document page:

- The page itself must not scroll during normal desktop editor use.
- Scrolling belongs inside focused surfaces only (editor content, tab rail overflow, participant drawer body).
- Tabs and the code canvas should read as one connected editing surface, not as separate cards.
- Participant controls should use compact inline actions and theme tokens rather than isolated button columns.
- Follow mode must be explicit: when a viewer follows someone, manual tab switching is blocked with clear feedback and a visible way to turn follow off.

## Rationale

CodeSync is a real-time editor. A page-level scrollbar makes the working canvas feel unstable and hides the relationship between tabs, presence, permissions, and code. Keeping the workspace inside the viewport preserves spatial memory for owners, active editors, and viewers.

## Trade-offs

- A bounded workspace requires internal overflow management for dense data.
- The participant drawer is intentionally scrollable because room membership can grow beyond the viewport.
- The layout favors editor stability over showing every control at maximum size.

## Rejected alternatives

- Separate card for toolbar + separate card for tabs + separate editor card: too compartmentalized for an editing workflow.
- Full-page participant modal: interrupts the editor and feels heavier than a room side sheet.
- Silent follow-mode tab lock: confusing; users need visible state and a turn-off affordance.
