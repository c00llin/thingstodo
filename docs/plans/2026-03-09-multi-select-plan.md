# Multi-Select Tasks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Todoist-style multi-select with bulk actions, floating toolbar, and multi-task drag & drop.

**Architecture:** Extend existing Zustand store selection state, add `POST /api/tasks/bulk` backend endpoint wrapping existing repository methods in a transaction, build a floating `BulkActionToolbar` component with action popovers, and extend `AppDndContext` for multi-task drag.

**Tech Stack:** Go/Chi (backend), React 19 + Zustand + TanStack Query (frontend), dnd-kit, Framer Motion, Tailwind CSS 4, Radix UI

**Design Doc:** `docs/plans/2026-03-09-multi-select-design.md`

---

## Task 1: Backend — Bulk Action Repository Method

**Files:**
- Modify: `internal/repository/tasks.go:366-384` (after Reorder method)
- Modify: `internal/model/task.go` (add BulkActionInput type)

**Step 1: Add BulkActionInput model**

In `internal/model/task.go`, add after existing input types:

```go
type BulkActionInput struct {
	TaskIDs   []string               `json:"task_ids"`
	Action    string                 `json:"action"`
	Params    map[string]interface{} `json:"params"`
}
```

**Step 2: Add BulkAction repository method**

In `internal/repository/tasks.go`, add after `Reorder()` (line ~384):

```go
func (r *TaskRepository) BulkAction(input model.BulkActionInput) (int, error) {
	tx, err := r.db.Begin()
	if err != nil {
		return 0, err
	}
	defer func() { _ = tx.Rollback() }()

	affected := 0
	now := "datetime('now')"

	for _, id := range input.TaskIDs {
		var execErr error
		switch input.Action {
		case "complete":
			_, execErr = tx.Exec(
				"UPDATE tasks SET status = 'completed', completed_at = "+now+", updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "cancel":
			_, execErr = tx.Exec(
				"UPDATE tasks SET status = 'canceled', canceled_at = "+now+", updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "wontdo":
			_, execErr = tx.Exec(
				"UPDATE tasks SET status = 'wont_do', updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "delete":
			_, execErr = tx.Exec(
				"UPDATE tasks SET deleted_at = "+now+", updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", id)
		case "set_when":
			whenDate, _ := input.Params["when_date"].(string)
			whenTime, _ := input.Params["when_time"].(string)
			_, execErr = tx.Exec(
				"UPDATE tasks SET when_date = ?, start_time = ?, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL",
				nilIfEmpty(whenDate), nilIfEmpty(whenTime), id)
		case "set_deadline":
			deadline, _ := input.Params["deadline"].(string)
			_, execErr = tx.Exec(
				"UPDATE tasks SET deadline = ?, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL",
				nilIfEmpty(deadline), id)
		case "set_priority":
			priority, _ := input.Params["priority"].(float64)
			p := int(priority)
			_, execErr = tx.Exec(
				"UPDATE tasks SET priority = ?, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL", p, id)
		case "move_project":
			projectID, _ := input.Params["project_id"].(string)
			_, execErr = tx.Exec(
				"UPDATE tasks SET project_id = ?, updated_at = "+now+" WHERE id = ? AND deleted_at IS NULL",
				nilIfEmpty(projectID), id)
		case "add_tags":
			tagIDs, ok := input.Params["tag_ids"].([]interface{})
			if ok {
				for _, rawTagID := range tagIDs {
					tagID, _ := rawTagID.(string)
					if tagID != "" {
						_, execErr = tx.Exec(
							"INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?, ?)", id, tagID)
						if execErr != nil {
							break
						}
					}
				}
			}
		case "remove_tags":
			tagIDs, ok := input.Params["tag_ids"].([]interface{})
			if ok {
				for _, rawTagID := range tagIDs {
					tagID, _ := rawTagID.(string)
					if tagID != "" {
						_, execErr = tx.Exec(
							"DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?", id, tagID)
						if execErr != nil {
							break
						}
					}
				}
			}
		default:
			return 0, fmt.Errorf("unknown bulk action: %s", input.Action)
		}
		if execErr != nil {
			return 0, execErr
		}
		affected++
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return affected, nil
}

func nilIfEmpty(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
```

**Step 3: Run tests**

Run: `go test ./internal/repository/... -v`
Expected: Existing tests pass (no new tests yet — tested via handler in Task 2)

**Step 4: Commit**

```bash
git add internal/repository/tasks.go internal/model/task.go
git commit -m "feat: add BulkAction repository method for multi-select"
```

---

## Task 2: Backend — Bulk Action Handler & Route

