# Phase 2 — Backend Core

**Goal:** Implement the complete REST API with SQLite persistence, covering all entities from the data model, authentication, view endpoints, SSE broker, and the repeating task scheduler.

---

## 2.1 Database Schema & Migrations

### Migration 001: Core Tables

```sql
-- Areas
CREATE TABLE areas (
    id TEXT PRIMARY KEY,           -- nanoid
    title TEXT NOT NULL,
    sort_order REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Projects
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'canceled')),
    when_date TEXT,                 -- ISO date string (scheduled date)
    deadline TEXT,                  -- ISO date string (hard due date)
    sort_order REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Headings (project-scoped section dividers)
CREATE TABLE headings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sort_order REAL NOT NULL DEFAULT 0
);

-- Tasks
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,            -- nanoid, also used as permalink slug
    title TEXT NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'completed', 'canceled', 'wont_do')),
    when_date TEXT,
    when_evening INTEGER NOT NULL DEFAULT 0,  -- boolean: 1 = "This Evening"
    deadline TEXT,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
    heading_id TEXT REFERENCES headings(id) ON DELETE SET NULL,
    sort_order_today REAL NOT NULL DEFAULT 0,
    sort_order_project REAL NOT NULL DEFAULT 0,
    sort_order_heading REAL NOT NULL DEFAULT 0,
    completed_at TEXT,
    canceled_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Checklist items
CREATE TABLE checklist_items (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    sort_order REAL NOT NULL DEFAULT 0
);

-- Attachments
CREATE TABLE attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('file', 'link')),
    title TEXT DEFAULT '',
    url TEXT NOT NULL,               -- file storage path or external URL
    mime_type TEXT DEFAULT '',
    file_size INTEGER DEFAULT 0,
    sort_order REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tags
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL UNIQUE,
    parent_tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
    sort_order REAL NOT NULL DEFAULT 0
);

-- Task-Tag junction
CREATE TABLE task_tags (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

-- Project-Tag junction
CREATE TABLE project_tags (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, tag_id)
);

-- Repeat rules
CREATE TABLE repeat_rules (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
    interval_value INTEGER NOT NULL DEFAULT 1,
    mode TEXT NOT NULL CHECK (mode IN ('fixed', 'after_completion')),
    day_constraints TEXT DEFAULT '',  -- JSON: e.g. ["mon","wed","fri"]
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_when_date ON tasks(when_date);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_area_id ON tasks(area_id);
CREATE INDEX idx_tasks_heading_id ON tasks(heading_id);
CREATE INDEX idx_projects_area_id ON projects(area_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_checklist_items_task_id ON checklist_items(task_id);
CREATE INDEX idx_attachments_task_id ON attachments(task_id);
CREATE INDEX idx_headings_project_id ON headings(project_id);
```

### Migration 002: Full-Text Search

```sql
CREATE VIRTUAL TABLE tasks_fts USING fts5(title, notes, content=tasks, content_rowid=rowid);

-- Triggers to keep FTS in sync
CREATE TRIGGER tasks_fts_insert AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
END;
CREATE TRIGGER tasks_fts_update AFTER UPDATE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES ('delete', old.rowid, old.title, old.notes);
    INSERT INTO tasks_fts(rowid, title, notes) VALUES (new.rowid, new.title, new.notes);
END;
CREATE TRIGGER tasks_fts_delete AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, notes) VALUES ('delete', old.rowid, old.title, old.notes);
END;
```

### Migration 003: Auth (built-in mode)

```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 2.2 Repository Layer

One file per entity in `internal/repository/`. Each implements a struct with a `*sql.DB` dependency.

### TaskRepository

```
NewTaskRepository(db *sql.DB) *TaskRepository

