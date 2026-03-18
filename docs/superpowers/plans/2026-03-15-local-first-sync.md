# Local-First Multi-Device Sync Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ThingsToDo fully local-first — all reads/writes hit a client-side IndexedDB first, sync to server in the background, and work offline across multiple devices.

**Architecture:** IndexedDB (via Dexie.js) becomes the primary data store on each client. Mutations write locally first, then push to the server via a sync queue. The server maintains a sequential change log; each device pulls changes since its last sync cursor. Conflicts resolve with last-write-wins per field using `updated_at` timestamps. The existing TanStack Query layer is replaced with Dexie's `useLiveQuery` for reactive reads, and the REST API layer is kept but only used by the sync engine (not directly by UI components).

**Tech Stack:** Dexie.js 4 (IndexedDB wrapper + live queries), existing Go/SQLite backend with new sync endpoints, Background Sync API (with fallback polling), existing vite-plugin-pwa service worker.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                     React UI                         │
│  useLiveQuery() reads  ←→  localDb.tasks.put() writes│
└──────────────┬──────────────────────┬────────────────┘
               │ reads                │ writes
               ▼                      ▼
┌─────────────────────────────────────────────────────┐
│                  Dexie.js (IndexedDB)                │
│  tables: tasks, projects, areas, tags, task_tags,    │
│  checklist_items, attachments, reminders, schedules,  │
│  repeat_rules, headings, sync_queue, sync_meta       │
└──────────────┬──────────────────────┬────────────────┘
               │                      │
               │         ┌────────────┘
               │         ▼
               │  ┌──────────────┐
               │  │  Sync Engine │ (push local changes, pull remote changes)
               │  └──────┬───────┘
               │         │
               ▼         ▼
┌─────────────────────────────────────────────────────┐
│              Go Server (existing REST API)            │
│  NEW: POST /api/sync/push   GET /api/sync/pull       │
│  NEW: change_log table tracks all mutations           │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Dexie.js over raw IndexedDB** — Dexie provides `useLiveQuery()` which gives us reactive UI updates from IndexedDB (replaces TanStack Query for data reads). It also handles migrations, transactions, and compound indexes cleanly.

2. **Last-write-wins per field** — For a task manager, field-level LWW is the right tradeoff. If you edit the title on your phone and the due date on your laptop, both changes survive. Only true conflicts (same field, same task, different values) use timestamp to pick the winner.

3. **Server change log** — Every mutation on the server appends to a `change_log` table with a monotonically increasing sequence number. Clients pull by sequence number, not timestamp, to avoid clock skew issues.

4. **Push-then-pull sync cycle** — Client pushes its pending changes first (so the server has the latest state), then pulls all changes since its last cursor. This ensures the client always ends up with the server's resolved state.

5. **Soft deletes everywhere** — Already in place for tasks (`deleted_at`). Extend to all entities so deletes can sync across devices.

6. **Keep existing REST API** — The sync endpoints are additive. The existing CRUD endpoints remain for backwards compatibility and can still be used by the sync engine internally.

---

## Chunk 1: Backend — Change Log & Sync Endpoints

### Task 1: Database Migration — Change Log Table

**Files:**
- Create: `internal/database/migrations/028_change_log.go`

- [ ] **Step 1: Write the migration file**