**Files:**
- Modify: `internal/handler/tasks.go:346` (after Reorder handler)
- Modify: `internal/router/router.go:133` (after reorder route)
- Modify: `docs/api.md` (add bulk endpoint documentation)

**Step 1: Write bulk handler test**

Create: `internal/handler/tasks_bulk_test.go`

```go
package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBulkAction_Complete(t *testing.T) {
	// Use existing test setup pattern from the handler package
	// Create 2 tasks, bulk complete them, verify both are completed
	srv := setupTestServer(t)

	// Create tasks
	task1 := createTestTask(t, srv, "Task 1")
	task2 := createTestTask(t, srv, "Task 2")

	body, _ := json.Marshal(map[string]interface{}{
		"task_ids": []string{task1.ID, task2.ID},
		"action":   "complete",
	})

	req := httptest.NewRequest("POST", "/api/tasks/bulk", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["affected"] != float64(2) {
		t.Fatalf("expected 2 affected, got %v", resp["affected"])
	}
}

func TestBulkAction_InvalidAction(t *testing.T) {
	srv := setupTestServer(t)

	body, _ := json.Marshal(map[string]interface{}{
		"task_ids": []string{"abc"},
		"action":   "explode",
	})

	req := httptest.NewRequest("POST", "/api/tasks/bulk", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", w.Code)
	}
}
```

Note: Adapt test setup to match existing test patterns in the handler package. If no test infrastructure exists, write integration-style tests or skip to manual testing.

**Step 2: Write bulk handler**

In `internal/handler/tasks.go`, add after `Reorder()` (line ~346):

```go
func (h *TaskHandler) BulkAction(w http.ResponseWriter, r *http.Request) {
	var input model.BulkActionInput
	if err := decodeJSON(r, &input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON", "BAD_REQUEST")
		return
	}
	if len(input.TaskIDs) == 0 {
		writeError(w, http.StatusBadRequest, "task_ids required", "BAD_REQUEST")
		return
	}
	if len(input.TaskIDs) > 100 {
		writeError(w, http.StatusBadRequest, "maximum 100 tasks per bulk action", "BAD_REQUEST")
		return
	}

	// Validate action
	validActions := map[string]bool{
		"complete": true, "cancel": true, "wontdo": true, "delete": true,
		"set_when": true, "set_deadline": true, "set_priority": true,
		"move_project": true, "add_tags": true, "remove_tags": true,
	}
	if !validActions[input.Action] {
		writeError(w, http.StatusBadRequest, "invalid action: "+input.Action, "BAD_REQUEST")
		return
	}

	// For status-changing actions, cleanup schedules
	if input.Action == "complete" || input.Action == "cancel" || input.Action == "wontdo" {
		for _, id := range input.TaskIDs {
			h.cleanupSchedules(id)
		}
	}

	affected, err := h.repo.BulkAction(input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error(), "INTERNAL")
		return
	}

	// Notify scheduler for completed/canceled/wontdo tasks
	if h.scheduler != nil && (input.Action == "complete" || input.Action == "cancel" || input.Action == "wontdo") {
		for _, id := range input.TaskIDs {
			h.scheduler.HandleTaskDone(id)
		}
	}

	h.broker.BroadcastJSON("bulk_change", map[string]interface{}{
		"type":   input.Action,
		"entity": "task",
		"ids":    input.TaskIDs,
	})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":       true,
		"affected": affected,
	})
}
```

**Step 3: Register the route**

In `internal/router/router.go`, add after line 133 (`r.Patch("/tasks/reorder", taskH.Reorder)`):

```go
r.Post("/tasks/bulk", taskH.BulkAction)
```

**Step 4: Run backend tests**

Run: `go test ./... -v`
Expected: All tests pass

**Step 5: Update API docs**

In `docs/api.md`, add after the reorder endpoint documentation:

```markdown
### Bulk Action

`POST /api/tasks/bulk`

Perform an action on multiple tasks in a single transaction.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| task_ids | string[] | yes | Array of task IDs (max 100) |
| action | string | yes | One of: complete, cancel, wontdo, delete, set_when, set_deadline, set_priority, move_project, add_tags, remove_tags |
| params | object | no | Action-specific parameters (see below) |

**Action parameters:**

| Action | Params |
|--------|--------|
| set_when | `when_date` (string), `when_time` (string, optional) |
| set_deadline | `deadline` (string) |
| set_priority | `priority` (number, 0 or 1) |
| move_project | `project_id` (string or null) |
| add_tags | `tag_ids` (string[]) |
| remove_tags | `tag_ids` (string[]) |

**Response:** `{ "ok": true, "affected": 3 }`

**SSE:** Broadcasts `bulk_change` event with `{ type, entity: "task", ids }`.
```