List(filters TaskFilters) ([]Task, error)
GetByID(id string) (*Task, error)
Create(input CreateTaskInput) (*Task, error)
Update(id string, input UpdateTaskInput) (*Task, error)
Delete(id string) error
Complete(id string) (*Task, error)
Cancel(id string) (*Task, error)
WontDo(id string) (*Task, error)
Reopen(id string) (*Task, error)
Reorder(items []ReorderItem) error
```

### TaskFilters

```go
type TaskFilters struct {
    Status     *string    // open, completed, canceled, wont_do
    ProjectID  *string
    AreaID     *string
    HeadingID  *string
    TagIDs     []string
    WhenDate   *string    // exact date
    WhenBefore *string
    WhenAfter  *string
    HasDeadline *bool
    IsEvening  *bool
    Search     *string    // FTS5 query
}
```

### Similar patterns for:

- **ProjectRepository** — CRUD + complete + task count/progress
- **AreaRepository** — CRUD + list projects/tasks
- **TagRepository** — CRUD + attach/detach from tasks/projects
- **HeadingRepository** — CRUD within project scope
- **ChecklistRepository** — CRUD within task scope + toggle
- **AttachmentRepository** — CRUD within task scope + file metadata
- **RepeatRuleRepository** — CRUD within task scope
- **SearchRepository** — FTS5 query with ranking
- **UserRepository** — Create + GetByUsername (built-in auth only)

---

## 2.3 HTTP Handlers

One file per module in `internal/handler/`. Handlers parse HTTP input, call repository, return JSON.

### Tasks Handler — Endpoints

| Method | Path | Handler | Description |
|---|---|---|---|
| GET | `/api/tasks` | `ListTasks` | List with query filters |
| POST | `/api/tasks` | `CreateTask` | Create new task |
| GET | `/api/tasks/:id` | `GetTask` | Get single task with checklist + attachments + tags |
| PATCH | `/api/tasks/:id` | `UpdateTask` | Partial update (title, notes, dates, project, area, heading) |
| DELETE | `/api/tasks/:id` | `DeleteTask` | Soft delete → Trash |
| PATCH | `/api/tasks/:id/complete` | `CompleteTask` | Set status=completed, trigger repeat rule |
| PATCH | `/api/tasks/:id/cancel` | `CancelTask` | Set status=canceled |
| PATCH | `/api/tasks/:id/wontdo` | `WontDoTask` | Set status=wont_do |
| PATCH | `/api/tasks/reorder` | `ReorderTasks` | Bulk position update |

### Checklist Handler

| Method | Path | Handler |
|---|---|---|
| GET | `/api/tasks/:id/checklist` | `ListChecklistItems` |
| POST | `/api/tasks/:id/checklist` | `CreateChecklistItem` |
| PATCH | `/api/checklist/:id` | `UpdateChecklistItem` |
| DELETE | `/api/checklist/:id` | `DeleteChecklistItem` |

### Attachments Handler

| Method | Path | Handler |
|---|---|---|
| GET | `/api/tasks/:id/attachments` | `ListAttachments` |
| POST | `/api/tasks/:id/attachments` | `CreateAttachment` (multipart for files, JSON for links) |
| PATCH | `/api/attachments/:id` | `UpdateAttachment` |
| DELETE | `/api/attachments/:id` | `DeleteAttachment` |
| GET | `/api/attachments/:id/file` | `DownloadFile` (stream from disk) |

### Projects Handler

| Method | Path | Handler |
|---|---|---|
| GET | `/api/projects` | `ListProjects` |
| POST | `/api/projects` | `CreateProject` |
| GET | `/api/projects/:id` | `GetProject` (with tasks, headings, progress) |
| PATCH | `/api/projects/:id` | `UpdateProject` |
| DELETE | `/api/projects/:id` | `DeleteProject` |
| PATCH | `/api/projects/:id/complete` | `CompleteProject` |

### Headings Handler

| Method | Path | Handler |
|---|---|---|
| GET | `/api/projects/:id/headings` | `ListHeadings` |
| POST | `/api/projects/:id/headings` | `CreateHeading` |
| PATCH | `/api/headings/:id` | `UpdateHeading` |
| DELETE | `/api/headings/:id` | `DeleteHeading` |

### Areas, Tags, Auth, Search Handlers

Follow the same pattern per the API spec in `05-architecture-overview.md`.

---

## 2.4 View Endpoints

Pre-structured data for each smart list. These do the complex filtering/grouping so the frontend doesn't have to.

| Endpoint | Logic |
|---|---|
| `GET /api/views/inbox` | Tasks where `project_id IS NULL AND area_id IS NULL AND status='open' AND when_date IS NULL` |
| `GET /api/views/today` | Tasks where `when_date = today OR deadline = today`, split into "Today" and "This Evening" sections, grouped by source project |
| `GET /api/views/upcoming` | Open tasks with `when_date >= today`, grouped by date |
| `GET /api/views/anytime` | All open tasks (not someday-deferred), grouped by area → project |
| `GET /api/views/someday` | Tasks/projects with a "someday" flag (when_date IS NULL and explicitly deferred) |
| `GET /api/views/logbook` | Completed/canceled/wont_do tasks, reverse-chronological, grouped by completion date |

Each returns a structured JSON response with sections/groups, not a flat array.

---

## 2.5 SSE Event Broker

**File:** `internal/sse/broker.go`

```go
type Broker struct {
    mu      sync.RWMutex
    clients map[string]chan Event  // clientID → event channel
}

