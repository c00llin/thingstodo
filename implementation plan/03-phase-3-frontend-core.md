# Phase 3 — Frontend Core

**Goal:** Build the complete React UI with all smart list views, task CRUD, sidebar navigation, inline detail view, and state management. No DnD or animations yet — those are Phase 4.

---

## 3.1 App Shell & Layout

### Component Structure

```
App.tsx
├── QueryClientProvider (TanStack Query)
├── Router
│   └── AppLayout
│       ├── Sidebar
│       │   ├── SmartListNav (Inbox, Today, Upcoming, Anytime, Someday, Logbook)
│       │   ├── AreaList
│       │   │   └── ProjectList (per area)
│       │   └── TagList
│       ├── MainContent
│       │   └── <Route-based view component>
│       └── QuickEntryDialog (cmdk — Phase 4)
```

### Routes

| Path | Component | View |
|---|---|---|
| `/` | Redirect to `/inbox` | — |
| `/inbox` | `InboxView` | Inbox |
| `/today` | `TodayView` | Today + This Evening |
| `/upcoming` | `UpcomingView` | Date-grouped calendar |
| `/anytime` | `AnytimeView` | Area-grouped |
| `/someday` | `SomedayView` | Deferred items |
| `/logbook` | `LogbookView` | Completed tasks |
| `/project/:id` | `ProjectView` | Project with headings |
| `/area/:id` | `AreaView` | Area detail |
| `/tag/:id` | `TagView` | Tasks with tag |
| `/task/:slug` | `TaskPermalinkView` | Deep link → opens task |
| `/login` | `LoginView` | Auth (built-in mode only) |

---

## 3.2 Sidebar

### SmartListNav

Vertical list of smart list items with:
- Icon (Lucide) + label + unread count badge
- Active state highlighting
- Keyboard navigation: `Alt+1` through `Alt+6`

### AreaList

- Collapsible area sections
- Each area shows its projects nested below
- Projects show completion indicator (filled/empty circle based on progress)
- "Add Project" inline at bottom of each area
- "Add Area" at bottom of sidebar

### TagList

- Collapsible tag section at bottom of sidebar
- Visual nesting for parent/child tags
- Click to filter by tag

---

## 3.3 API Client Layer

**File:** `frontend/src/api/client.ts`

```typescript
const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // send httpOnly cookie
    ...options,
  });
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}
```

**Per-entity API files:**

```
frontend/src/api/
├── client.ts          # Base fetch wrapper
├── tasks.ts           # listTasks, getTask, createTask, updateTask, deleteTask, completeTask, ...
├── projects.ts        # listProjects, getProject, createProject, ...
├── areas.ts           # listAreas, createArea, ...
├── tags.ts            # listTags, createTag, ...
├── checklist.ts       # listChecklist, createChecklistItem, toggleChecklistItem, ...
├── attachments.ts     # listAttachments, uploadAttachment, addLink, deleteAttachment, ...
├── views.ts           # getInbox, getToday, getUpcoming, getAnytime, getSomeday, getLogbook
├── search.ts          # search(query)
└── auth.ts            # login, logout, getMe
```

---

## 3.4 TanStack Query Hooks

**File:** `frontend/src/hooks/queries.ts` (or split per entity)

### Query Keys Convention

```typescript
export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    detail: (id: string) => ['tasks', id] as const,
    checklist: (id: string) => ['tasks', id, 'checklist'] as const,
    attachments: (id: string) => ['tasks', id, 'attachments'] as const,
  },
  projects: {
    all: ['projects'] as const,
    detail: (id: string) => ['projects', id] as const,
  },
  areas: { all: ['areas'] as const },
  tags: { all: ['tags'] as const },
  views: {
    inbox: ['views', 'inbox'] as const,
    today: ['views', 'today'] as const,
    upcoming: ['views', 'upcoming'] as const,
    anytime: ['views', 'anytime'] as const,
    someday: ['views', 'someday'] as const,
    logbook: ['views', 'logbook'] as const,
  },
};
```

### Example Query Hook

```typescript
export function useInbox() {
  return useQuery({
    queryKey: queryKeys.views.inbox,
    queryFn: () => views.getInbox(),
  });
}
```

### Mutation Hooks (with optimistic updates in Phase 4)

```typescript
export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasks.completeTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.views.today });
      queryClient.invalidateQueries({ queryKey: queryKeys.views.inbox });
    },
  });
}
```

---

## 3.5 Zustand Store (Client State)

**File:** `frontend/src/stores/app.ts`

Manages UI-only state that doesn't go to the server:

```typescript
interface AppStore {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Task detail panel
  selectedTaskId: string | null;
  selectTask: (id: string | null) => void;

  // Quick entry
  quickEntryOpen: boolean;
  openQuickEntry: () => void;
  closeQuickEntry: () => void;
}
```