Also update the `bulk_change` SSE event types list to include the new action types.

**Step 6: Commit**

```bash
git add internal/handler/tasks.go internal/router/router.go docs/api.md
git commit -m "feat: add POST /api/tasks/bulk endpoint for multi-select actions"
```

---

## Task 3: Frontend — Selection Store & Click Handlers

**Files:**
- Modify: `frontend/src/stores/app.ts:55-58,181-195`
- Modify: `frontend/src/components/SortableTaskItem.tsx:53,72,168-175,266`

**Step 1: Extend the store with range selection**

In `frontend/src/stores/app.ts`, update the interface (after line 58):

```typescript
// Add to AppStore interface after clearSelection
lastSelectedTaskId: string | null
selectTaskRange: (fromId: string | null, toId: string) => void
```

In the store implementation (after line 195, before the closing `})`):

```typescript
lastSelectedTaskId: null,
selectTaskRange: (fromId, toId) =>
  set((s) => {
    if (!fromId) {
      return { selectedTaskIds: new Set([toId]), lastSelectedTaskId: toId }
    }
    const allTaskEls = Array.from(
      document.querySelectorAll<HTMLElement>('[data-task-id]'),
    )
    const ids = allTaskEls.map((el) => el.dataset.taskId!)
    const fromIdx = ids.indexOf(fromId)
    const toIdx = ids.indexOf(toId)
    if (fromIdx === -1 || toIdx === -1) {
      return { selectedTaskIds: new Set([toId]), lastSelectedTaskId: toId }
    }
    const start = Math.min(fromIdx, toIdx)
    const end = Math.max(fromIdx, toIdx)
    const rangeIds = ids.slice(start, end + 1)
    const next = new Set(s.selectedTaskIds)
    for (const id of rangeIds) next.add(id)
    return { selectedTaskIds: next, lastSelectedTaskId: toId }
  }),
```

Also update `toggleTaskSelection` to track `lastSelectedTaskId`:

Replace lines 182-194 with:

```typescript
toggleTaskSelection: (id, multi) =>
  set((s) => {
    if (multi) {
      const next = new Set(s.selectedTaskIds)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return { selectedTaskIds: next, lastSelectedTaskId: id }
    }
    return { selectedTaskIds: new Set([id]), lastSelectedTaskId: id }
  }),
```

**Step 2: Update SortableTaskItem click handler**

In `frontend/src/components/SortableTaskItem.tsx`, update the click handler (lines 168-175):

```typescript
function handleClick(e: React.MouseEvent) {
  // Shift+Click: range select
  if (e.shiftKey) {
    e.preventDefault()
    selectTaskRange(lastSelectedTaskId, task.id)
    return
  }
  // Cmd/Ctrl+Click: toggle multi-select
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    toggleTaskSelection(task.id, true)
    return
  }
  // Plain click while multi-selected: clear selection, then normal behavior
  if (selectedTaskIds.size > 0) {
    clearSelection()
  }
  selectTask(task.id, entryId)
}
```

Add the missing store reads near line 53:

```typescript
const toggleTaskSelection = useAppStore((s) => s.toggleTaskSelection)
const clearSelection = useAppStore((s) => s.clearSelection)
const lastSelectedTaskId = useAppStore((s) => s.lastSelectedTaskId)
const selectTaskRange = useAppStore((s) => s.selectTaskRange)
```

**Step 3: Add background tint to multi-selected tasks**

In `SortableTaskItem.tsx`, update line 266 to include a background:

```typescript
className={`group/item ${isMultiSelected ? 'ring-2 ring-red-400 ring-inset rounded-lg bg-red-50 dark:bg-red-900/20' : ''}`}
```

**Step 4: Test manually**

Run: `cd frontend && npm run dev`
- Cmd+Click tasks → should toggle red ring + tint
- Shift+Click → should select range between last and current
- Plain click → should clear selection and resume normal behavior

**Step 5: Commit**

```bash
git add frontend/src/stores/app.ts frontend/src/components/SortableTaskItem.tsx
git commit -m "feat: wire multi-select click handlers (Cmd+Click, Shift+Click)"
```

---

## Task 4: Frontend — Escape & Route Clear, Keyboard Shortcuts

**Files:**
- Modify: `frontend/src/hooks/useKeyboardShortcuts.ts:197-205`
- Modify: `frontend/src/components/AppLayout.tsx:47-52`

**Step 1: Update Escape handler**

In `frontend/src/hooks/useKeyboardShortcuts.ts`, replace the Escape handler (lines 197-205):