func (b *Broker) Subscribe(clientID string) <-chan Event
func (b *Broker) Unsubscribe(clientID string)
func (b *Broker) Broadcast(event Event, excludeClient string)
```

**Event types:** `task_created`, `task_updated`, `task_deleted`, `project_updated`, `area_updated`, `tag_updated`, `bulk_change`

Handlers call `broker.Broadcast()` after every successful mutation.

---

## 2.6 Authentication Middleware

**File:** `internal/middleware/auth.go`

Two modes based on `AUTH_MODE` env var:

**Mode: `builtin` (default)**
1. `POST /api/auth/login` — validate username + bcrypt password → return JWT in httpOnly cookie
2. `DELETE /api/auth/logout` — clear cookie
3. Middleware: extract JWT from cookie, validate, set user context

**Mode: `proxy`**
1. No login/logout endpoints
2. Middleware: trust all requests (optionally read `Remote-User` header)

---

## 2.7 Repeating Task Scheduler

**File:** `internal/scheduler/scheduler.go`

- Uses `robfig/cron` to run every hour (or more frequently if needed)
- Queries all tasks with repeat rules
- For **fixed schedule** tasks: if current date matches the next scheduled date, generate new task instance
- For **after_completion** tasks: handled at completion time — when a task with `mode=after_completion` is completed, immediately generate the next instance with calculated `when_date`

---

## 2.8 Implementation Order

Build in this sequence to allow incremental testing:

1. **Database + migrations** — schema up and running
2. **Models** — Go structs matching schema
3. **Task repository + handler** — core entity, most complex
4. **Project repository + handler** — second most complex (includes headings)
5. **Area repository + handler**
6. **Tag repository + handler** (including junction table logic)
7. **Checklist repository + handler**
8. **Attachment repository + handler** (including file upload/download)
9. **View endpoints** — depends on task/project/area being done
10. **Auth middleware** — can be added late, protects all routes
11. **SSE broker + events handler**
12. **Repeat rule repository + scheduler**
13. **Search repository + handler** (FTS5)

---

## Phase 2 Completion Criteria

- [ ] All CRUD endpoints return correct JSON
- [ ] View endpoints return properly grouped/filtered data
- [ ] Auth middleware works in both modes
- [ ] SSE broker sends events to connected clients on mutations
- [ ] Repeating tasks generate new instances correctly
- [ ] FTS5 search returns ranked results
- [ ] All endpoints tested with `go test`