```go
// internal/database/migrations/028_change_log.go
package migrations

func init() {
	Register(28, migrate028Up)
}

func migrate028Up(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS change_log (
			seq        INTEGER PRIMARY KEY AUTOINCREMENT,
			entity     TEXT    NOT NULL,  -- 'task', 'project', 'area', 'tag', 'heading', 'checklist_item', 'attachment', 'schedule', 'reminder', 'repeat_rule', 'task_tag', 'project_tag', 'user_settings', 'saved_filter'
			entity_id  TEXT    NOT NULL,
			action     TEXT    NOT NULL,  -- 'create', 'update', 'delete'
			fields     TEXT,             -- JSON array of changed field names (null for create/delete)
			snapshot   TEXT    NOT NULL,  -- full JSON snapshot of entity after change
			user_id    TEXT,
			device_id  TEXT,
			created_at TEXT    NOT NULL DEFAULT (datetime('now'))
		);

		CREATE INDEX idx_change_log_seq ON change_log(seq);
		CREATE INDEX idx_change_log_entity ON change_log(entity, entity_id);
	`)
	return err
}
```

- [ ] **Step 2: Run migration and verify**

Run: `go test ./internal/database/... -v -run TestMigrations`
Expected: PASS — table `change_log` exists with correct schema.

- [ ] **Step 3: Commit**

```bash
git add internal/database/migrations/028_change_log.go
git commit -m "feat(sync): add change_log table migration"
```

---

### Task 2: Change Log Repository

**Files:**
- Create: `internal/repository/changelog.go`
- Create: `internal/repository/changelog_test.go`

- [ ] **Step 1: Write failing test for AppendChange**

```go
// internal/repository/changelog_test.go
func TestChangeLogRepository_AppendChange(t *testing.T) {
	db := setupTestDB(t)
	repo := NewChangeLogRepository(db)

	seq, err := repo.AppendChange("task", "abc123", "create", nil, `{"id":"abc123","title":"Test"}`, "user1", "device1")
	require.NoError(t, err)
	require.Greater(t, seq, int64(0))
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/repository/ -v -run TestChangeLogRepository_AppendChange`
Expected: FAIL — `NewChangeLogRepository` undefined.

- [ ] **Step 3: Implement ChangeLogRepository**

```go
// internal/repository/changelog.go
package repository

import "database/sql"

type ChangeLogEntry struct {
	Seq       int64   `json:"seq"`
	Entity    string  `json:"entity"`
	EntityID  string  `json:"entity_id"`
	Action    string  `json:"action"`
	Fields    *string `json:"fields,omitempty"`
	Snapshot  string  `json:"snapshot"`
	UserID    string  `json:"user_id,omitempty"`
	DeviceID  string  `json:"device_id,omitempty"`
	CreatedAt string  `json:"created_at"`
}

type ChangeLogRepository struct {
	db *sql.DB
}

func NewChangeLogRepository(db *sql.DB) *ChangeLogRepository {
	return &ChangeLogRepository{db: db}
}

func (r *ChangeLogRepository) AppendChange(entity, entityID, action string, fields *string, snapshot, userID, deviceID string) (int64, error) {
	result, err := r.db.Exec(
		`INSERT INTO change_log (entity, entity_id, action, fields, snapshot, user_id, device_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		entity, entityID, action, fields, snapshot, userID, deviceID,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *ChangeLogRepository) GetChangesSince(sinceSeq int64, limit int) ([]ChangeLogEntry, error) {
	rows, err := r.db.Query(
		`SELECT seq, entity, entity_id, action, fields, snapshot, user_id, device_id, created_at
		 FROM change_log WHERE seq > ? ORDER BY seq ASC LIMIT ?`,
		sinceSeq, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []ChangeLogEntry
	for rows.Next() {
		var e ChangeLogEntry
		err := rows.Scan(&e.Seq, &e.Entity, &e.EntityID, &e.Action, &e.Fields, &e.Snapshot, &e.UserID, &e.DeviceID, &e.CreatedAt)
		if err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

func (r *ChangeLogRepository) GetLatestSeq() (int64, error) {
	var seq sql.NullInt64
	err := r.db.QueryRow(`SELECT MAX(seq) FROM change_log`).Scan(&seq)
	if err != nil {
		return 0, err
	}
	if !seq.Valid {
		return 0, nil
	}
	return seq.Int64, nil
}

func (r *ChangeLogRepository) PurgeOlderThan(days int) (int64, error) {
	result, err := r.db.Exec(
		`DELETE FROM change_log WHERE created_at < datetime('now', ? || ' days')`,
		-days,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/repository/ -v -run TestChangeLogRepository`
Expected: PASS

- [ ] **Step 5: Write tests for GetChangesSince and GetLatestSeq**

```go
func TestChangeLogRepository_GetChangesSince(t *testing.T) {
	db := setupTestDB(t)
	repo := NewChangeLogRepository(db)

	// Insert 3 changes
	repo.AppendChange("task", "t1", "create", nil, `{"id":"t1"}`, "u1", "d1")
	seq2, _ := repo.AppendChange("task", "t2", "create", nil, `{"id":"t2"}`, "u1", "d1")
	repo.AppendChange("task", "t3", "create", nil, `{"id":"t3"}`, "u1", "d1")

	// Get changes since seq2
	changes, err := repo.GetChangesSince(seq2, 100)
	require.NoError(t, err)
	require.Len(t, changes, 1)
	require.Equal(t, "t3", changes[0].EntityID)

	// GetLatestSeq
	latest, err := repo.GetLatestSeq()
	require.NoError(t, err)
	require.Equal(t, seq2+1, latest)
}
```

- [ ] **Step 6: Run all changelog tests**

Run: `go test ./internal/repository/ -v -run TestChangeLogRepository`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add internal/repository/changelog.go internal/repository/changelog_test.go
git commit -m "feat(sync): add ChangeLogRepository with append/query/purge"
```

---

### Task 3: Integrate Change Log into Existing Repositories

**Files:**
- Modify: `internal/repository/tasks.go` — inject ChangeLogRepository, call AppendChange after each mutation
- Modify: `internal/repository/projects.go` — same
- Modify: `internal/repository/areas.go` — same
- Modify: `internal/repository/tags.go` — same
- Modify: `internal/repository/checklist.go` — same
- Modify: `internal/repository/attachments.go` — same
- Modify: `internal/repository/schedules.go` — same
- Modify: `internal/repository/reminders.go` — same
- Modify: `internal/repository/repeat_rules.go` — same
- Modify: `internal/repository/headings.go` — same

The pattern for each repository is the same. After every Create/Update/Delete operation, serialize the entity to JSON and call `changeLog.AppendChange(...)`. This is best done by adding a `changeLog *ChangeLogRepository` field to each repository struct and a helper method.

- [ ] **Step 1: Create a helper for change log integration**

Create `internal/repository/changelog_helper.go`:

```go
package repository

import "encoding/json"

// logChange is a convenience wrapper used by all repositories
func logChange(cl *ChangeLogRepository, entity, entityID, action string, fields []string, snapshot interface{}, userID, deviceID string) {
	if cl == nil {
		return // change log not configured (e.g., in tests)
	}
	data, err := json.Marshal(snapshot)
	if err != nil {
		return // best-effort logging
	}
	var fieldsJSON *string
	if fields != nil {
		f, _ := json.Marshal(fields)
		s := string(f)
		fieldsJSON = &s
	}
	cl.AppendChange(entity, entityID, action, fieldsJSON, string(data), userID, deviceID)
}
```

- [ ] **Step 2: Add ChangeLogRepository to TaskRepository**

In `internal/repository/tasks.go`, add `changeLog *ChangeLogRepository` to the struct and update `NewTaskRepository` to accept it. After each `Create`, `Update`, `Delete`, `Complete`, `Cancel`, `WontDo`, `Reopen`, `Restore` call, add:

```go
logChange(r.changeLog, "task", task.ID, "create", nil, task, "", "")
```

For updates, pass the list of changed fields:
```go
logChange(r.changeLog, "task", id, "update", []string{"title", "notes"}, updatedTask, "", "")
```

- [ ] **Step 3: Repeat for all other repositories**

Same pattern: add `changeLog` field, log after each mutation. Entities:
- `project` → ProjectRepository
- `area` → AreaRepository
- `tag` → TagRepository
- `heading` → HeadingRepository
- `checklist_item` → ChecklistRepository
- `attachment` → AttachmentRepository
- `schedule` → ScheduleRepository
- `reminder` → ReminderRepository
- `repeat_rule` → RepeatRuleRepository

For junction tables (`task_tags`, `project_tags`), log from the parent entity's handler when tags are modified.

- [ ] **Step 4: Update main.go to wire ChangeLogRepository into all repositories**

In `cmd/server/main.go`:
```go
changeLogRepo := repository.NewChangeLogRepository(db)
taskRepo := repository.NewTaskRepository(db, changeLogRepo)
projectRepo := repository.NewProjectRepository(db, changeLogRepo)
// ... etc
```

- [ ] **Step 5: Run full test suite**

Run: `go test ./... -v`
Expected: PASS (existing tests should still work; changeLog is nil-safe)

- [ ] **Step 6: Commit**

```bash
git add internal/repository/ cmd/server/main.go
git commit -m "feat(sync): integrate change log into all repositories"
```

---

### Task 4: Sync Pull Endpoint

**Files:**
- Create: `internal/handler/sync.go`
- Create: `internal/handler/sync_test.go`

- [ ] **Step 1: Write failing test**

```go
func TestSyncHandler_Pull(t *testing.T) {
	// Setup test server with seeded change_log entries
	// GET /api/sync/pull?since=0&limit=100
	// Expect JSON: { "changes": [...], "cursor": 3, "has_more": false }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test ./internal/handler/ -v -run TestSyncHandler_Pull`
Expected: FAIL

- [ ] **Step 3: Implement SyncHandler.Pull**

```go
// internal/handler/sync.go
package handler

import (
	"net/http"
	"strconv"
	"encoding/json"
)

type SyncHandler struct {
	changeLog *repository.ChangeLogRepository
}

func NewSyncHandler(cl *repository.ChangeLogRepository) *SyncHandler {
	return &SyncHandler{changeLog: cl}
}

type PullResponse struct {
	Changes []repository.ChangeLogEntry `json:"changes"`
	Cursor  int64                       `json:"cursor"`
	HasMore bool                        `json:"has_more"`
}

func (h *SyncHandler) Pull(w http.ResponseWriter, r *http.Request) {
	since, _ := strconv.ParseInt(r.URL.Query().Get("since"), 10, 64)
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 1000 {
		limit = 500
	}

	changes, err := h.changeLog.GetChangesSince(since, limit+1)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}

	hasMore := len(changes) > limit
	if hasMore {
		changes = changes[:limit]
	}

	cursor := since
	if len(changes) > 0 {
		cursor = changes[len(changes)-1].Seq
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PullResponse{
		Changes: changes,
		Cursor:  cursor,
		HasMore: hasMore,
	})
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `go test ./internal/handler/ -v -run TestSyncHandler_Pull`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/handler/sync.go internal/handler/sync_test.go
git commit -m "feat(sync): add GET /api/sync/pull endpoint"
```

---

### Task 5: Sync Push Endpoint

**Files:**
- Modify: `internal/handler/sync.go`
- Modify: `internal/handler/sync_test.go`

The push endpoint receives a batch of client mutations, applies them to the database using existing repository methods, and returns the resulting change log entries (so the client can see the resolved state).

- [ ] **Step 1: Write failing test**

```go
func TestSyncHandler_Push(t *testing.T) {
	// POST /api/sync/push with body:
	// { "changes": [{ "entity": "task", "entity_id": "abc", "action": "create", "data": {...}, "client_updated_at": "..." }] }
	// Expect: { "results": [{ "entity": "task", "entity_id": "abc", "status": "applied", "seq": 1 }] }
}
```

- [ ] **Step 2: Implement SyncHandler.Push**

```go
type PushRequest struct {
	DeviceID string       `json:"device_id"`
	Changes  []ClientChange `json:"changes"`
}

type ClientChange struct {
	Entity          string          `json:"entity"`
	EntityID        string          `json:"entity_id"`
	Action          string          `json:"action"`      // create, update, delete
	Data            json.RawMessage `json:"data"`         // entity payload
	Fields          []string        `json:"fields"`       // which fields changed (for updates)
	ClientUpdatedAt string          `json:"client_updated_at"`
}

type PushResult struct {
	Entity   string `json:"entity"`
	EntityID string `json:"entity_id"`
	Status   string `json:"status"` // "applied", "conflict_resolved", "error"
	Seq      int64  `json:"seq,omitempty"`
	Error    string `json:"error,omitempty"`
}

type PushResponse struct {
	Results []PushResult `json:"results"`
}

func (h *SyncHandler) Push(w http.ResponseWriter, r *http.Request) {
	var req PushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", 400)
		return
	}

	var results []PushResult
	for _, change := range req.Changes {
		result := h.applyChange(r.Context(), change, req.DeviceID)
		results = append(results, result)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(PushResponse{Results: results})
}
```

The `applyChange` method dispatches to the appropriate repository based on `entity` type, applying create/update/delete. For updates, it compares `client_updated_at` with the server's `updated_at` — if the server version is newer, it does field-level merge (LWW per field).

- [ ] **Step 3: Implement `applyChange` with field-level LWW conflict resolution**

For each entity type, the logic is:
1. **Create**: If entity doesn't exist, create it. If it exists (created on another device), merge fields.
2. **Update**: Load server version. For each changed field, if `client_updated_at >= server.updated_at`, apply the client's value. Otherwise keep server's.
3. **Delete**: Apply soft delete (set `deleted_at`).

- [ ] **Step 4: Run tests**

Run: `go test ./internal/handler/ -v -run TestSyncHandler_Push`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/handler/sync.go internal/handler/sync_test.go
git commit -m "feat(sync): add POST /api/sync/push endpoint with LWW conflict resolution"
```

---

### Task 6: Register Sync Routes

**Files:**
- Modify: `internal/router/router.go`
- Modify: `cmd/server/main.go`

- [ ] **Step 1: Add sync routes to router**

In `internal/router/router.go`, inside the authenticated route group:
```go
r.Route("/api/sync", func(r chi.Router) {
    r.Get("/pull", syncHandler.Pull)
    r.Post("/push", syncHandler.Push)
})
```

- [ ] **Step 2: Wire SyncHandler in main.go**

```go
syncHandler := handler.NewSyncHandler(changeLogRepo)
```

Pass to router setup.

- [ ] **Step 3: Run integration tests**

Run: `go test ./... -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/router/router.go cmd/server/main.go
git commit -m "feat(sync): register /api/sync/pull and /api/sync/push routes"
```

---

### Task 7: Change Log Purge Cron Job

**Files:**
- Modify: `internal/scheduler/scheduler.go`

- [ ] **Step 1: Add daily purge job**

The change log grows indefinitely. Add a cron job to purge entries older than 90 days (configurable). Devices that haven't synced in 90 days will need a full re-sync.

```go
// In scheduler setup
s.cron.AddFunc("@daily", func() {
    purged, err := changeLogRepo.PurgeOlderThan(90)
    if err != nil {
        log.Printf("change log purge error: %v", err)
        return
    }
    if purged > 0 {
        log.Printf("purged %d old change log entries", purged)
    }
})
```

- [ ] **Step 2: Add a full-sync endpoint for stale clients**

Add `GET /api/sync/full` that returns all current entities (not from change log, but live data). Clients use this when their cursor is too old (server returns `cursor_expired: true` from pull).

- [ ] **Step 3: Run tests**

Run: `go test ./... -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/scheduler/scheduler.go internal/handler/sync.go
git commit -m "feat(sync): add change log purge cron and full-sync fallback endpoint"
```

---

### Task 8: Update API Documentation

**Files:**
- Modify: `docs/api.md`

- [ ] **Step 1: Add sync endpoints to api.md**

Document:
- `GET /api/sync/pull?since={seq}&limit={n}` — Pull changes since sequence number
- `POST /api/sync/push` — Push client changes with conflict resolution
- `GET /api/sync/full` — Full data dump for stale clients
- Change log entry schema
- Conflict resolution behavior (LWW per field)

- [ ] **Step 2: Commit**

```bash
git add docs/api.md
git commit -m "docs: add sync API endpoints to api.md"
```

---

## Chunk 2: Frontend — Local Database & Sync Engine

### Task 9: Install Dexie.js and Set Up Local Database Schema

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/db/index.ts`
- Create: `frontend/src/db/schema.ts`

- [ ] **Step 1: Install Dexie.js**

```bash
cd frontend && npm install dexie dexie-react-hooks
```

- [ ] **Step 2: Define the local database schema**

```typescript
// frontend/src/db/schema.ts
import Dexie, { type EntityTable } from 'dexie';
import type { Task, Project, Area, Tag, ChecklistItem, Attachment, Schedule, Reminder, RepeatRule, Heading } from '../api/types';

// Extends server types with sync metadata
interface SyncMeta {
  _syncStatus: 'synced' | 'pending' | 'conflict';
  _localUpdatedAt: string;
  _serverSeq?: number;
}

export type LocalTask = Task & SyncMeta;
export type LocalProject = Project & SyncMeta;
export type LocalArea = Area & SyncMeta;
export type LocalTag = Tag & SyncMeta;
export type LocalChecklistItem = ChecklistItem & SyncMeta;
export type LocalAttachment = Attachment & SyncMeta;
export type LocalSchedule = Schedule & SyncMeta;
export type LocalReminder = Reminder & SyncMeta;
export type LocalRepeatRule = RepeatRule & SyncMeta;
export type LocalHeading = Heading & SyncMeta;

export interface SyncQueueEntry {
  id?: number; // auto-increment
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  fields?: string[];
  data: Record<string, unknown>;
  clientUpdatedAt: string;
  createdAt: string;
}

export interface SyncMetaRecord {
  key: string;
  value: string | number;
}
```

- [ ] **Step 3: Create the Dexie database instance**

```typescript
// frontend/src/db/index.ts
import Dexie from 'dexie';
import type { LocalTask, LocalProject, LocalArea, LocalTag, LocalChecklistItem, LocalAttachment, LocalSchedule, LocalReminder, LocalRepeatRule, LocalHeading, SyncQueueEntry, SyncMetaRecord } from './schema';

export class ThingsToDoDatabase extends Dexie {
  tasks!: EntityTable<LocalTask, 'id'>;
  projects!: EntityTable<LocalProject, 'id'>;
  areas!: EntityTable<LocalArea, 'id'>;
  tags!: EntityTable<LocalTag, 'id'>;
  checklistItems!: EntityTable<LocalChecklistItem, 'id'>;
  attachments!: EntityTable<LocalAttachment, 'id'>;
  schedules!: EntityTable<LocalSchedule, 'id'>;
  reminders!: EntityTable<LocalReminder, 'id'>;
  repeatRules!: EntityTable<LocalRepeatRule, 'id'>;
  headings!: EntityTable<LocalHeading, 'id'>;
  syncQueue!: EntityTable<SyncQueueEntry, 'id'>;
  syncMeta!: EntityTable<SyncMetaRecord, 'key'>;

  constructor() {
    super('thingstodo');
    this.version(1).stores({
      tasks: 'id, status, when_date, deadline, project_id, area_id, heading_id, high_priority, deleted_at, _syncStatus, sort_order_today, sort_order_project',
      projects: 'id, area_id, status, _syncStatus, sort_order',
      areas: 'id, _syncStatus, sort_order',
      tags: 'id, parent_tag_id, _syncStatus, sort_order',
      checklistItems: 'id, task_id, _syncStatus, sort_order',
      attachments: 'id, task_id, _syncStatus, sort_order',
      schedules: 'id, task_id, when_date, _syncStatus, sort_order',
      reminders: 'id, task_id, _syncStatus',
      repeatRules: 'id, task_id, _syncStatus',
      headings: 'id, project_id, _syncStatus, sort_order',
      syncQueue: '++id, entity, entityId, createdAt',
      syncMeta: 'key',
    });
  }
}

export const localDb = new ThingsToDoDatabase();
```

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/db/
git commit -m "feat(sync): add Dexie.js local database with schema and sync tables"
```

---

### Task 10: Sync Engine — Core Push/Pull Logic

**Files:**
- Create: `frontend/src/sync/engine.ts`
- Create: `frontend/src/sync/push.ts`
- Create: `frontend/src/sync/pull.ts`
- Create: `frontend/src/sync/status.ts`

- [ ] **Step 1: Create sync status store**

```typescript
// frontend/src/sync/status.ts
import { create } from 'zustand';

interface SyncState {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncAt: string | null;
  pendingCount: number;
  error: string | null;
  setStatus: (status: SyncState['status']) => void;
  setLastSync: (at: string) => void;
  setPendingCount: (count: number) => void;
  setError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncAt: null,
  pendingCount: 0,
  error: null,
  setStatus: (status) => set({ status }),
  setLastSync: (at) => set({ lastSyncAt: at }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setError: (error) => set({ error }),
}));
```

- [ ] **Step 2: Create push module**

```typescript
// frontend/src/sync/push.ts
import { localDb } from '../db';
import { api } from '../api/client';

export async function pushChanges(deviceId: string): Promise<number> {
  const pending = await localDb.syncQueue.orderBy('createdAt').toArray();
  if (pending.length === 0) return 0;

  const response = await api.post('/api/sync/push', {
    device_id: deviceId,
    changes: pending.map((entry) => ({
      entity: entry.entity,
      entity_id: entry.entityId,
      action: entry.action,
      data: entry.data,
      fields: entry.fields,
      client_updated_at: entry.clientUpdatedAt,
    })),
  });

  // Remove successfully pushed entries from queue
  const appliedIds = pending
    .filter((_, i) => response.results[i]?.status !== 'error')
    .map((entry) => entry.id!)
    .filter(Boolean);

  await localDb.syncQueue.bulkDelete(appliedIds);
  return appliedIds.length;
}
```

- [ ] **Step 3: Create pull module**

```typescript
// frontend/src/sync/pull.ts
import { localDb } from '../db';
import { api } from '../api/client';

const ENTITY_TABLE_MAP: Record<string, string> = {
  task: 'tasks',
  project: 'projects',
  area: 'areas',
  tag: 'tags',
  checklist_item: 'checklistItems',
  attachment: 'attachments',
  schedule: 'schedules',
  reminder: 'reminders',
  repeat_rule: 'repeatRules',
  heading: 'headings',
};

export async function pullChanges(): Promise<number> {
  const meta = await localDb.syncMeta.get('cursor');
  const cursor = meta ? Number(meta.value) : 0;

  let totalApplied = 0;
  let currentCursor = cursor;
  let hasMore = true;

  while (hasMore) {
    const response = await api.get(`/api/sync/pull?since=${currentCursor}&limit=500`);

    for (const change of response.changes) {
      const tableName = ENTITY_TABLE_MAP[change.entity];
      if (!tableName) continue;

      const table = (localDb as any)[tableName];
      const snapshot = JSON.parse(change.snapshot);

      if (change.action === 'delete') {
        // For soft-deletable entities, update with deleted_at; otherwise delete
        if ('deleted_at' in snapshot) {
          await table.put({ ...snapshot, _syncStatus: 'synced', _localUpdatedAt: snapshot.updated_at || change.created_at });
        } else {
          await table.delete(change.entity_id);
        }
      } else {
        // Check if we have a pending local change for this entity
        const pendingLocal = await localDb.syncQueue
          .where({ entity: change.entity, entityId: change.entity_id })
          .first();

        if (pendingLocal) {
          // Don't overwrite local pending changes — they'll be pushed next cycle
          continue;
        }

        await table.put({
          ...snapshot,
          _syncStatus: 'synced',
          _localUpdatedAt: snapshot.updated_at || change.created_at,
          _serverSeq: change.seq,
        });
      }

      totalApplied++;
    }

    currentCursor = response.cursor;
    hasMore = response.has_more;
  }

  // Save cursor
  await localDb.syncMeta.put({ key: 'cursor', value: currentCursor });
  return totalApplied;
}

export async function fullSync(): Promise<void> {
  const response = await api.get('/api/sync/full');

  await localDb.transaction('rw',
    [localDb.tasks, localDb.projects, localDb.areas, localDb.tags, localDb.checklistItems,
     localDb.attachments, localDb.schedules, localDb.reminders, localDb.repeatRules, localDb.headings, localDb.syncMeta],
    async () => {
      // Clear all tables except syncQueue (preserve pending local changes)
      for (const [entity, tableName] of Object.entries(ENTITY_TABLE_MAP)) {
        const table = (localDb as any)[tableName];
        await table.clear();
        const items = response[tableName] || [];
        for (const item of items) {
          await table.put({ ...item, _syncStatus: 'synced', _localUpdatedAt: item.updated_at || new Date().toISOString() });
        }
      }
      await localDb.syncMeta.put({ key: 'cursor', value: response.cursor });
    }
  );
}
```

- [ ] **Step 4: Create sync engine orchestrator**

```typescript
// frontend/src/sync/engine.ts
import { pushChanges } from './push';
import { pullChanges, fullSync } from './pull';
import { useSyncStore } from './status';
import { localDb } from '../db';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isOnline = navigator.onLine;
const DEVICE_ID = getOrCreateDeviceId();

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem('thingstodo_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('thingstodo_device_id', id);
  }
  return id;
}

export async function syncNow(): Promise<void> {
  const store = useSyncStore.getState();

  if (store.status === 'syncing') return;
  if (!navigator.onLine) {
    store.setStatus('offline');
    return;
  }

  store.setStatus('syncing');
  store.setError(null);

  try {
    // Push first, then pull
    await pushChanges(DEVICE_ID);
    await pullChanges();

    const pendingCount = await localDb.syncQueue.count();
    store.setPendingCount(pendingCount);
    store.setLastSync(new Date().toISOString());
    store.setStatus('idle');
  } catch (err: any) {
    if (err?.message?.includes('cursor_expired')) {
      // Cursor too old, need full sync
      await fullSync();
      store.setLastSync(new Date().toISOString());
      store.setStatus('idle');
    } else {
      store.setError(err?.message || 'Sync failed');
      store.setStatus('error');
    }
  }
}

export function startSyncEngine(): void {
  // Initial sync
  syncNow();

  // Periodic sync every 30 seconds
  syncInterval = setInterval(syncNow, 30_000);

  // Sync on reconnect
  window.addEventListener('online', () => {
    isOnline = true;
    useSyncStore.getState().setStatus('idle');
    syncNow();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    useSyncStore.getState().setStatus('offline');
  });

  // Sync on visibility change (user returns to tab/app)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isOnline) {
      syncNow();
    }
  });
}