```typescript
useHotkeys('escape', (e) => {
  if (isFocusInFilterBar()) return
  e.preventDefault()
  const { selectedTaskIds, clearSelection } = useAppStore.getState()
  if (selectedTaskIds.size > 0) {
    clearSelection()
    return
  }
  if (expandedTaskId) {
    closeModal()
  } else if (selectedTaskId) {
    selectTask(null)
  }
}, { enabled: !!expandedTaskId || !!selectedTaskId || useAppStore.getState().selectedTaskIds.size > 0 })
```

Note: The `enabled` condition needs to be reactive. Since `selectedTaskIds` is a Set, you may need to read `selectedTaskIds.size` from the store in the component body and include it in `enabled`. Check how other hotkeys handle dynamic enables.

**Step 2: Add Cmd+A shortcut**

Add a new hotkey in the same file:

```typescript
useHotkeys('mod+a', (e) => {
  // Only select all if not focused in an input/textarea
  const active = document.activeElement
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) {
    return
  }
  e.preventDefault()
  const allTaskEls = document.querySelectorAll<HTMLElement>('[data-task-id]')
  const ids = new Set<string>()
  allTaskEls.forEach((el) => {
    if (el.dataset.taskId) ids.add(el.dataset.taskId)
  })
  useAppStore.setState({ selectedTaskIds: ids, lastSelectedTaskId: null })
})
```

**Step 3: Update route change handler**

In `frontend/src/components/AppLayout.tsx`, update the route change effect (lines 47-52) to also clear multi-selection:

```typescript
useEffect(() => {
  closeModal()
  useAppStore.setState({
    selectedTaskId: null,
    selectedScheduleEntryId: null,
    filterBarOpen: false,
    selectedTaskIds: new Set(),
    lastSelectedTaskId: null,
  })
  useFilterStore.getState().clearAll()
}, [location.pathname, closeModal])
```

**Step 4: Test manually**

- Cmd+Click a few tasks → Escape → selection should clear
- Navigate to different page → selection should clear
- Cmd+A → all visible tasks selected
- Cmd+A while in search input → normal text select-all (not task select)

**Step 5: Commit**

```bash
git add frontend/src/hooks/useKeyboardShortcuts.ts frontend/src/components/AppLayout.tsx
git commit -m "feat: Escape clears multi-select, Cmd+A selects all, route clears selection"
```

---

## Task 5: Frontend — Bulk API Client & Mutation Hook

**Files:**
- Modify: `frontend/src/api/tasks.ts` (add bulkAction function)
- Modify: `frontend/src/api/types.ts` (add BulkActionRequest type)
- Create: `frontend/src/hooks/useBulkAction.ts`

**Step 1: Add types**

In `frontend/src/api/types.ts`, add:

```typescript
export interface BulkActionRequest {
  task_ids: string[]
  action: 'complete' | 'cancel' | 'wontdo' | 'delete' | 'set_when' | 'set_deadline' | 'set_priority' | 'move_project' | 'add_tags' | 'remove_tags'
  params?: {
    when_date?: string
    when_time?: string
    deadline?: string
    priority?: number
    project_id?: string | null
    tag_ids?: string[]
  }
}

export interface BulkActionResponse {
  ok: boolean
  affected: number
}
```

**Step 2: Add API function**

In `frontend/src/api/tasks.ts`, add:

```typescript
import type { BulkActionRequest, BulkActionResponse } from './types'

export function bulkAction(data: BulkActionRequest) {
  return api.post<BulkActionResponse>('/tasks/bulk', data)
}
```

**Step 3: Create mutation hook**

Create `frontend/src/hooks/useBulkAction.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bulkAction } from '../api/tasks'
import type { BulkActionRequest } from '../api/types'
import { forceInvalidateViewQueries } from './queries'
import { useAppStore } from '../stores/app'

const DESTRUCTIVE_ACTIONS = new Set(['complete', 'cancel', 'wontdo', 'delete'])

export function useBulkAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkActionRequest) => bulkAction(data),
    onSuccess: (_data, variables) => {
      const { selectedTaskIds } = useAppStore.getState()

      if (DESTRUCTIVE_ACTIONS.has(variables.action)) {
        // Remove affected tasks from selection
        const next = new Set(selectedTaskIds)
        for (const id of variables.task_ids) next.delete(id)
        useAppStore.setState({ selectedTaskIds: next })
      }

      // Force invalidate all view queries
      forceInvalidateViewQueries(queryClient)
    },
  })
}
```

**Step 4: Test manually**

No UI yet — this will be wired in Task 6. Verify the hook compiles:

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

**Step 5: Commit**

