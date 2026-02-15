# Phase 4 — Polish & Advanced Features

**Goal:** Add the UX features that make ThingsToDo feel like Things 3: drag-and-drop, animations, keyboard shortcuts, quick entry, real-time sync, search, and natural language date input.

---

## 4.1 Drag and Drop (@dnd-kit)

### Library Setup

- `@dnd-kit/core` — base DnD engine
- `@dnd-kit/sortable` — sortable list presets
- `@dnd-kit/utilities` — CSS transform utilities

### DnD Scenarios

| Interaction | Source | Target | Backend Action |
|---|---|---|---|
| Reorder tasks in list | TaskItem | Same list | `PATCH /api/tasks/reorder` |
| Move task to project | TaskItem | Sidebar project | `PATCH /api/tasks/:id` (set project_id) |
| Move task to area | TaskItem | Sidebar area | `PATCH /api/tasks/:id` (set area_id) |
| Move task to Today | TaskItem | Sidebar "Today" | `PATCH /api/tasks/:id` (set when_date=today) |
| Move task to Someday | TaskItem | Sidebar "Someday" | `PATCH /api/tasks/:id` (set someday flag) |
| Move task to heading | TaskItem | Heading divider | `PATCH /api/tasks/:id` (set heading_id) |
| Schedule via Upcoming | TaskItem | Calendar date | `PATCH /api/tasks/:id` (set when_date) |
| Multi-select drag | Multiple TaskItems | Any target | Batch update |
| Reorder headings | Heading | Same project | `PATCH /api/headings/reorder` |
| Reorder projects | ProjectItem | Sidebar | `PATCH /api/projects/reorder` |

### Implementation Details

- Use `SortableContext` for within-list reordering
- Use `DndContext` with custom collision detection for cross-container drops (task → sidebar)
- `DragOverlay` shows a ghost preview of the dragged item(s)
- Multi-select: Cmd+click or Shift+click to select multiple tasks, then drag the selection
- On drop: optimistically update position, send `PATCH /api/tasks/reorder` with new positions
- Fractional position calculation: new position = (before.position + after.position) / 2

### Keyboard DnD

@dnd-kit supports keyboard-driven reordering (Space to pick up, arrows to move, Space to drop). Essential for accessibility.

---

## 4.2 Animations (framer-motion)

### Task Completion Animation

```tsx
<motion.div
  layout
  exit={{ opacity: 0, height: 0, transition: { duration: 0.3, delay: 0.8 } }}
>
  <TaskItem />
</motion.div>
```

- Checkbox fill animation (SVG path draw)
- 800ms delay before the completed task fades out and collapses (allows undo)
- Remaining tasks slide up smoothly via `layout` animation

### List Reorder Animation

- `<AnimatePresence>` wrapping task lists
- `layout` prop on each `TaskItem` — framer-motion auto-animates position changes
- Spring physics for natural feel: `transition: { type: "spring", stiffness: 300, damping: 30 }`

### Inline Detail Expand/Collapse

```tsx
<motion.div
  initial={{ height: 0, opacity: 0 }}
  animate={{ height: "auto", opacity: 1 }}
  exit={{ height: 0, opacity: 0 }}
  transition={{ type: "spring", stiffness: 400, damping: 35 }}
/>
```

### Sidebar Transitions

- Area/project sections collapse/expand with height animation
- Active item indicator slides between items

### Drag Animation

- Picked-up item: subtle scale + shadow increase
- Drop target highlight: background color fade-in
- Item settling: spring-based position animation

---

## 4.3 Keyboard Shortcuts (react-hotkeys-hook)

### Global Shortcuts

| Key | Action |
|---|---|
| `Ctrl+Space` | Open Quick Entry dialog |
| `Alt+N` | New task in current view |
| `Alt+F` | Focus search |
| `Alt+1` | Navigate to Inbox |
| `Alt+2` | Navigate to Today |
| `Alt+3` | Navigate to Upcoming |
| `Alt+4` | Navigate to Anytime |
| `Alt+5` | Navigate to Someday |
| `Alt+6` | Navigate to Logbook |
| `?` | Show keyboard shortcut help |

### Task-Scoped Shortcuts (when task is selected/focused)

| Key | Action |
|---|---|
| `Enter` | Open/close inline detail |
| `Alt+K` | Complete task |
| `Alt+Shift+K` | Cancel task |
| `Alt+T` | Move to Today |
| `Alt+E` | Move to This Evening |
| `Alt+S` | Open date picker (When) |
| `Alt+Shift+S` | Move to Someday |
| `Alt+Shift+D` | Set deadline |
| `Alt+Shift+T` | Add tags |
| `Alt+Shift+M` | Move to project |
| `Delete` / `Backspace` | Delete task |
| `↑` / `↓` | Navigate between tasks |

### Implementation

- `useHotkeys` from `react-hotkeys-hook` for each shortcut
- Shortcuts are disabled when a text input is focused (except Ctrl+Space and Escape)
- Context-aware: task shortcuts only active when a task is selected
- Help overlay (`?`) shows all shortcuts in a modal

---

## 4.4 Quick Entry (cmdk)

### Command Palette for Quick Capture

- Triggered by `Ctrl+Space` — opens even when app isn't focused (requires Electron/Tauri for global; web-only opens within the app)
- Full task creation: title, project, dates, tags
- Natural language date parsing in the date field

### Quick Entry UI

```
┌─────────────────────────────────────────────┐
│  ☐  Buy groceries for dinner               │
│                                              │
│  📅 Today        🏷 #personal               │
│  📁 Meal Prep    ⏰ Friday                  │
│                                              │
│  [Create Task]                 [Esc to close]│
└─────────────────────────────────────────────┘
```

