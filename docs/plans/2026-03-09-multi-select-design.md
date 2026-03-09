# Multi-Select Tasks Design

GitHub Issue: #1 — Ability to select multiple tasks and perform actions

## Overview

Add Todoist-style multi-select to ThingsToDo: Cmd/Ctrl+Click to toggle individual tasks, Shift+Click for range selection, floating bulk action toolbar, multi-task drag & drop, and a single bulk API endpoint.

## 1. Selection Model (Frontend State)

### Store changes (`stores/app.ts`)

Wire existing infrastructure:
- `selectedTaskIds: Set<string>` — already defined, not connected to UI
- `toggleTaskSelection(id, multi)` — already defined, not called from click handlers
- `clearSelection()` — already defined, not wired to Escape/route changes

New state/actions:
- `lastSelectedTaskId: string | null` — anchor point for Shift+Click range
- `selectTaskRange(fromId, toId)` — queries all visible `[data-task-id]` elements in DOM order between anchor and target, adds them to `selectedTaskIds`

### Click handling (`SortableTaskItem`)

- **Cmd/Ctrl+Click**: `toggleTaskSelection(task.id, true)`, update `lastSelectedTaskId`
- **Shift+Click**: `selectTaskRange(lastSelectedTaskId, task.id)`
- **Plain click (selection active)**: Clear selection, then normal behavior
- **Plain click (no selection)**: Existing behavior unchanged

### Visual indicator

- Keep existing: `ring-2 ring-red-400 ring-inset rounded-lg`
- Add background tint: `bg-red-50 dark:bg-red-900/20`

### Selection clearing triggers

- Escape key
- Route navigation (in `AppLayout`)
- Destructive bulk actions remove affected tasks from set

## 2. Bulk API Endpoint (Backend)

### `POST /api/tasks/bulk`

Request:
```json
{
  "task_ids": ["abc123", "def456"],
  "action": "complete | cancel | wontdo | delete | set_when | set_deadline | set_priority | move_project | add_tags | remove_tags",
  "params": {
    "when_date": "2026-03-10",
    "when_time": "09:00",
    "deadline": "2026-03-15",
    "priority": 1,
    "project_id": "proj123",
    "tag_ids": ["tag1", "tag2"]
  }
}
```

Response: `{ "ok": true, "affected": 3 }`

### Implementation

- New `HandleBulkAction` in `internal/handler/tasks.go`
- Single SQLite transaction wrapping all mutations
- Validates all task IDs exist before executing; rolls back on any invalid ID (400 response)
- Each action maps to existing repository methods (`Complete()`, `Update()`, etc.)
- Broadcasts single SSE `bulk_change` event: `{ type: action, entity: "task", ids: [...] }`
- `set_when` with value `"someday"` maps to existing someday sentinel
- Same JWT/API-key auth middleware as other task endpoints

## 3. Floating Bulk Action Toolbar

### Component: `BulkActionToolbar`

Renders when `selectedTaskIds.size > 0`.

### Position & style

- `fixed bottom-6 left-1/2 -translate-x-1/2`, high z-index
- Rounded pill, inverted theme (`bg-neutral-900 dark:bg-neutral-100`) for contrast
- Shadow for elevation
- Framer Motion slide-up on appear, slide-down on disappear

### Layout (left to right)

1. **Selection count**: "3 selected" + X button to clear
2. **Divider**
3. **Action icons** (with tooltips):
   - Calendar — Set when (popover: Today / This Evening / Tomorrow / Someday / Pick date)
   - Flag — Set deadline (date picker popover)
   - Folder — Move to project (popover: areas > projects tree)
   - Tag — Assign tags (popover: tag list with checkboxes)
   - CircleAlert — Set priority (toggle)
   - CheckCircle — Complete (immediate)
   - CircleMinus — Cancel (immediate)
   - CircleX — Won't Do (immediate)
   - Trash2 — Delete (immediate, brief confirmation)