export function stopSyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/sync/
git commit -m "feat(sync): add sync engine with push/pull/full-sync and online/offline detection"
```

---

### Task 11: Local Mutation Layer — Write to IndexedDB + Queue

**Files:**
- Create: `frontend/src/db/mutations.ts`

This module replaces direct API calls for mutations. Every write goes to IndexedDB first, then queues for sync.

- [ ] **Step 1: Create local mutation functions**

```typescript
// frontend/src/db/mutations.ts
import { localDb } from './index';
import { syncNow } from '../sync/engine';
import type { SyncQueueEntry } from './schema';

function now(): string {
  return new Date().toISOString();
}

async function queueChange(entry: Omit<SyncQueueEntry, 'id' | 'createdAt'>): Promise<void> {
  await localDb.syncQueue.add({ ...entry, createdAt: now() });
  // Trigger sync in background (non-blocking)
  syncNow().catch(() => {});
}

// --- Tasks ---

export async function createTask(data: Record<string, unknown>): Promise<string> {
  const id = data.id as string || generateNanoid();
  const task = {
    ...data,
    id,
    status: 'open',
    created_at: now(),
    updated_at: now(),
    _syncStatus: 'pending' as const,
    _localUpdatedAt: now(),
  };
  await localDb.tasks.put(task as any);
  await queueChange({ entity: 'task', entityId: id, action: 'create', data: task });
  return id;
}