```bash
git add frontend/src/api/tasks.ts frontend/src/api/types.ts frontend/src/hooks/useBulkAction.ts
git commit -m "feat: add bulk action API client and useBulkAction mutation hook"
```

---

## Task 6: Frontend — BulkActionToolbar Component

**Files:**
- Create: `frontend/src/components/BulkActionToolbar.tsx`
- Modify: `frontend/src/components/AppLayout.tsx` (render toolbar)

**Step 1: Create the toolbar component**

Create `frontend/src/components/BulkActionToolbar.tsx`:

```tsx
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar, Flag, FolderOpen, Tag, CircleAlert,
  CheckCircle, CircleMinus, CircleX, Trash2, X,
} from 'lucide-react'
import { useAppStore } from '../stores/app'
import { useBulkAction } from '../hooks/useBulkAction'

export function BulkActionToolbar() {
  const selectedTaskIds = useAppStore((s) => s.selectedTaskIds)
  const clearSelection = useAppStore((s) => s.clearSelection)
  const count = selectedTaskIds.size
  const bulk = useBulkAction()

  function handleAction(action: string, params?: Record<string, unknown>) {
    bulk.mutate({
      task_ids: Array.from(selectedTaskIds),
      action: action as any,
      params,
    })
  }

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div
            role="toolbar"
            aria-label={`Bulk actions for ${count} tasks`}
            className="flex items-center gap-1 rounded-full bg-neutral-900 px-4 py-2 text-white shadow-2xl dark:bg-neutral-100 dark:text-neutral-900"
          >
            {/* Selection count */}
            <span className="mr-2 text-sm font-medium tabular-nums">
              {count} selected
            </span>
            <button
              onClick={clearSelection}
              className="mr-1 rounded-full p-1 hover:bg-white/10 dark:hover:bg-black/10"
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>

            <div className="mx-1 h-5 w-px bg-white/20 dark:bg-black/20" />

            {/* TODO: Replace immediate actions with popovers for date/project/tag pickers in Task 7 */}
            <ToolbarButton icon={Calendar} label="Set when" onClick={() => handleAction('set_when', { when_date: new Date().toISOString().slice(0, 10) })} />
            <ToolbarButton icon={Flag} label="Set deadline" onClick={() => {/* popover in Task 7 */}} />
            <ToolbarButton icon={FolderOpen} label="Move to project" onClick={() => {/* popover in Task 7 */}} />
            <ToolbarButton icon={Tag} label="Assign tags" onClick={() => {/* popover in Task 7 */}} />
            <ToolbarButton icon={CircleAlert} label="Toggle priority" onClick={() => handleAction('set_priority', { priority: 1 })} />

            <div className="mx-1 h-5 w-px bg-white/20 dark:bg-black/20" />

            <ToolbarButton icon={CheckCircle} label="Complete" onClick={() => handleAction('complete')} />
            <ToolbarButton icon={CircleMinus} label="Cancel" onClick={() => handleAction('cancel')} />
            <ToolbarButton icon={CircleX} label="Won't do" onClick={() => handleAction('wontdo')} />
            <ToolbarButton icon={Trash2} label="Delete" onClick={() => handleAction('delete')} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full p-2 hover:bg-white/10 dark:hover:bg-black/10"
      aria-label={label}
      title={label}
    >
      <Icon size={16} />
    </button>
  )
}
```

**Step 2: Render in AppLayout**

In `frontend/src/components/AppLayout.tsx`, import and render the toolbar:

```typescript
import { BulkActionToolbar } from './BulkActionToolbar'
```

Add `<BulkActionToolbar />` inside the layout, after the main content area (before the closing fragment or wrapper div).

**Step 3: Test manually**

Run: `cd frontend && npm run dev`
- Cmd+Click 3 tasks → floating bar appears at bottom with "3 selected"
- Click Complete → tasks complete, removed from selection
- Click X → selection clears, bar disappears
- Escape → bar disappears

**Step 4: Commit**

```bash
git add frontend/src/components/BulkActionToolbar.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat: add BulkActionToolbar floating component with basic actions"
```

---

## Task 7: Frontend — Toolbar Popovers (When, Deadline, Project, Tags)

**Files:**
- Modify: `frontend/src/components/BulkActionToolbar.tsx`

This task replaces the placeholder `onClick` handlers with proper Radix UI popovers.

**Step 1: Add "Set When" popover**

Replace the Calendar toolbar button with a Radix `Popover` containing quick-pick buttons:

