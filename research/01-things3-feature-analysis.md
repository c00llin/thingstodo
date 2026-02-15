# Things 3 Feature & UX Analysis

## Core Features

### Smart Lists (Sidebar)

| List | Purpose |
|---|---|
| **Inbox** | Default capture point. No date, no project — just collect. Tasks sit here until processed. |
| **Today** | Tasks scheduled for today + tasks whose deadlines are today. Split into "Today" and "This Evening" sections. |
| **Upcoming** | Calendar-style forward view. Tasks grouped by date with a mini calendar widget for navigation. |
| **Anytime** | All active tasks (not Someday, not completed). Grouped by Area/Project. |
| **Someday** | Intentionally deferred tasks and projects. Hidden from Today/Anytime to reduce clutter. |
| **Logbook** | Completed and canceled tasks, organized by completion date. |
| **Trash** | Deleted items, recoverable until emptied. |

### Organizational Entities

- **Areas of Responsibility**: Top-level categories (e.g., "Work", "Personal"). NOT completable — they represent ongoing life areas. No due dates.
- **Projects**: Completable collections of tasks with a clear outcome. Can belong to an Area. Have deadlines, When dates, and show progress (X of Y tasks done).
- **Tasks (To-Dos)**: The atomic unit. Can exist standalone, in a project, or in an area.
- **Headings**: Section dividers within a project (e.g., "Phase 1", "Phase 2"). Project-scoped only.
- **Checklist Items**: Lightweight sub-steps within a task. Just title + checkbox — no dates, tags, or notes.
- **Tags**: Flat labels applied to tasks/projects. Can be visually nested in sidebar for organization, but filtering is flat.

### Task Properties

- Title (required)
- Notes (rich text, supports Markdown links)
- **When date** (scheduled date — when you *intend* to work on it)
- **Deadline** (hard due date — distinct from When)
- Tags (multiple)
- Checklist items
- Attachments (files and links — *extension beyond Things 3*)
- Repeating schedule
- Unique permalink (shareable deep link to task — *extension beyond Things 3*)
- Status: Open | Completed | Canceled | Won't Do
- Manual sort order (position integer, per-context)

### Repeating Tasks

Two modes:
- **Fixed schedule**: Repeats on exact dates regardless of completion
- **After completion**: Next instance appears N days after previous one is completed

Frequencies: daily, weekly, specific days, monthly, yearly, custom intervals.

### Early completion of recurring tasks (*improvement over Things 3*)

In Things 3, you cannot complete a recurring task before its scheduled date — it only appears on or after the "When" date, forcing you to wait. This is a known pain point.

**Our approach:** Recurring tasks can be completed at any time, regardless of their scheduled date. When completed early:
- **Fixed schedule**: The next instance still appears on its originally scheduled date (the schedule is date-anchored, not completion-anchored)
- **After completion**: The next instance is calculated from the actual completion date as usual

This means if you have a weekly task scheduled for Friday but finish it on Wednesday, you can mark it done immediately. No artificial blocking.

---

## Key UX Patterns

### Quick Entry
- Global hotkey (Ctrl+Space) opens floating quick-entry from anywhere, even when app isn't focused
- Supports full task creation: title, notes, dates, tags, checklist, project assignment
- Natural language date input
- Tasks go to Inbox by default unless project specified

### Natural Language Dates
- "today", "tomorrow", "next week", "Friday", "in 3 days", "next month", "this evening"
- Dropdown shows parsed date suggestions as you type

### Keyboard Shortcuts (Critical for UX)

| Action | Shortcut |
|---|---|
| New To-Do | Alt+N |
| Quick Entry | Ctrl+Space |
| Complete task | Alt+K |
| Cancel task | Alt+Shift+K |
| Move to Today | Alt+T |
| Move to Evening | Alt+E |
| Set date (Upcoming) | Alt+S |
| Move to Someday | Alt+Shift+S |
| Set Deadline | Alt+Shift+D |
| Add Tags | Alt+Shift+T |
| Move to Project | Alt+Shift+M |
| Open task details | Enter |
| Navigate sidebar | Alt+1 through Alt+6 |
| Search | Alt+F |

### Drag and Drop
- Reorder tasks within lists (manual sort order preserved)
- Drag tasks to sidebar items (projects, areas, Today, Someday)
- Drag onto Upcoming calendar to schedule
- Multi-select (Cmd+click, Shift+click) for bulk drag operations
- Physics-based animation during drag

### Inline Detail View
- Tasks expand in-place to reveal notes, checklist, metadata — not a modal or separate page
- Clicking outside or Escape collapses
- Avoids context-switching — user stays in the list

### Completion Animation
- Satisfying checkbox fill animation
- Brief delay before task disappears from list (allowing undo)

### Type-to-Create
- Start typing in any list view to create a new task immediately

### "This Evening" Concept
- Within Today view, tasks can be flagged for "This Evening"
- Creates a two-section Today view (morning/evening split)
- Not a time — a conceptual division of the day

---

## Data Model

