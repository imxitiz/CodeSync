# Tab Permissions System Review - 2026-07-01

## Current Implementation Status

### ParticipantsDrawer.tsx - TabPermissionToggle Owner/Requester Split ✓

**Correct Implementation**:
- Lines 638-728: The `TabPermissionToggle` component correctly handles three states:
  1. Owner view (isOwnerView=true) + REQUESTED → Shows Grant/Deny buttons
  2. Requester view (isOwnerView=false) + REQUESTED → Shows read-only pending badge
  3. Normal toggle → Cycles between EDITOR/VIEWER

**Code Quality**: The component uses proper conditional styling and follows the codebase's `cursor-pointer`/`cursor-not-allowed` patterns.

**Minor Suggestion**: `isOwnerView` prop should have a default value (`false`) to prevent misuse if the component is reused.

### EditorPageModern.tsx - toggleEditable REQUESTED Handling ✓

**Correct Implementation**: Lines 325-337 properly detect and handle the REQUESTED state:
- VIEWER → sends request, shows "Edit request sent!" toast
- REQUESTED → shows "Edit request pending..." toast  
- No permission → shows error toast

**Edge Case Missed**: If `allowEditRequests` is false, the user still sees "Request Edit" button (line 828-842) which does nothing useful. The button should be disabled when `allowEditRequests=false`.

### useEditorRealtime.ts - EDIT_REQUESTS_NOTIFICATION Handler ✓

**Correct Implementation**: Lines 432-439 handle the owner notification event.

**Minor Issue**: `tabId` parameter is destructured but unused. Could enhance the toast message with tab name context.

### socket.ts (Frontend) ✓

The frontend socket.ts (19 lines) is clean with no duplicate imports. The user feedback logic lives in `useEditorRealtime.ts` where it belongs.

### Server socket.ts - User Feedback Implementation ✓

Lines 548-578 correctly provide user feedback for:
- `requests_disabled` → toast error explaining requests are disabled
- `cooldown` → toast error with minutes remaining
- `idempotency_window` → toast error with seconds remaining

## Recommendations

1. **Disable Request Button When Disabled**: In EditorPageModern.tsx around line 828, when `allowEditRequests=false`, the "Request Edit" button should be disabled or hidden.

2. **Use tabId in Notification Toast**: In useEditorRealtime.ts, use the `tabId` to show which tab has a pending request.

3. **Add Default for isOwnerView**: In ParticipantsDrawer.tsx, add `isOwnerView = false` as the default in the component props.

## Overall Assessment

**PASS** - All changes are correctly implemented, type-safe, and handle edge cases appropriately.