### Popover behavior

- Anchor to icon, open upward
- Action fires bulk mutation, closes popover
- Selection stays active after non-destructive actions (for chaining)
- Destructive actions (complete/cancel/wontdo/delete) remove affected tasks from selection

### Mobile

Full-width at bottom, larger touch targets.

## 4. Multi-Task Drag & Drop

### Activation

Drag a task that is in `selectedTaskIds` → multi-drag. Drag an unselected task → solo drag (existing behavior).

### Drag overlay

- Top card: the dragged task (normal appearance)
- Behind: slightly offset shadow card
- Corner badge: count of dragged tasks

### Drop targets

- **Same list reorder**: Insert all selected tasks as contiguous block at drop position. Uses existing `POST /api/tasks/reorder` (already accepts array).
- **Sidebar project/area**: `POST /api/tasks/bulk` with `action: "move_project"`
- **Sidebar tag**: `POST /api/tasks/bulk` with `action: "add_tags"`
- **Sidebar Today/Someday/etc.**: `POST /api/tasks/bulk` with `action: "set_when"`

### AppDndContext changes

- `onDragStart`: Check if dragged task is in `selectedTaskIds`. If yes, track `draggedTaskIds` (full set). If no, single-task behavior.
- `onDragEnd`: Branch on `draggedTaskIds.size > 1`.
- Optimistic: Update all affected tasks via existing `updateTaskInCache`.

### Constraint

Multi-task reorder only within a single list/section. Cross-section drops to sidebar targets still work.

## 5. Keyboard Shortcuts & Accessibility

### New shortcuts

- **Escape**: Clear selection (priority over closing detail panel — first Escape clears selection, second closes detail)
- **Cmd/Ctrl+A**: Select all visible tasks (when focus is in task list, not input)

### Existing shortcuts when multi-selected

- **Arrow keys**: Navigate cursor, don't change selection
- **Space/Enter**: Disabled (ambiguous with multiple tasks)
- **Delete/Backspace**: Bulk delete with confirmation

### Accessibility

- `aria-selected="true"` on selected tasks
- Toolbar: `role="toolbar"`, `aria-label="Bulk actions for N tasks"`
- Action buttons: descriptive `aria-label`
- Selection count: `aria-live="polite"` region
- Tab into toolbar from list, Tab out returns to list
- Popovers trap focus while open

## 6. Cache & Optimistic Updates

### `useBulkAction()` hook

Calls `POST /api/tasks/bulk`, handles optimistic updates and rollback.

### Optimistic strategy

- **Status changes** (complete/cancel/wontdo): Departing animation on all affected tasks simultaneously, then remove from cache
- **Property updates** (when, deadline, priority, project, tags): `updateTaskInCache` for each task — updates `['views']`, `['projects']`, `['areas']`, `['tags']` caches
- **Error**: Roll back all, show toast

### Deferred invalidation

Follows existing pattern: defer when `expandedTaskId` or `departingTaskId` is set. Destructive bulk actions set `departingTaskIds` array, wait 800ms, force-invalidate.

### SSE sync

Wire existing `bulk_change` SSE listener to invalidate affected queries (cross-tab/device sync).

### Selection cleanup after mutation

- Destructive (complete/cancel/wontdo/delete): Remove affected IDs from `selectedTaskIds`
- Non-destructive (move/tag/date/priority): Keep selection for chaining

## Existing Infrastructure

Already in place:
- `selectedTaskIds: Set<string>`, `toggleTaskSelection()`, `clearSelection()` in Zustand store
- Red ring visual on `SortableTaskItem` reading `selectedTaskIds`
- `[data-task-id]` DOM attributes for keyboard nav (reusable for range selection)
- `bulk_change` SSE event broadcast by backend on reorder
- `POST /api/tasks/reorder` accepting array of items
- `updateTaskInCache` for optimistic view/project/area/tag cache updates
- Departing animation + deferred invalidation pattern