```
Area (ongoing, not completable)
  ├── has many Projects
  └── has many standalone Tasks

Project (completable, has progress)
  ├── belongs to 0..1 Area
  ├── has many Tasks
  ├── has many Headings
  ├── has 0+ Tags
  ├── has 0..1 When date
  └── has 0..1 Deadline

Task / To-Do
  ├── belongs to 0..1 Project
  ├── belongs to 0..1 Area (if not in a project)
  ├── belongs to 0..1 Heading (within a project)
  ├── has 0+ Tags (many-to-many)
  ├── has 0+ Checklist Items
  ├── has 0+ Attachments (files and links)
  ├── has 0..1 When date
  ├── has 0..1 Deadline
  ├── has 0..1 Repeat Rule
  ├── has unique slug/ID for permalink
  ├── has status: open | completed | canceled | wont_do
  ├── has manual sort order (per context)
  ├── has title (string)
  └── has notes (text/markdown)

Attachment
  ├── belongs to 1 Task
  ├── has type: file | link
  ├── has title (string, optional — auto-derived from filename or URL)
  ├── has url (string — stored file path or external URL)
  ├── has mime_type (string, for files)
  ├── has file_size (integer, for files)
  ├── has sort order
  └── has created_at

Checklist Item
  ├── belongs to 1 Task
  ├── has title (string)
  ├── has completed (boolean)
  └── has sort order

Heading
  ├── belongs to 1 Project
  ├── has title (string)
  └── has sort order

Tag
  ├── has title (string)
  ├── can be visually nested under parent tag
  └── many-to-many with Tasks and Projects

Repeat Rule
  ├── belongs to 1 Task
  ├── has frequency (daily|weekly|monthly|yearly)
  ├── has interval (every N units)
  ├── has mode (fixed|after_completion)
  └── has optional day constraints
```

### Key Data Model Notes

1. **When vs Deadline are distinct** — "When" = intention, "Deadline" = hard due. A task can have both.
2. **Sort order is per-context** — a task's position in Today is independent of its position in its Project.
3. **Checklist items are NOT subtasks** — deliberately simple (no dates, tags, notes).
4. **Headings are project-scoped only** — cannot add headings to Inbox or Areas.
5. **Tags are flat** — sidebar nesting is visual only, not functional for filtering.
6. **Attachments are dual-type** — both uploaded files and external links, stored as a unified list on each task.
7. **Every task has a unique permalink** — enables sharing/bookmarking a direct link to any task (e.g., `/task/abc123`).

---

## Navigation Structure

```
┌──────────────────┬────────────────────────────────┐
│    SIDEBAR       │       MAIN CONTENT             │
│                  │                                 │
│ ● Inbox (3)      │  [Task list for selected view] │
│ ● Today (5)      │                                │
│ ○ Upcoming       │  ☐ Task title        [tags] ○  │
│ ○ Anytime        │  ☐ Task title        [date]    │
│ ○ Someday        │                                │
│ ○ Logbook        │  --- Heading ---               │
│                  │  ☐ Task title                   │
│ AREAS:           │                                │
│ ▸ Work           │  [Inline detail expands here    │
│   ● Project A    │   when task is opened]         │
│   ○ Project B    │                                │
│ ▸ Personal       │                                │
│   ● Project C    │                                │
│                  │                                │
│ TAGS:            │                                │
│   #home          │                                │
│   #office        │                                │
└──────────────────┴────────────────────────────────┘
```

### View-Specific Layouts

| View | Layout |
|---|---|
| **Inbox** | Flat list, no grouping. Simple and uncluttered. |
| **Today** | Two sections: "Today" and "This Evening". Tasks grouped by source project. |
| **Upcoming** | Date-grouped task list + mini calendar widget. |
| **Anytime** | Tasks grouped by Area, then by Project. |
| **Someday** | Like Anytime but only deferred items. |
| **Logbook** | Reverse-chronological, grouped by completion date. |
| **Project** | Heading-grouped with progress indicator at top. |
| **Area** | All tasks and projects belonging to that area. |

---

## Design Principles to Replicate

1. **Minimal chrome** — almost entirely content. Actions via keyboard shortcuts, context menus, or hover-revealed controls.
2. **Speed of capture** — getting a task in must be near-instantaneous.
3. **When vs. Deadline separation** — most todo apps conflate these. Things doesn't.
4. **Progressive disclosure** — task starts as just a title. Details revealed only on open.
5. **Manual ordering everywhere** — respect user's sense of priority over algorithms.
6. **Smooth, delightful animations** — completion, reordering, transitions all polished.
7. **Deliberate simplicity** — no subtasks (only checklists), no dependencies, no time tracking, no priority levels.
8. **Won't Do as a first-class status** — distinct from Canceled. "Canceled" means the task was abandoned or became irrelevant. "Won't Do" is a deliberate decision not to do it. Both are terminal states that move tasks to the Logbook, but the distinction provides better historical context.
9. **No artificial blocking of recurring tasks** — complete them whenever you're done, even before the scheduled date.