export async function updateTask(id: string, fields: Record<string, unknown>): Promise<void> {
  const existing = await localDb.tasks.get(id);
  if (!existing) throw new Error(`Task ${id} not found locally`);

  const updated = { ...existing, ...fields, updated_at: now(), _syncStatus: 'pending' as const, _localUpdatedAt: now() };
  await localDb.tasks.put(updated);
  await queueChange({
    entity: 'task',
    entityId: id,
    action: 'update',
    fields: Object.keys(fields),
    data: fields,
    clientUpdatedAt: now(),
  });
}

export async function completeTask(id: string): Promise<void> {
  await updateTask(id, { status: 'completed', completed_at: now() });
}

export async function cancelTask(id: string): Promise<void> {
  await updateTask(id, { status: 'canceled', canceled_at: now() });
}

export async function deleteTask(id: string): Promise<void> {
  await updateTask(id, { deleted_at: now() });
}

export async function reopenTask(id: string): Promise<void> {
  await updateTask(id, { status: 'open', completed_at: null, canceled_at: null });
}

export async function restoreTask(id: string): Promise<void> {
  await updateTask(id, { deleted_at: null });
}

// --- Projects ---

export async function createProject(data: Record<string, unknown>): Promise<string> {
  const id = data.id as string || generateNanoid();
  const project = { ...data, id, status: 'open', created_at: now(), updated_at: now(), _syncStatus: 'pending' as const, _localUpdatedAt: now() };
  await localDb.projects.put(project as any);
  await queueChange({ entity: 'project', entityId: id, action: 'create', data: project });
  return id;
}

export async function updateProject(id: string, fields: Record<string, unknown>): Promise<void> {
  const existing = await localDb.projects.get(id);
  if (!existing) throw new Error(`Project ${id} not found locally`);
  const updated = { ...existing, ...fields, updated_at: now(), _syncStatus: 'pending' as const, _localUpdatedAt: now() };
  await localDb.projects.put(updated);
  await queueChange({ entity: 'project', entityId: id, action: 'update', fields: Object.keys(fields), data: fields, clientUpdatedAt: now() });
}

// ... Same pattern for areas, tags, checklist items, attachments, schedules, reminders, headings