```tsx
import * as Popover from '@radix-ui/react-popover'
import { addDays, format } from 'date-fns'

// Inside BulkActionToolbar:
<Popover.Root>
  <Popover.Trigger asChild>
    <button className="rounded-full p-2 hover:bg-white/10 dark:hover:bg-black/10" aria-label="Set when" title="Set when">
      <Calendar size={16} />
    </button>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content side="top" sideOffset={8} className="z-50 rounded-lg bg-white p-2 shadow-lg dark:bg-neutral-800">
      <div className="flex flex-col gap-1 text-sm">
        <button className="rounded px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => { handleAction('set_when', { when_date: format(new Date(), 'yyyy-MM-dd') }); }}>
          Today
        </button>
        <button className="rounded px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => { handleAction('set_when', { when_date: format(new Date(), 'yyyy-MM-dd'), when_time: '18:00' }); }}>
          This Evening
        </button>
        <button className="rounded px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => { handleAction('set_when', { when_date: format(addDays(new Date(), 1), 'yyyy-MM-dd') }); }}>
          Tomorrow
        </button>
        <button className="rounded px-3 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => { handleAction('set_when', { when_date: 'someday' }); }}>
          Someday
        </button>
      </div>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
```

**Step 2: Add "Set Deadline" popover**

Similar pattern with a date input:

```tsx
<Popover.Root>
  <Popover.Trigger asChild>
    <button className="..." aria-label="Set deadline" title="Set deadline"><Flag size={16} /></button>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content side="top" sideOffset={8} className="z-50 rounded-lg bg-white p-2 shadow-lg dark:bg-neutral-800">
      <input
        type="date"
        className="rounded border px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-700"
        onChange={(e) => {
          if (e.target.value) handleAction('set_deadline', { deadline: e.target.value })
        }}
      />
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
```

**Step 3: Add "Move to Project" popover**

Use existing project/area data from TanStack Query:

```tsx
// Fetch projects and areas with useQuery
// Render a tree: Area → Projects underneath
// On click: handleAction('move_project', { project_id })
// Include "No project" option: handleAction('move_project', { project_id: null })
```

Reuse existing hooks — check `frontend/src/hooks/queries.ts` for `useAreas()` and `useProjects()` patterns.

**Step 4: Add "Assign Tags" popover**

```tsx
// Fetch tags with useQuery
// Render as checkboxes (clicking toggles add_tags or remove_tags)
// Each click is an independent bulk action call
```

Reuse existing tag query hooks.

**Step 5: Test manually**

Run: `cd frontend && npm run dev`
- Click Calendar icon → popover with Today/Evening/Tomorrow/Someday
- Click "Today" → all selected tasks get today's date
- Click Flag → date picker appears, pick a date → deadline set
- Click Folder → project tree, click project → tasks moved
- Click Tag → tag list, click tag → tag added

**Step 6: Commit**

```bash
git add frontend/src/components/BulkActionToolbar.tsx
git commit -m "feat: add popovers for when/deadline/project/tag bulk actions"
```

---

## Task 8: Frontend — Multi-Task Drag & Drop

**Files:**
- Modify: `frontend/src/components/AppDndContext.tsx:154,175-189,191-512,523`
- Modify: `frontend/src/components/TaskItemDragOverlay.tsx`
- Modify: `frontend/src/stores/app.ts` (add draggedTaskIds state if needed)

**Step 1: Track multi-drag state in AppDndContext**

In `AppDndContext.tsx`, add state alongside `activeTask` (line ~154):

```typescript
const [draggedTaskIds, setDraggedTaskIds] = useState<Set<string>>(new Set())
```

**Step 2: Update onDragStart**

In `handleDragStart` (lines 175-189), check if dragged task is in `selectedTaskIds`:

```typescript
function handleDragStart(event: DragStartEvent) {
  const { active } = event
  // ... existing logic to find activeTask ...

  const { selectedTaskIds } = useAppStore.getState()
  if (task && selectedTaskIds.has(task.id) && selectedTaskIds.size > 1) {
    setDraggedTaskIds(new Set(selectedTaskIds))
  } else {
    setDraggedTaskIds(new Set())
  }

  // ... rest of existing logic ...
}
```

**Step 3: Update onDragEnd for sidebar drops**

In `handleDragEnd` (lines 191-512), for sidebar drop targets, branch on `draggedTaskIds.size > 1`:

```typescript
// When dropping multiple tasks on a sidebar target:
if (draggedTaskIds.size > 1) {
  const ids = Array.from(draggedTaskIds)

  if (overId starts with 'sidebar-project-') {
    bulkAction({ task_ids: ids, action: 'move_project', params: { project_id: projectId } })
  } else if (overId starts with 'sidebar-tag-') {
    bulkAction({ task_ids: ids, action: 'add_tags', params: { tag_ids: [tagId] } })
  } else if (overId === 'sidebar-today') {
    bulkAction({ task_ids: ids, action: 'set_when', params: { when_date: todayStr } })
  }
  // ... etc for other sidebar targets

  setDraggedTaskIds(new Set())
  return
}
```