---

## 3.6 Shared UI Components

### TaskItem

The fundamental list item used everywhere:

```
┌──────────────────────────────────────────────┐
│ ○  Task title                    #tag  Mar 5 │
│    Project Name                               │
└──────────────────────────────────────────────┘
```

- Checkbox (Radix Checkbox, styled)
- Title text
- Tag chips (optional)
- When date / deadline indicators (optional)
- Project breadcrumb (when shown outside project context)
- Click to expand inline detail

### TaskDetail (Inline Expansion)

Expands below the TaskItem in-place:

```
┌──────────────────────────────────────────────┐
│ ☑  Task title                                │
│                                               │
│  Notes: (editable markdown area)             │
│                                               │
│  When: [date picker]    Deadline: [date]     │
│  Tags: [tag1] [tag2] [+ add]                │
│  Project: [dropdown]                          │
│                                               │
│  Checklist:                                   │
│    ☐ Step 1                                   │
│    ☑ Step 2                                   │
│    [+ Add item]                               │
│                                               │
│  Attachments:                                 │
│    📎 document.pdf (2.3 MB)                   │
│    🔗 https://example.com                     │
│    [+ Add file] [+ Add link]                 │
│                                               │
│  Repeat: Weekly on Fridays                   │
└──────────────────────────────────────────────┘
```

- All fields are inline-editable
- Save on blur / Enter
- Escape collapses the detail

### TaskGroup

Container with a section header (heading title, date, project name) and a list of TaskItems. Used by all views.

### Other Shared Components

| Component | Purpose |
|---|---|
| `DatePicker` | Radix Popover + calendar for When/Deadline |
| `TagSelect` | Multi-select tag dropdown (Radix Select) |
| `ProjectSelect` | Single-select project dropdown |
| `ChecklistEditor` | Inline checklist with add/toggle/delete |
| `AttachmentList` | File + link list with upload/add |
| `EmptyState` | Illustrated placeholder for empty views |
| `Badge` | Count badge for sidebar items |

---

## 3.7 View Components

### InboxView

- Flat list of `TaskItem` components
- No grouping, minimal chrome
- Type-to-create: focus the "New task" input at top
- Shows tasks with no project, no area, no when_date

### TodayView

- Two sections: "Today" and "This Evening"
- Within each section, tasks grouped by source project (with project header)
- Tasks with deadline = today show a deadline indicator

### UpcomingView

- Left: scrollable date-grouped task list (each date is a `TaskGroup`)
- Right (or top): mini calendar widget for navigation
- Clicking a date scrolls/filters the list

### AnytimeView

- Tasks grouped by Area → then by Project
- Each area is a collapsible section
- Within each area, projects are subsections
- Standalone tasks (area but no project) shown separately

### SomedayView

- Same grouping as Anytime but filtered to someday-deferred items

### LogbookView

- Reverse-chronological, grouped by completion date
- Each group shows date header + completed tasks
- Status indicator: completed (checkmark), canceled (strikethrough), won't do (x)

### ProjectView

- Project header: title, notes, progress bar (X of Y tasks)
- Tasks grouped by headings (each heading is a `TaskGroup`)
- Tasks with no heading shown at top
- "Add Heading" button
- "Complete Project" button when all tasks done

### AreaView

- Area title
- List of projects (with progress indicators)
- Standalone tasks in this area

---

## 3.8 Implementation Order

1. **API client + types** — fetch wrapper, TypeScript interfaces matching API responses
2. **TanStack Query setup** — provider, query hooks for all view endpoints
3. **AppLayout + Sidebar** — navigation shell, routing
4. **TaskItem + TaskDetail** — core reusable components
5. **InboxView** — simplest view, proves task CRUD works end-to-end
6. **TodayView** — introduces sections/grouping
7. **ProjectView** — introduces headings, progress
8. **UpcomingView** — introduces date grouping + calendar widget
9. **AnytimeView + SomedayView** — area/project grouping
10. **LogbookView** — historical view
11. **AreaView + TagView** — remaining detail views
12. **LoginView** — auth flow (conditional on AUTH_MODE)
13. **Zustand store** — client-only UI state

---

## Phase 3 Completion Criteria

- [ ] All 8 smart list views render correctly with data from the API
- [ ] Sidebar navigation works with active state and counts
- [ ] Tasks can be created, edited, completed, canceled from the UI
- [ ] Inline task detail expands/collapses
- [ ] Checklist items can be added/toggled/deleted
- [ ] Attachments can be uploaded (files) and added (links)
- [ ] Projects show heading-grouped tasks with progress
- [ ] Tag filtering works
- [ ] Login flow works in built-in auth mode
- [ ] Task permalinks (`/task/:slug`) resolve correctly