function generateNanoid(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  for (const byte of bytes) {
    result += chars[byte % chars.length];
  }
  return result;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/db/mutations.ts
git commit -m "feat(sync): add local mutation layer that writes to IndexedDB + sync queue"
```

---

### Task 12: Replace TanStack Query Reads with Dexie Live Queries

**Files:**
- Create: `frontend/src/hooks/localQueries.ts`
- Modify: `frontend/src/hooks/queries.ts` (gradually replace exports)

This is the biggest migration step. Each `useXxx()` hook currently fetches from the server via TanStack Query. We replace them with `useLiveQuery()` from Dexie, which reactively watches IndexedDB.

- [ ] **Step 1: Create local query hooks for views**

```typescript
// frontend/src/hooks/localQueries.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { localDb } from '../db';

export function useLocalInbox() {
  return useLiveQuery(async () => {
    const tasks = await localDb.tasks
      .where('status').equals('open')
      .filter((t) => !t.deleted_at && !t.project_id && !t.area_id && !t.when_date)
      .sortBy('sort_order_today');
    return tasks;
  }, []);
}

export function useLocalToday() {
  const today = new Date().toISOString().split('T')[0];
  return useLiveQuery(async () => {
    const tasks = await localDb.tasks
      .where('when_date').equals(today)
      .filter((t) => t.status === 'open' && !t.deleted_at)
      .sortBy('sort_order_today');
    return tasks;
  }, [today]);
}

export function useLocalUpcoming() {
  const today = new Date().toISOString().split('T')[0];
  return useLiveQuery(async () => {
    const tasks = await localDb.tasks
      .where('when_date').above(today)
      .filter((t) => t.status === 'open' && !t.deleted_at)
      .sortBy('when_date');
    return tasks;
  }, [today]);
}

export function useLocalAnytime() {
  return useLiveQuery(async () => {
    return localDb.tasks
      .filter((t) => t.status === 'open' && !t.deleted_at && !t.when_date && (!!t.project_id || !!t.area_id))
      .sortBy('sort_order_project');
  }, []);
}

export function useLocalSomeday() {
  return useLiveQuery(async () => {
    return localDb.tasks
      .where('status').equals('someday')
      .filter((t) => !t.deleted_at)
      .toArray();
  }, []);
}

export function useLocalTask(id: string | null) {
  return useLiveQuery(async () => {
    if (!id) return null;
    const task = await localDb.tasks.get(id);
    if (!task) return null;
    // Load related data
    const checklist = await localDb.checklistItems.where('task_id').equals(id).sortBy('sort_order');
    const attachments = await localDb.attachments.where('task_id').equals(id).sortBy('sort_order');
    const schedules = await localDb.schedules.where('task_id').equals(id).sortBy('sort_order');
    const reminders = await localDb.reminders.where('task_id').equals(id).toArray();
    const repeatRule = await localDb.repeatRules.where('task_id').equals(id).first();
    return { ...task, checklist_items: checklist, attachments, schedules, reminders, repeat_rule: repeatRule };
  }, [id]);
}

export function useLocalProjects() {
  return useLiveQuery(() => localDb.projects.where('status').notEqual('completed').sortBy('sort_order'), []);
}

export function useLocalAreas() {
  return useLiveQuery(() => localDb.areas.orderBy('sort_order').toArray(), []);
}

export function useLocalTags() {
  return useLiveQuery(() => localDb.tags.orderBy('sort_order').toArray(), []);
}

export function useLocalViewCounts() {
  const today = new Date().toISOString().split('T')[0];
  return useLiveQuery(async () => {
    const inbox = await localDb.tasks.filter((t) => t.status === 'open' && !t.deleted_at && !t.project_id && !t.area_id && !t.when_date).count();
    const todayCount = await localDb.tasks.filter((t) => t.status === 'open' && !t.deleted_at && t.when_date === today).count();
    const upcoming = await localDb.tasks.filter((t) => t.status === 'open' && !t.deleted_at && !!t.when_date && t.when_date > today).count();
    const anytime = await localDb.tasks.filter((t) => t.status === 'open' && !t.deleted_at && !t.when_date && (!!t.project_id || !!t.area_id)).count();
    const someday = await localDb.tasks.filter((t) => t.status === 'someday' && !t.deleted_at).count();
    return { inbox, today: todayCount, upcoming, anytime, someday };
  }, [today]);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/localQueries.ts
git commit -m "feat(sync): add Dexie live query hooks for all views"
```

---

### Task 13: Migrate Mutation Hooks to Use Local Mutations

**Files:**
- Modify: `frontend/src/hooks/queries.ts` — update mutation hooks to call local mutations instead of API

- [ ] **Step 1: Update useCreateTask to use local mutation**

Replace the API call inside `useCreateTask` with `createTask()` from `db/mutations.ts`. Remove the TanStack Query mutation wrapper — since Dexie live queries automatically re-render on IndexedDB changes, we don't need `useMutation` or manual cache invalidation.

However, to minimize disruption, we can keep the `useMutation` wrapper but change the `mutationFn`:

```typescript
export function useCreateTask() {
  return useMutation({
    mutationFn: async (data: CreateTaskRequest) => {
      const id = await createTask(data);
      return { id, ...data };
    },
    // No need for onSuccess/onError cache invalidation — Dexie live queries handle it
  });
}
```

- [ ] **Step 2: Repeat for all mutation hooks**

Update: `useUpdateTask`, `useCompleteTask`, `useCancelTask`, `useWontDoTask`, `useReopenTask`, `useDeleteTask`, `useRestoreTask`, `useCreateProject`, `useUpdateProject`, etc.

- [ ] **Step 3: Update view query hooks to use local queries**

Replace `useInbox`, `useToday`, etc. exports with local versions. Import from `localQueries.ts`.

- [ ] **Step 4: Run frontend tests**

Run: `cd frontend && npm test`
Expected: Some tests will need updating (mocked API calls → mocked IndexedDB). Use `fake-indexeddb` package for testing.

- [ ] **Step 5: Install fake-indexeddb for testing**

```bash
cd frontend && npm install -D fake-indexeddb
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/ frontend/package.json frontend/package-lock.json
git commit -m "feat(sync): migrate mutation and query hooks to local-first with Dexie"
```

---

## Chunk 3: Frontend — UI Integration & Offline Experience

### Task 14: Initialize Sync Engine on App Start

**Files:**
- Modify: `frontend/src/main.tsx` or `frontend/src/App.tsx`

- [ ] **Step 1: Start sync engine after auth**

In the main app initialization (after auth is confirmed), call `startSyncEngine()`. On first load with empty IndexedDB, trigger `fullSync()` to populate local data.

```typescript
// In App.tsx or a SyncProvider component
import { startSyncEngine, syncNow } from './sync/engine';
import { localDb } from './db';

useEffect(() => {
  async function init() {
    const taskCount = await localDb.tasks.count();
    if (taskCount === 0) {
      // First time — do a full sync to populate IndexedDB
      await fullSync();
    }
    startSyncEngine();
  }
  init();
  return () => stopSyncEngine();
}, []);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(sync): initialize sync engine on app start with first-load full sync"
```

---

### Task 15: Sync Status Indicator in UI

**Files:**
- Create: `frontend/src/components/SyncStatus.tsx`
- Modify: `frontend/src/components/Sidebar.tsx` (or `AppLayout.tsx`)

- [ ] **Step 1: Create SyncStatus component**

```tsx
// frontend/src/components/SyncStatus.tsx
import { useSyncStore } from '../sync/status';
import { syncNow } from '../sync/engine';

export function SyncStatus() {
  const { status, pendingCount, lastSyncAt, error } = useSyncStore();

  return (
    <button
      onClick={() => syncNow()}
      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded"
      title={error || (lastSyncAt ? `Last synced: ${new Date(lastSyncAt).toLocaleTimeString()}` : 'Not synced yet')}
    >
      {status === 'syncing' && <Spinner />}
      {status === 'offline' && <OfflineIcon />}
      {status === 'error' && <ErrorIcon />}
      {status === 'idle' && pendingCount > 0 && <PendingIcon count={pendingCount} />}
      {status === 'idle' && pendingCount === 0 && <SyncedIcon />}
    </button>
  );
}
```

- [ ] **Step 2: Add SyncStatus to sidebar footer or app header**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SyncStatus.tsx frontend/src/components/Sidebar.tsx
git commit -m "feat(sync): add sync status indicator with offline/syncing/error states"
```

---

### Task 16: Offline Banner & Network Detection

**Files:**
- Create: `frontend/src/components/OfflineBanner.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`

- [ ] **Step 1: Create a subtle offline banner**

When offline, show a small banner at the top: "You're offline. Changes will sync when you reconnect."

```tsx
export function OfflineBanner() {
  const { status } = useSyncStore();
  if (status !== 'offline') return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs text-center py-1.5 px-4">
      You're offline. Changes will sync when you reconnect.
    </div>
  );
}
```

- [ ] **Step 2: Add to AppLayout above the main content area**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/OfflineBanner.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat(sync): add offline banner notification"
```

---

### Task 17: Handle SSE Reconnection with Sync

**Files:**
- Modify: `frontend/src/hooks/useSSE.ts`

Currently, SSE events trigger TanStack Query invalidations. In the local-first model, SSE should trigger a sync pull instead.

- [ ] **Step 1: Update SSE handler to trigger sync**

When an SSE event arrives (task_created, task_updated, etc.), call `syncNow()` instead of invalidating TanStack Query caches. This pulls the latest changes into IndexedDB, which automatically updates the UI via `useLiveQuery`.

```typescript
// In useSSE.ts event handler
import { syncNow } from '../sync/engine';

eventSource.onmessage = (event) => {
  // Trigger a sync pull to get the latest data
  syncNow();
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/useSSE.ts
git commit -m "feat(sync): SSE events trigger sync pull instead of direct cache invalidation"
```

---

### Task 18: Service Worker & PWA Offline Support

**Files:**
- Modify: `frontend/vite.config.ts`

The existing `vite-plugin-pwa` setup should be updated to:
1. Precache the app shell (HTML, CSS, JS) for offline access
2. NOT cache API responses (sync engine handles data)
3. Support Background Sync API for queued mutations

- [ ] **Step 1: Update vite-plugin-pwa config**

```typescript
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    // Don't cache API responses — IndexedDB handles data
    navigateFallback: '/index.html',
    navigateFallbackAllowlist: [/^(?!\/api)/],
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add frontend/vite.config.ts
git commit -m "feat(sync): update PWA config for offline-first (precache shell, skip API caching)"
```

---

## Chunk 4: Migration & Cleanup

### Task 19: Gradual TanStack Query Removal

**Files:**
- Modify: `frontend/src/hooks/queries.ts`
- Modify: Multiple page components that import from queries.ts

This is the largest migration task. Each view page needs to switch from `useInbox()` (TanStack) to `useLocalInbox()` (Dexie). Do this incrementally, one view at a time.

**Migration order** (simplest first):
1. InboxView → useLocalInbox
2. TodayView → useLocalToday
3. UpcomingView → useLocalUpcoming
4. AnytimeView → useLocalAnytime
5. SomedayView → useLocalSomeday
6. LogbookView → useLocalLogbook
7. TrashView → useLocalTrash
8. ProjectView → useLocalProject
9. AreaView → useLocalArea
10. TagView → useLocalTagTasks
11. Sidebar counts → useLocalViewCounts
12. TaskDetailModal → useLocalTask
13. SearchOverlay → useLocalSearch

- [ ] **Step 1: Migrate InboxView**

Replace `useInbox()` with `useLocalInbox()` in `InboxView.tsx`. The return shape should match what the component expects. Add a compatibility wrapper if needed.

- [ ] **Step 2: Test InboxView works offline**

1. Load the app online, let sync complete
2. Go offline (DevTools → Network → Offline)
3. Navigate to Inbox — should show cached tasks
4. Create a task — should appear immediately
5. Go online — task should sync to server

- [ ] **Step 3: Migrate remaining views one by one, testing each**

- [ ] **Step 4: Once all views migrated, remove unused TanStack Query hooks**

Keep TanStack Query installed for any remaining server-only queries (auth, settings), but remove the task/project/area/tag query hooks.

- [ ] **Step 5: Commit after each view migration**

```bash
git commit -m "feat(sync): migrate InboxView to local-first reads"
git commit -m "feat(sync): migrate TodayView to local-first reads"
# ... etc
```

---

### Task 20: Handle First-Load UX (Empty IndexedDB)

**Files:**
- Create: `frontend/src/components/SyncingOverlay.tsx`

- [ ] **Step 1: Show loading state during initial full sync**

On first visit (or after clearing browser data), IndexedDB is empty. Show a brief loading indicator while `fullSync()` runs.

```tsx
export function SyncingOverlay() {
  const [initialSyncing, setInitialSyncing] = useState(true);

  useEffect(() => {
    localDb.tasks.count().then((count) => {
      if (count > 0) {
        setInitialSyncing(false);
      } else {
        fullSync().then(() => setInitialSyncing(false));
      }
    });
  }, []);

  if (!initialSyncing) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-900 z-50">
      <div className="text-center">
        <Spinner className="w-8 h-8 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Syncing your tasks...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SyncingOverlay.tsx
git commit -m "feat(sync): add initial sync loading overlay for first-time devices"
```

---

### Task 21: Conflict UI (Optional but Recommended)

**Files:**
- Create: `frontend/src/components/ConflictIndicator.tsx`

- [ ] **Step 1: Show subtle indicator on tasks with sync conflicts**

If the server rejects a client change or resolves a conflict differently, mark the task with a small icon. The user can tap to see "This task was updated on another device."

Most of the time LWW handles this silently, but for rare cases where both devices edit the same field, showing a brief toast ("Title updated on another device") builds trust.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ConflictIndicator.tsx
git commit -m "feat(sync): add conflict indicator for server-resolved changes"
```

---

### Task 22: Lazy Attachment File Caching

**Files:**
- Create: `frontend/src/db/attachmentCache.ts`
- Modify: `frontend/src/db/index.ts` — add `cachedFiles` table
- Modify: `frontend/src/components/AttachmentItem.tsx` (or wherever attachments are rendered)

Attachment **metadata** (title, URL, mime type, size) already syncs with the rest of the data via the change log. This task adds lazy caching of the actual file **contents** into IndexedDB so previously-viewed attachments are available offline.

**Strategy:**
- Download file blob to IndexedDB when the user first opens/views an attachment
- On subsequent views, serve from cache (instant, works offline)
- Enforce a **100MB storage budget** — evict least-recently-accessed files when exceeded
- Show a "not available offline" placeholder for uncached files when offline

- [ ] **Step 1: Add cachedFiles table to Dexie schema**

```typescript
// In frontend/src/db/index.ts — bump Dexie version
export interface CachedFile {
  attachmentId: string;    // matches attachment.id
  blob: Blob;              // the actual file content
  mimeType: string;
  size: number;            // bytes
  cachedAt: string;        // ISO timestamp
  lastAccessedAt: string;  // ISO timestamp, updated on each view
}

// In ThingsToDoDatabase constructor, add version(2):
this.version(2).stores({
  // ... all existing stores unchanged ...
  cachedFiles: 'attachmentId, lastAccessedAt, cachedAt',
}).upgrade((tx) => {
  // No data migration needed — new table
});
```

- [ ] **Step 2: Create attachment cache module**

```typescript
// frontend/src/db/attachmentCache.ts
import { localDb, type CachedFile } from './index';

const CACHE_BUDGET_BYTES = 100 * 1024 * 1024; // 100MB

export async function getCachedAttachment(attachmentId: string): Promise<Blob | null> {
  const cached = await localDb.cachedFiles.get(attachmentId);
  if (!cached) return null;

  // Update last accessed time (non-blocking)
  localDb.cachedFiles.update(attachmentId, {
    lastAccessedAt: new Date().toISOString(),
  });

  return cached.blob;
}

export async function cacheAttachment(attachmentId: string, blob: Blob, mimeType: string): Promise<void> {
  // Enforce budget before adding
  await enforceBudget(blob.size);

  await localDb.cachedFiles.put({
    attachmentId,
    blob,
    mimeType,
    size: blob.size,
    cachedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
  });
}

export async function isAttachmentCached(attachmentId: string): Promise<boolean> {
  return (await localDb.cachedFiles.get(attachmentId)) !== null;
}

async function enforceBudget(incomingBytes: number): Promise<void> {
  const allCached = await localDb.cachedFiles.orderBy('lastAccessedAt').toArray();
  let totalSize = allCached.reduce((sum, f) => sum + f.size, 0);

  // Evict oldest-accessed files until we're under budget
  let i = 0;
  while (totalSize + incomingBytes > CACHE_BUDGET_BYTES && i < allCached.length) {
    await localDb.cachedFiles.delete(allCached[i].attachmentId);
    totalSize -= allCached[i].size;
    i++;
  }
}

export async function clearAttachmentCache(): Promise<void> {
  await localDb.cachedFiles.clear();
}

export async function getCacheStats(): Promise<{ count: number; totalSizeMB: number }> {
  const all = await localDb.cachedFiles.toArray();
  const totalSize = all.reduce((sum, f) => sum + f.size, 0);
  return { count: all.length, totalSizeMB: Math.round(totalSize / 1024 / 1024 * 10) / 10 };
}
```

- [ ] **Step 3: Run tests for cache budget enforcement**

```typescript
test('evicts oldest files when budget exceeded', async () => {
  // Mock: add files totaling 95MB
  // Add a 10MB file — should evict oldest until under 100MB
});
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/db/attachmentCache.ts frontend/src/db/index.ts
git commit -m "feat(sync): add lazy attachment file caching with 100MB LRU budget"
```

- [ ] **Step 5: Integrate into attachment UI**

When rendering an attachment (file type):

```tsx
// In the attachment display component
import { getCachedAttachment, cacheAttachment } from '../db/attachmentCache';

async function handleOpenAttachment(attachment: Attachment) {
  // 1. Check cache first
  let blob = await getCachedAttachment(attachment.id);

  if (!blob) {
    if (!navigator.onLine) {
      // Show "not available offline" toast
      showToast('This file isn't available offline yet');
      return;
    }
    // 2. Download from server
    const response = await fetch(attachment.url, { credentials: 'include' });
    blob = await response.blob();
    // 3. Cache for offline use
    await cacheAttachment(attachment.id, blob, attachment.mime_type);
  }

  // 4. Open the file
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Clean up object URL after a delay
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
```

For image attachments shown inline (thumbnails), cache on first render:

```tsx
function AttachmentThumbnail({ attachment }: { attachment: Attachment }) {
  const [src, setSrc] = useState<string | null>(null);
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;

    (async () => {
      // Try cache first
      const cached = await getCachedAttachment(attachment.id);
      if (cached) {
        objectUrl = URL.createObjectURL(cached);
        setSrc(objectUrl);
        return;
      }
      if (!navigator.onLine) {
        setOfflineUnavailable(true);
        return;
      }
      // Download and cache
      const response = await fetch(attachment.url, { credentials: 'include' });
      const blob = await response.blob();
      await cacheAttachment(attachment.id, blob, attachment.mime_type);
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    })();

    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.id]);

  if (offlineUnavailable) {
    return <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center text-xs text-gray-400">Offline</div>;
  }
  if (!src) return <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />;
  return <img src={src} className="w-12 h-12 object-cover rounded" />;
}
```

- [ ] **Step 6: Add cache stats to settings (optional)**

Show "Attachment cache: 12 files, 34.2 MB" in the settings page with a "Clear cache" button.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/AttachmentItem.tsx frontend/src/pages/SettingsView.tsx
git commit -m "feat(sync): integrate lazy attachment caching into attachment UI with offline fallback"
```

---

### Task 23: Catch-Up Reminders & Near-Term Local Scheduling

**Files:**
- Create: `frontend/src/sync/reminders.ts`
- Create: `frontend/src/components/MissedRemindersToast.tsx`
- Modify: `frontend/src/db/index.ts` — add `seenReminders` table
- Modify: `frontend/src/sync/pull.ts` — hook into reminder_fired events
- Modify: `frontend/src/sync/engine.ts` — start local reminder scheduler

Reminders are processed server-side (Go cron every minute). When offline, the server fires a web push that can't reach the device. This task adds two pragmatic mitigations:

1. **Catch-up reminders on reconnect** — when the sync engine pulls changes after being offline, detect any `reminder_fired` events that occurred while disconnected and show them as a batch notification.
2. **Near-term local scheduling** — when online, pre-register `setTimeout` + `Notification API` for reminders due within the next 60 minutes. These survive brief connectivity drops (subway tunnel, elevator).

**What this does NOT do:** It does not attempt to replicate the full server-side recurrence engine in JavaScript or schedule reminders hours/days in advance client-side — PWA background execution is too unreliable for that.

- [ ] **Step 1: Add seenReminders table to Dexie schema**

```typescript
// In frontend/src/db/index.ts — bump Dexie version
export interface SeenReminder {
  reminderId: string;
  taskId: string;
  firedAt: string;    // when the server fired it
  seenAt: string;     // when this device showed it to the user
}

// Add to schema:
// seenReminders: 'reminderId, taskId, firedAt'
```

This prevents showing the same catch-up reminder twice (e.g., if the user already dismissed it on another device, the `seenReminders` table on this device records that it was shown here too).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/db/index.ts
git commit -m "feat(sync): add seenReminders table for catch-up reminder tracking"
```

- [ ] **Step 3: Create the catch-up reminders module**

```typescript
// frontend/src/sync/reminders.ts
import { localDb } from '../db';

interface FiredReminder {
  reminderId: string;
  taskId: string;
  taskTitle: string;
  firedAt: string;
}

/**
 * Called after pullChanges() completes. Scans the change log for
 * reminder_fired events that this device hasn't seen yet.
 */
export async function checkMissedReminders(pulledChanges: ChangeLogEntry[]): Promise<FiredReminder[]> {
  const reminderEvents = pulledChanges.filter(
    (c) => c.entity === 'reminder' && c.action === 'fired'
  );

  if (reminderEvents.length === 0) return [];

  const missed: FiredReminder[] = [];

  for (const event of reminderEvents) {
    const snapshot = JSON.parse(event.snapshot);
    const alreadySeen = await localDb.seenReminders.get(snapshot.reminder_id);
    if (alreadySeen) continue;

    // Look up the task title from local DB
    const task = await localDb.tasks.get(snapshot.task_id);

    missed.push({
      reminderId: snapshot.reminder_id,
      taskId: snapshot.task_id,
      taskTitle: task?.title || 'Unknown task',
      firedAt: event.created_at,
    });

    // Mark as seen on this device
    await localDb.seenReminders.put({
      reminderId: snapshot.reminder_id,
      taskId: snapshot.task_id,
      firedAt: event.created_at,
      seenAt: new Date().toISOString(),
    });
  }

  return missed;
}

/**
 * Schedule local notifications for reminders due within the next 60 minutes.
 * Called periodically by the sync engine when online.
 */
let scheduledTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

export async function scheduleNearTermReminders(): Promise<void> {
  // Only works if notification permission is granted
  if (Notification.permission !== 'granted') return;

  const now = new Date();
  const cutoff = new Date(now.getTime() + 60 * 60 * 1000); // 60 min from now

  const reminders = await localDb.reminders.toArray();

  for (const reminder of reminders) {
    // Skip if already scheduled
    if (scheduledTimers.has(reminder.id)) continue;

    // Only handle exact-time reminders for simplicity
    if (reminder.type !== 'exact' || !reminder.exact_at) continue;

    const fireAt = new Date(reminder.exact_at);
    if (fireAt <= now || fireAt > cutoff) continue;

    const delay = fireAt.getTime() - now.getTime();
    const task = await localDb.tasks.get(reminder.task_id);
    if (!task || task.status !== 'open' || task.deleted_at) continue;

    const timer = setTimeout(() => {
      // Check if still relevant (task might have been completed)
      localDb.tasks.get(reminder.task_id).then((t) => {
        if (!t || t.status !== 'open' || t.deleted_at) return;

        new Notification('ThingsToDo Reminder', {
          body: t.title,
          icon: '/favicon-192.png',
          tag: `reminder-${reminder.id}`,
          data: { taskId: t.id },
        });

        // Mark as seen locally
        localDb.seenReminders.put({
          reminderId: reminder.id,
          taskId: reminder.task_id,
          firedAt: new Date().toISOString(),
          seenAt: new Date().toISOString(),
        });
      });

      scheduledTimers.delete(reminder.id);
    }, delay);

    scheduledTimers.set(reminder.id, timer);
  }
}

export function clearScheduledReminders(): void {
  for (const timer of scheduledTimers.values()) {
    clearTimeout(timer);
  }
  scheduledTimers.clear();
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/sync/reminders.ts
git commit -m "feat(sync): add catch-up missed reminders and near-term local scheduling"
```

- [ ] **Step 5: Integrate into sync engine**

In `frontend/src/sync/engine.ts`, after `pullChanges()` completes:

```typescript
import { checkMissedReminders, scheduleNearTermReminders } from './reminders';

// Inside syncNow(), after pullChanges():
const missed = await checkMissedReminders(pulledChanges);
if (missed.length > 0) {
  // Emit to UI — show toast or notification
  showMissedRemindersToast(missed);
}

// Re-schedule near-term reminders after each sync
await scheduleNearTermReminders();
```

This requires `pullChanges()` to return the pulled changes array (minor refactor — it currently returns a count).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/sync/engine.ts frontend/src/sync/pull.ts
git commit -m "feat(sync): hook catch-up reminders into sync engine pull cycle"
```

- [ ] **Step 7: Create MissedRemindersToast component**

```tsx
// frontend/src/components/MissedRemindersToast.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface MissedReminder {
  reminderId: string;
  taskId: string;
  taskTitle: string;
  firedAt: string;
}

// Global event emitter for missed reminders (set by sync engine)
type MissedHandler = (reminders: MissedReminder[]) => void;
let handler: MissedHandler | null = null;
export function onMissedReminders(fn: MissedHandler) { handler = fn; }
export function emitMissedReminders(reminders: MissedReminder[]) { handler?.(reminders); }

export function MissedRemindersToast() {
  const [missed, setMissed] = useState<MissedReminder[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    onMissedReminders((reminders) => setMissed(reminders));
    return () => { handler = null; };
  }, []);

  if (missed.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {missed.length === 1 ? 'Missed reminder' : `${missed.length} missed reminders`}
        </span>
        <button
          onClick={() => setMissed([])}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
        >
          Dismiss
        </button>
      </div>
      <ul className="space-y-1">
        {missed.slice(0, 5).map((r) => (
          <li key={r.reminderId}>
            <button
              onClick={() => { navigate(`/task/${r.taskId}`); setMissed([]); }}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block w-full text-left"
            >
              {r.taskTitle}
            </button>
            <span className="text-xs text-gray-400">
              {new Date(r.firedAt).toLocaleString()}
            </span>
          </li>
        ))}
        {missed.length > 5 && (
          <li className="text-xs text-gray-400">
            +{missed.length - 5} more
          </li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: Add MissedRemindersToast to AppLayout**

```tsx
// In AppLayout.tsx
import { MissedRemindersToast } from './MissedRemindersToast';

// Add inside the layout:
<MissedRemindersToast />
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/MissedRemindersToast.tsx frontend/src/components/AppLayout.tsx
git commit -m "feat(sync): add missed reminders toast UI with task navigation"
```

- [ ] **Step 10: Clean up stale seenReminders (optional)**

Add a periodic cleanup that removes `seenReminders` entries older than 30 days to prevent the table from growing indefinitely:

```typescript
// In sync engine init
async function pruneOldSeenReminders() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await localDb.seenReminders.where('firedAt').below(cutoff).delete();
}
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/sync/engine.ts
git commit -m "feat(sync): add periodic cleanup of stale seenReminders entries"
```

---

## Chunk 5: Testing & Hardening

### Task 24: Backend Sync Integration Tests

**Files:**
- Create: `internal/handler/sync_integration_test.go`

- [ ] **Step 1: Write end-to-end sync flow test**

```go
func TestSyncFlow_PushPull(t *testing.T) {
  // 1. Create task via normal API
  // 2. Pull changes — should include the task
  // 3. Push an update from "device 2"
  // 4. Pull again — should include the update
  // 5. Push conflicting update — verify LWW resolution
}
```

- [ ] **Step 2: Write conflict resolution test**

```go
func TestSyncConflict_LastWriteWins(t *testing.T) {
  // 1. Create task with title "A"
  // 2. Push update: title="B", client_updated_at=T1
  // 3. Update on server: title="C", updated_at=T2 (T2 > T1)
  // 4. Push update: title="D", client_updated_at=T3 (T3 > T2)
  // 5. Verify title is "D" (client wins because T3 > T2)
}
```

- [ ] **Step 3: Run tests**

Run: `go test ./internal/handler/ -v -run TestSync`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add internal/handler/sync_integration_test.go
git commit -m "test(sync): add integration tests for push/pull and conflict resolution"
```

---

### Task 25: Frontend Sync Tests

**Files:**
- Create: `frontend/src/sync/__tests__/engine.test.ts`
- Create: `frontend/src/sync/__tests__/push.test.ts`
- Create: `frontend/src/sync/__tests__/pull.test.ts`

- [ ] **Step 1: Set up fake-indexeddb in test setup**

```typescript
// frontend/src/test-setup.ts (add)
import 'fake-indexeddb/auto';
```

- [ ] **Step 2: Write push queue test**

```typescript
test('mutations queue changes and write to IndexedDB', async () => {
  const id = await createTask({ title: 'Test task' });
  const task = await localDb.tasks.get(id);
  expect(task?.title).toBe('Test task');
  expect(task?._syncStatus).toBe('pending');

  const queue = await localDb.syncQueue.toArray();
  expect(queue).toHaveLength(1);
  expect(queue[0].entity).toBe('task');
  expect(queue[0].action).toBe('create');
});
```

- [ ] **Step 3: Write pull apply test**

```typescript
test('pull applies remote changes to IndexedDB', async () => {
  // Mock API to return changes
  // Call pullChanges()
  // Verify IndexedDB updated
});
```

- [ ] **Step 4: Run tests**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/sync/__tests__/ frontend/src/test-setup.ts
git commit -m "test(sync): add frontend sync engine tests with fake-indexeddb"
```

---

### Task 26: Manual Testing Checklist

This is not code — it's a verification checklist for QA.

- [ ] **Offline create**: Go offline → create task → appears in UI → go online → task syncs to server
- [ ] **Offline edit**: Go offline → edit task title → go online → change appears on server
- [ ] **Offline complete**: Go offline → complete task → go online → completion syncs
- [ ] **Multi-device**: Open on two devices → create task on device A → appears on device B within 30s
- [ ] **Multi-device conflict**: Edit same task on both devices offline → go online → LWW resolves correctly
- [ ] **First load**: Clear IndexedDB → reload → full sync populates all data
- [ ] **Stale cursor**: Wait 90+ days (simulate by purging change log) → sync recovers via full sync
- [ ] **Large dataset**: Import 1000+ tasks → sync completes without errors
- [ ] **PWA install**: Install on mobile → works offline → syncs when back online
- [ ] **Attachment cache hit**: Open a file attachment → close → go offline → open again → file loads from cache
- [ ] **Attachment cache miss offline**: Go offline → open a never-viewed attachment → see "not available offline" message
- [ ] **Attachment cache eviction**: Cache files totaling >100MB → oldest-accessed files are evicted
- [ ] **Clear attachment cache**: Settings → clear cache → cache stats reset to 0
- [ ] **Catch-up reminders**: Set reminder for 5 min from now → go offline → wait past the reminder time → go online → see "Missed reminder" toast with task title
- [ ] **Near-term local reminder**: Set reminder for 5 min from now → go offline (brief) → notification fires locally even without network
- [ ] **No duplicate reminders**: Dismiss a reminder on device A → open device B → catch-up does NOT show the same reminder again (seenReminders dedup)
- [ ] **Catch-up toast navigation**: Click a task title in the missed reminders toast → navigates to that task's detail view

---

## Dependencies & Risk Assessment

### New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `dexie` | IndexedDB wrapper | ~30KB gzipped |
| `dexie-react-hooks` | `useLiveQuery` for reactive reads | ~2KB gzipped |
| `fake-indexeddb` (dev) | Testing IndexedDB in Node | dev only |

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **IndexedDB storage limits** | Browsers allow 50-80% of disk. Task metadata is tiny. Attachment cache is capped at 100MB with LRU eviction. |
| **Complex view queries in Dexie** | The server's view endpoints do complex joins. Dexie versions will be simpler (filter + sort). May not perfectly match server grouping logic for Today/Upcoming views. Iterate on this. |
| **Clock skew between devices** | Using server-side sequence numbers (not timestamps) for sync cursor. LWW uses `updated_at` which is set on the server during push, not client time. |
| **Bulk operations** | Bulk actions (complete 50 tasks) create 50 sync queue entries. Batch them in the push endpoint. |
| **Migration from TanStack to Dexie** | Gradual migration, one view at a time. Keep TanStack for auth/settings. |
| **FTS5 search offline** | IndexedDB doesn't have FTS. Use simple `.filter()` with string matching for offline search. Full FTS available when online. |

### What We're NOT Building

- **Real-time collaboration** (Google Docs style) — overkill for a task manager
- **CRDT** — LWW per field is sufficient for task data
- **End-to-end encryption** — Out of scope for this plan
- **Full offline reminder engine** — Replicating the server's recurrence engine in JS for long-term background scheduling is unreliable in PWAs (OS throttles background SW execution). Instead we do catch-up reminders on reconnect + near-term local scheduling (next 60 min) which covers the practical cases.

---

## Execution Order Summary

| Order | Task | Type | Estimated Effort |
|-------|------|------|-----------------|
| 1 | Task 1: Change log migration | Backend | Small |
| 2 | Task 2: ChangeLog repository | Backend | Small |
| 3 | Task 3: Integrate change log into repos | Backend | Medium |
| 4 | Task 4: Sync pull endpoint | Backend | Small |
| 5 | Task 5: Sync push endpoint + LWW | Backend | Medium |
| 6 | Task 6: Register routes | Backend | Small |
| 7 | Task 7: Purge cron + full sync endpoint | Backend | Small |
| 8 | Task 8: Update API docs | Docs | Small |
| 9 | Task 9: Dexie.js local DB | Frontend | Small |
| 10 | Task 10: Sync engine (push/pull) | Frontend | Medium |
| 11 | Task 11: Local mutation layer | Frontend | Medium |
| 12 | Task 12: Dexie live query hooks | Frontend | Medium |
| 13 | Task 13: Migrate mutation hooks | Frontend | Medium |
| 14 | Task 14: Init sync on app start | Frontend | Small |
| 15 | Task 15: Sync status indicator | Frontend | Small |
| 16 | Task 16: Offline banner | Frontend | Small |
| 17 | Task 17: SSE → sync trigger | Frontend | Small |
| 18 | Task 18: PWA config update | Frontend | Small |
| 19 | Task 19: Migrate all views to Dexie | Frontend | Large |
| 20 | Task 20: First-load UX | Frontend | Small |
| 21 | Task 21: Conflict indicator | Frontend | Small |
| 22 | Task 22: Lazy attachment file caching | Frontend | Medium |
| 23 | Task 23: Catch-up reminders + local scheduling | Frontend | Medium |
| 24 | Task 24: Backend sync tests | Test | Medium |
| 25 | Task 25: Frontend sync tests | Test | Medium |
| 26 | Task 26: Manual QA | Test | Medium |

**Backend tasks (1-8)** and **Frontend tasks (9-23)** can be worked on in parallel by separate agents after Task 8 is done (frontend needs the API contract).