**Step 4: Update onDragEnd for same-list reorder**

For multi-task reorder within same list, calculate positions for all dragged tasks as a contiguous block:

```typescript
if (draggedTaskIds.size > 1) {
  // Get all tasks in current list, remove dragged ones, insert them at drop position
  // Calculate fractional positions for each inserted task
  // Call reorderTasks() with the full array
}
```

**Step 5: Update drag overlay**

In `TaskItemDragOverlay.tsx`, accept a `count` prop:

```tsx
interface TaskItemDragOverlayProps {
  task: Task
  count?: number  // number of tasks being dragged
}

export function TaskItemDragOverlay({ task, count = 1 }: TaskItemDragOverlayProps) {
  return (
    <div className="relative">
      {count > 1 && (
        <>
          {/* Stacked card behind */}
          <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
          {/* Count badge */}
          <div className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {count}
          </div>
        </>
      )}
      {/* Existing task overlay content */}
      <div className="relative rounded-lg bg-white shadow-lg dark:bg-neutral-800">
        {/* ... existing render ... */}
      </div>
    </div>
  )
}
```

In `AppDndContext.tsx`, pass `count={draggedTaskIds.size}` to the overlay (line ~523).

**Step 6: Test manually**

Run: `cd frontend && npm run dev`
- Select 3 tasks with Cmd+Click → drag one → all 3 drag with stacked overlay + badge "3"
- Drop on sidebar project → all 3 move
- Drop on sidebar tag → all 3 tagged
- Drag unselected task → single drag (existing behavior)
- Multi-drag reorder within list → tasks reorder as block

**Step 7: Commit**

```bash
git add frontend/src/components/AppDndContext.tsx frontend/src/components/TaskItemDragOverlay.tsx
git commit -m "feat: multi-task drag & drop with stacked overlay and bulk sidebar drops"
```

---

## Task 9: Frontend — Departing Animations for Bulk Destructive Actions

**Files:**
- Modify: `frontend/src/hooks/useBulkAction.ts`
- Modify: `frontend/src/components/SortableTaskItem.tsx` (departing state)

**Step 1: Add departing animation support**

The existing pattern uses `departingTaskId` for single tasks. Extend for multiple:

In `frontend/src/stores/app.ts`, add to interface and implementation:

```typescript
departingTaskIds: Set<string>
setDepartingTaskIds: (ids: Set<string>) => void
```

**Step 2: Update useBulkAction for animated destructive actions**

In `frontend/src/hooks/useBulkAction.ts`:

```typescript
export function useBulkAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkActionRequest) => bulkAction(data),
    onMutate: (variables) => {
      if (DESTRUCTIVE_ACTIONS.has(variables.action)) {
        // Set departing animation on all affected tasks
        useAppStore.setState({
          departingTaskIds: new Set(variables.task_ids),
        })
      }
    },
    onSuccess: (_data, variables) => {
      const { selectedTaskIds } = useAppStore.getState()

      if (DESTRUCTIVE_ACTIONS.has(variables.action)) {
        // Remove from selection
        const next = new Set(selectedTaskIds)
        for (const id of variables.task_ids) next.delete(id)
        useAppStore.setState({ selectedTaskIds: next })

        // Wait for animation, then force invalidate
        setTimeout(() => {
          useAppStore.setState({ departingTaskIds: new Set() })
          forceInvalidateViewQueries(queryClient)
        }, 800)
      } else {
        forceInvalidateViewQueries(queryClient)
      }
    },
  })
}
```

**Step 3: Read departingTaskIds in SortableTaskItem**

In `SortableTaskItem.tsx`, alongside existing `departingTaskId` logic, also check `departingTaskIds`:

```typescript
const departingTaskIds = useAppStore((s) => s.departingTaskIds)
const isDeparting = departingTaskId === task.id || departingTaskIds.has(task.id)
```

Use `isDeparting` for the existing fade-out / slide-out animation class.

**Step 4: Test manually**

- Select 3 tasks → click Complete → all 3 animate out simultaneously → removed from list after 800ms

**Step 5: Commit**

```bash
git add frontend/src/stores/app.ts frontend/src/hooks/useBulkAction.ts frontend/src/components/SortableTaskItem.tsx
git commit -m "feat: departing animations for bulk destructive actions"
```

---

## Task 10: Frontend — Accessibility & Final Polish