### Also: Quick Find

- `Alt+F` opens command palette in search mode
- Type to search tasks (FTS5)
- Results appear as-you-type
- Select result to navigate to task

### Implementation

- `cmdk` library provides the command palette shell
- Custom input fields for project, date, tags inside the palette
- `POST /api/tasks` on submit, then invalidate relevant queries

---

## 4.5 Real-Time Sync (SSE)

### EventSource Hook

**File:** `frontend/src/hooks/useSSE.ts`

```typescript
export function useSSE() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource('/api/events');

    source.addEventListener('task_updated', (e) => {
      const { id } = JSON.parse(e.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.views.today });
      queryClient.invalidateQueries({ queryKey: queryKeys.views.inbox });
      // ... invalidate relevant views
    });

    source.addEventListener('task_created', () => {
      queryClient.invalidateQueries({ queryKey: ['views'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    });

    // ... handlers for all event types

    source.onerror = () => {
      // EventSource auto-reconnects. Log for debugging.
    };

    return () => source.close();
  }, [queryClient]);
}
```

- Initialize in `App.tsx` (always connected)
- Events trigger targeted query invalidation (not full refetch)
- Auto-reconnect built into the EventSource API
- Tab visibility: pause/resume SSE when tab is hidden/visible

### Optimistic Mutations

Upgrade TanStack Query mutations to optimistic:

```typescript
export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasks.completeTask(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.views.today });
      const previous = queryClient.getQueryData(queryKeys.views.today);
      // Optimistically mark task as completed in cache
      queryClient.setQueryData(queryKeys.views.today, (old) =>
        updateTaskInView(old, id, { status: 'completed' })
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      queryClient.setQueryData(queryKeys.views.today, context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.views.today });
    },
  });
}
```

---

## 4.6 Full-Text Search

### Search UI

- `Alt+F` opens search overlay (cmdk in search mode)
- Debounced input → `GET /api/search?q=...`
- Results show task title, notes snippet with highlights, project breadcrumb
- Click result to navigate to task (opens inline detail in the task's view)

### Search Implementation

- Frontend: debounced search query via TanStack Query
- Backend: SQLite FTS5 `MATCH` query with `bm25()` ranking and `snippet()` for excerpts

---

## 4.7 Natural Language Dates

### Parser

**File:** `frontend/src/lib/date-parser.ts`

Parse human-readable date strings into ISO dates:

| Input | Output |
|---|---|
| `today` | Current date |
| `tomorrow` | +1 day |
| `next week` | Next Monday |
| `friday` | Coming Friday |
| `in 3 days` | +3 days |
| `next month` | 1st of next month |
| `jan 15` | January 15 (next occurrence) |
| `this evening` | Today + evening flag |

### Integration

- Date input fields in task detail and quick entry show parsed suggestions as you type
- Dropdown below the input with the parsed date and original text
- Use `date-fns` for date math

---

## 4.8 Type-to-Create

When a list view is focused and the user starts typing (without a text input focused):
- Automatically create a new task inline at the top of the list
- Pre-fill the title with the typed characters
- Focus the title input for continued typing
- On Enter: save task, return focus to list
- On Escape: cancel creation

---

## 4.9 Repeating Tasks UI

### In Task Detail

- "Repeat" field shows current repeat rule (or "None")
- Click to open repeat picker:
  - Frequency: Daily, Weekly, Monthly, Yearly
  - Interval: Every N [frequency]
  - Mode: Fixed schedule / After completion
  - Day constraints: specific days (for weekly)
- Display: "Every 2 weeks on Mon, Wed, Fri" / "3 days after completion"

### Behavior on Completion

- When completing a task with a repeat rule, show a brief toast: "Next: [date]"
- The next instance is created automatically (backend handles this)
- Early completion is allowed — no blocking before scheduled date

---

## 4.10 Theming

### Dark/Light Mode

- CSS custom properties for all colors
- Respect `prefers-color-scheme` by default
- Manual toggle in settings
- Tailwind CSS `dark:` variants

### Accent Colors

- Per-project accent color (optional)
- Stored in project model
- Applied to project header and associated tasks

---

## Implementation Order

1. **Keyboard shortcuts** — least visual dependency, immediately improves UX
2. **Optimistic mutations** — upgrade existing mutation hooks
3. **SSE real-time sync** — connect EventSource, wire up invalidation
4. **Drag-and-drop** — task reordering within lists first, then cross-container
5. **Animations** — completion, list reorder, expand/collapse
6. **Quick entry (cmdk)** — command palette for capture
7. **Search** — search overlay with FTS5
8. **Natural language dates** — date parser + suggestions
9. **Type-to-create** — inline task creation
10. **Repeating tasks UI** — repeat picker component
11. **Theming** — dark mode + accent colors

---

## Phase 4 Completion Criteria

- [ ] Tasks can be reordered via drag-and-drop within any list
- [ ] Tasks can be dragged to sidebar items (Today, Someday, projects)
- [ ] Task completion has a satisfying checkbox animation with delay before removal
- [ ] List items animate smoothly when reordering or when items are added/removed
- [ ] All keyboard shortcuts work and are documented in a help overlay
- [ ] Quick Entry creates tasks from anywhere in the app
- [ ] SSE sync updates all open tabs/devices within seconds
- [ ] Search returns results with highlighted snippets
- [ ] Natural language dates parse correctly in date inputs
- [ ] Type-to-create works in all list views
- [ ] Repeating tasks can be configured and complete correctly
- [ ] Dark mode works