**Files:**
- Modify: `frontend/src/components/SortableTaskItem.tsx` (aria-selected)
- Modify: `frontend/src/components/BulkActionToolbar.tsx` (aria-live, focus management)
- Modify: `frontend/src/hooks/useKeyboardShortcuts.ts` (disable Space/Enter when multi-selected)

**Step 1: Add aria-selected to task items**

In `SortableTaskItem.tsx`, add to the task row element:

```typescript
aria-selected={isMultiSelected || undefined}
```

**Step 2: Add aria-live region for selection count**

In `BulkActionToolbar.tsx`, wrap the count in an aria-live region:

```tsx
<span aria-live="polite" className="mr-2 text-sm font-medium tabular-nums">
  {count} selected
</span>
```

**Step 3: Disable Space/Enter when multi-selected**

In `useKeyboardShortcuts.ts`, add a guard to the Space and Enter handlers:

```typescript
// In Space handler (lines 174-184):
if (useAppStore.getState().selectedTaskIds.size > 1) return

// In Enter handler (lines 187-194):
if (useAppStore.getState().selectedTaskIds.size > 1) return
```

**Step 4: Add Delete/Backspace bulk delete**

In `useKeyboardShortcuts.ts`, update the Delete handler (lines 255-271) to support bulk:

```typescript
// If multi-selected, trigger bulk delete
const { selectedTaskIds } = useAppStore.getState()
if (selectedTaskIds.size > 1) {
  // Trigger bulk delete (import and call useBulkAction or dispatch via event)
  return
}
```

Note: Since hooks can't easily call mutation hooks, consider using a global event or exposing the bulk action via the store. Alternative: add a `pendingBulkDelete` flag to the store that `BulkActionToolbar` watches and executes.

**Step 5: Run linters**

Run: `cd frontend && npm run lint && npx tsc --noEmit`
Expected: No errors

**Step 6: Run tests**

Run: `cd frontend && npm test`
Run: `go test ./... -v`
Expected: All pass

**Step 7: Commit**

```bash
git add frontend/src/components/SortableTaskItem.tsx frontend/src/components/BulkActionToolbar.tsx frontend/src/hooks/useKeyboardShortcuts.ts
git commit -m "feat: accessibility and keyboard polish for multi-select"
```

---

## Task 11: Integration Testing & SSE Sync

**Files:**
- Modify: `frontend/src/hooks/useSSE.ts` (wire bulk_change handler)

**Step 1: Wire SSE bulk_change to query invalidation**

Find the SSE event handler in `useSSE.ts` and add handling for `bulk_change`:

```typescript
case 'bulk_change': {
  const data = JSON.parse(event.data)
  if (data.entity === 'task') {
    forceInvalidateViewQueries(queryClient)
    queryClient.invalidateQueries({ queryKey: ['tags'] })
  }
  break
}
```

**Step 2: End-to-end manual test**

Open two browser tabs. In tab 1:
1. Cmd+Click 3 tasks
2. Click "Complete" in toolbar
3. Verify tab 2 updates via SSE

Test each action type:
- Complete, Cancel, Won't Do, Delete
- Set when (Today, Tomorrow, Someday)
- Set deadline
- Move to project
- Add/remove tags
- Set priority
- Multi-drag to sidebar

**Step 3: Commit**

```bash
git add frontend/src/hooks/useSSE.ts
git commit -m "feat: wire SSE bulk_change event for cross-tab sync"
```

---

## Summary

| Task | What | Backend | Frontend |
|------|------|---------|----------|
| 1 | Bulk repository method | `repository/tasks.go` | - |
| 2 | Bulk handler + route | `handler/tasks.go`, `router.go` | - |
| 3 | Selection store + clicks | - | `stores/app.ts`, `SortableTaskItem` |
| 4 | Escape/route/Cmd+A | - | `useKeyboardShortcuts`, `AppLayout` |
| 5 | API client + hook | - | `api/tasks.ts`, `useBulkAction.ts` |
| 6 | Floating toolbar | - | `BulkActionToolbar.tsx`, `AppLayout` |
| 7 | Toolbar popovers | - | `BulkActionToolbar.tsx` |
| 8 | Multi-task DnD | - | `AppDndContext`, `TaskItemDragOverlay` |
| 9 | Departing animations | - | `useBulkAction`, `SortableTaskItem` |
| 10 | A11y + keyboard polish | - | Various |
| 11 | SSE sync | - | `useSSE.ts` |

Tasks 1-2 are backend (can be done first or in parallel with frontend).
Tasks 3-7 are the core frontend flow (sequential).
Tasks 8-11 are enhancements (can be parallelized after 3-7).
