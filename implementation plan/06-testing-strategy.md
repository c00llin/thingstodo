# Testing Strategy (TDD)

**Goal:** Write tests first, implement second. Every module gets tests before or alongside its implementation. Tests run in CI and as agent team quality gates.

---

## Approach: Test-Driven Development

The workflow for every feature:

1. **Write the test** — define expected behavior
2. **Run it — confirm it fails** (red)
3. **Write the minimal implementation** to make it pass (green)
4. **Refactor** if needed, keeping tests green

This applies to both backend (Go) and frontend (React). Tests are not an afterthought — they're written as part of each phase, not bolted on at the end.

---

## Backend Testing (Go)

### Test Framework

- Go's built-in `testing` package — no external test framework needed
- `net/http/httptest` — for handler/HTTP tests
- `testing/fstest` or temp directories — for file attachment tests
- **No mocking framework** — use interfaces + simple test doubles (Go idiom)

### Test Layers

```
┌─────────────────────────────────────────┐
│        Integration Tests (API)          │  ← Full HTTP round-trip
│     httptest.Server + real SQLite       │
├─────────────────────────────────────────┤
│        Repository Tests (Data)          │  ← SQL against real in-memory SQLite
│     In-memory SQLite + migrations       │
├─────────────────────────────────────────┤
│          Unit Tests (Logic)             │  ← Pure functions, no DB
│     Date calc, position math, auth      │
└─────────────────────────────────────────┘
```

### 1. Repository Tests (most critical)

Each repository file gets a `_test.go` companion. Tests run against a real in-memory SQLite database (not mocks) — this catches SQL bugs, constraint violations, and migration issues.

**File:** `internal/repository/tasks_test.go`

```go
func setupTestDB(t *testing.T) *sql.DB {
    db, err := sql.Open("sqlite", ":memory:")
    require.NoError(t, err)
    runMigrations(db)  // apply all migrations
    t.Cleanup(func() { db.Close() })
    return db
}
```

**Test cases per repository:**

| Repository | Key Test Cases |
|---|---|
| **TaskRepository** | Create task, update fields, complete (sets completed_at), cancel, won't do, reopen, delete, list with filters (by status, project, area, date range, tag), reorder (fractional positioning), inbox filter (no project, no area, no when_date) |
| **ProjectRepository** | Create, complete (only when all tasks done), delete cascades headings, progress calculation (X of Y tasks), list by area |
| **AreaRepository** | Create, delete sets null on projects/tasks, list with project counts |
| **TagRepository** | Create (unique title), attach to task, detach, attach to project, list tasks by tag, delete cascades junction rows |
| **HeadingRepository** | Create within project, reorder, delete reassigns tasks to no-heading |
| **ChecklistRepository** | Create, toggle completed, reorder, delete, list by task |
| **AttachmentRepository** | Create file attachment (metadata), create link, delete, list by task |
| **RepeatRuleRepository** | Create fixed rule, create after-completion rule, next date calculation for all frequencies |
| **SearchRepository** | FTS5 match on title, match on notes, ranking (title match > notes match), empty query returns nothing |
| **UserRepository** | Create user, get by username, password hash stored (not plaintext) |

**View query tests:**

| View | Key Test Cases |
|---|---|
| **Inbox** | Only shows tasks with no project, no area, no when_date, status=open |
| **Today** | Shows tasks where when_date=today OR deadline=today, splits into today/evening sections, groups by project |
| **Upcoming** | Only future-dated tasks, grouped by date, sorted chronologically |
| **Anytime** | All open non-someday tasks, grouped by area then project |
| **Someday** | Only someday-deferred tasks |
| **Logbook** | Only completed/canceled/wont_do, reverse chronological, grouped by date |

### 2. Handler / Integration Tests

Test the full HTTP layer: request parsing, validation, response format, status codes, error handling.

**File:** `internal/handler/tasks_test.go`

```go
func setupTestServer(t *testing.T) (*httptest.Server, *sql.DB) {
    db := setupTestDB(t)
    router := setupRouter(db)  // same router as production
    server := httptest.NewServer(router)
    t.Cleanup(server.Close)
    return server, db
}
```

**Test cases per handler:**

| Endpoint | Test Cases |
|---|---|
| `POST /api/tasks` | Valid creation (201 + body), missing title (400), invalid project_id (400), sets default status=open |
| `GET /api/tasks/:id` | Existing task (200 + full response with tags, checklist, attachments), non-existent (404) |
| `PATCH /api/tasks/:id` | Partial update (only title), partial update (only when_date), non-existent (404), invalid field (400) |
| `PATCH /api/tasks/:id/complete` | Sets status + completed_at, already completed (idempotent or 409), triggers repeat rule |
| `DELETE /api/tasks/:id` | Soft delete (200), non-existent (404) |
| `PATCH /api/tasks/reorder` | Valid reorder (updates positions), empty list (400) |
| `GET /api/views/today` | Correct structure (today section + evening section), correct filtering |
| `GET /api/events` | SSE connection opens, receives events on mutations |

**Auth tests:**

| Scenario | Test Cases |
|---|---|
| Built-in mode | Login with valid credentials (200 + cookie), invalid password (401), protected endpoint without cookie (401), protected endpoint with valid cookie (200) |
| Proxy mode | All endpoints accessible without auth, Remote-User header read correctly |

### 3. Unit Tests (Pure Logic)

For business logic that doesn't touch the database:

| Module | Test Cases |
|---|---|
| **Repeat rule calculator** | Daily: next day. Weekly on Mon/Wed/Fri: correct next date. Monthly: handles 31st → 28th. Yearly: handles leap years. After-completion mode: calculates from completion date, not scheduled date. |
| **Fractional positioning** | Insert between 1.0 and 2.0 → 1.5. Insert at start → half of first. Insert at end → last + 1.0. Many inserts don't cause precision issues. |
| **Config parsing** | Default values applied. Invalid AUTH_MODE rejected. Port parsing. |
| **JWT** | Token generation, token validation, expired token rejected, tampered token rejected. |

### 4. SSE Broker Tests

| Test Cases |
|---|
| Subscribe creates a client channel |
| Broadcast sends to all clients except the sender |
| Unsubscribe removes client, channel is closed |
| Broadcast with no clients doesn't panic |
| Multiple concurrent subscribe/unsubscribe (race condition test with `-race`) |

---

## Frontend Testing (React)

### Test Framework

- **Vitest** — Vite-native test runner (fast, ESM-first, compatible with Jest API)
- **React Testing Library** (`@testing-library/react`) — test components by behavior, not implementation
- **MSW (Mock Service Worker)** — intercept API calls at the network level (no mocking fetch directly)
- **@testing-library/user-event** — simulate realistic user interactions

### Test Layers

```
┌─────────────────────────────────────────┐
│      E2E Tests (optional, later)        │  ← Playwright, full app
├─────────────────────────────────────────┤
│      Integration Tests (Views)          │  ← Full view with MSW-mocked API
│     Render view + assert DOM            │
├─────────────────────────────────────────┤
│      Component Tests (UI units)         │  ← Individual components
│     TaskItem, ChecklistEditor, etc.     │
├─────────────────────────────────────────┤
│      Unit Tests (Logic)                 │  ← Pure functions
│     Date parser, position calc, utils   │
└─────────────────────────────────────────┘
```

### 1. Unit Tests (Pure Functions)

**File:** `frontend/src/lib/__tests__/date-parser.test.ts`

| Module | Test Cases |
|---|---|
| **Natural language date parser** | "today" → current date, "tomorrow" → +1 day, "next week" → next Monday, "friday" → coming Friday, "in 3 days" → +3 days, "this evening" → today + evening flag, invalid input → null |
| **Position calculator** | Insert between items, insert at start/end, fractional math |
| **Query key helpers** | Correct keys generated for each entity |
| **API client** | Error handling (non-200 throws ApiError with status + body) |

### 2. Component Tests

**File:** `frontend/src/components/__tests__/TaskItem.test.tsx`

| Component | Test Cases |
|---|---|
| **TaskItem** | Renders title, shows tags, shows when_date, shows deadline indicator, checkbox click calls onComplete, click expands detail, renders project breadcrumb when outside project context |
| **TaskDetail** | Expands with all fields, title is editable (blur saves), notes textarea works, date picker opens and selects date, tag selector adds/removes tags, checklist items render and toggle, attachments listed, Escape collapses |
| **ChecklistEditor** | Renders items in order, toggle marks complete, add new item, delete item, reorder (if testing DnD — or skip for unit test) |
| **Sidebar** | Smart list items render with correct labels, active item highlighted, area sections collapsible, project count badges, navigation on click changes route |
| **DatePicker** | Opens popover, selecting date calls onChange, natural language input parsed and shown |
| **TagSelect** | Shows existing tags, select/deselect works, create new tag inline |

### MSW Setup

**File:** `frontend/src/test/mocks/handlers.ts`

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/views/inbox', () => {
    return HttpResponse.json({
      tasks: [
        { id: 'abc123', title: 'Buy groceries', status: 'open', tags: [] },
        { id: 'def456', title: 'Call dentist', status: 'open', tags: [] },
      ],
    });
  }),
  http.patch('/api/tasks/:id/complete', ({ params }) => {
    return HttpResponse.json({ id: params.id, status: 'completed' });
  }),
  // ... handlers for all endpoints
];
```

### 3. View Integration Tests

Test full views with TanStack Query + MSW. These prove that the view correctly fetches, renders, and reacts to user actions.

**File:** `frontend/src/pages/__tests__/InboxView.test.tsx`

| View | Test Cases |
|---|---|
| **InboxView** | Renders tasks from API, loading state shown, empty state when no tasks, completing a task removes it from list, creating a task adds it to list |
| **TodayView** | Renders "Today" and "This Evening" sections, tasks grouped by project, deadline indicators shown |
| **ProjectView** | Renders project title + progress bar, tasks grouped by headings, "no heading" tasks shown separately, complete project button |
| **UpcomingView** | Date groups render in chronological order, calendar widget navigates |
| **LogbookView** | Completed tasks shown reverse-chronological, status icons (completed/canceled/won't do) correct |

### 4. Hook Tests

**File:** `frontend/src/hooks/__tests__/useSSE.test.ts`

| Hook | Test Cases |
|---|---|
| **useSSE** | EventSource connects to /api/events, task_updated event invalidates correct queries, task_created invalidates view queries, reconnects on error |
| **useCompleteTask** | Optimistic update removes task from list immediately, rollback on error restores task, onSettled invalidates queries |

### 5. E2E Tests (Optional — Phase 4+)

If desired, add Playwright tests for critical user flows:

| Flow | Steps |
|---|---|
| **Quick capture** | Open app → Ctrl+Space → type title → Enter → task appears in Inbox |
| **Complete task** | Navigate to Today → click checkbox → animation plays → task moves to Logbook |
| **Drag to project** | Inbox → drag task to sidebar project → task disappears from Inbox → appears in Project view |
| **Multi-device sync** | Open two tabs → complete task in tab 1 → task disappears in tab 2 |

---

## TDD Integration with Phases

### Phase 1: Test Infrastructure

- Set up Vitest + React Testing Library + MSW in frontend
- Verify `go test ./...` works with in-memory SQLite
- CI pipeline runs both `go test ./...` and `npm test`
- Add test commands to Makefile: `test-backend`, `test-frontend`, `test` (both)

### Phase 2: Backend Tests First

For each module, the implementation order becomes:

1. Write repository test (e.g., `tasks_test.go`) — RED
2. Implement repository (`tasks.go`) — GREEN
3. Write handler test (e.g., `handler/tasks_test.go`) — RED
4. Implement handler — GREEN
5. Repeat for next module

**View endpoint tests are especially important** — they validate complex SQL queries that combine multiple filters and groupings.

### Phase 3: Frontend Tests First

For each component/view:

1. Write MSW handler for the endpoint
2. Write component test — RED
3. Implement component — GREEN
4. Write view integration test — RED
5. Implement view — GREEN

### Phase 4: Test the Interactions

- Keyboard shortcut tests (simulate keypress → assert action)
- Optimistic mutation tests (assert immediate UI change + rollback on error)
- SSE hook tests (simulate EventSource messages → assert query invalidation)
- Date parser unit tests (input → expected output table)

---

## TDD in the Agent Team

### Agent Responsibilities

| Agent | Testing Role |
|---|---|
| **Lead** | Reviews test coverage, ensures tests match acceptance criteria |
| **Backend Engineer** | Writes repository tests + handler tests before implementing each module |
| **Frontend Engineer** | Writes component tests + view tests before implementing each component |
| **Infra & Polish** | Sets up test infrastructure (Phase 1), writes E2E tests (Phase 4), maintains CI test pipeline |

### Quality Gate Hook (Updated)

**File:** `.claude/settings.json`

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd /workspaces/thingstodo && go test ./... -count=1 2>&1 | tail -10 && cd frontend && npx vitest run --reporter=verbose 2>&1 | tail -10"
          }
        ]
      }
    ]
  }
}
```

Every time a teammate marks a task as complete, **all tests must pass**. If tests fail, the task stays incomplete.

### TDD Enforcement in Spawn Prompt

Add to the team spawn prompt:

```
All teammates MUST follow TDD:
1. Write the test file FIRST
2. Run it to confirm it fails
3. Implement the code to make it pass
4. Never mark a task complete if tests are failing

Backend: every repository and handler gets a _test.go file BEFORE the implementation.
Frontend: every component and view gets a .test.tsx file BEFORE the implementation.
```

---

## Test File Organization

### Backend

```
internal/
├── repository/
│   ├── tasks.go
│   ├── tasks_test.go          ← repository tests
│   ├── projects.go
│   ├── projects_test.go
│   └── ...
├── handler/
│   ├── tasks.go
│   ├── tasks_test.go          ← HTTP integration tests
│   ├── projects.go
│   ├── projects_test.go
│   └── ...
├── scheduler/
│   ├── scheduler.go
│   └── scheduler_test.go     ← repeat rule calculation tests
├── sse/
│   ├── broker.go
│   └── broker_test.go        ← concurrent subscribe/broadcast tests
├── middleware/
│   ├── auth.go
│   └── auth_test.go          ← JWT + proxy mode tests
└── testutil/
    └── helpers.go             ← setupTestDB, seed data factories
```

### Frontend

```
frontend/src/
├── test/
│   ├── setup.ts               ← Vitest global setup (MSW server start)
│   └── mocks/
│       ├── handlers.ts        ← MSW request handlers
│       └── server.ts          ← MSW server instance
├── lib/__tests__/
│   ├── date-parser.test.ts
│   └── position.test.ts
├── components/__tests__/
│   ├── TaskItem.test.tsx
│   ├── TaskDetail.test.tsx
│   ├── ChecklistEditor.test.tsx
│   └── Sidebar.test.tsx
├── pages/__tests__/
│   ├── InboxView.test.tsx
│   ├── TodayView.test.tsx
│   ├── ProjectView.test.tsx
│   └── ...
└── hooks/__tests__/
    ├── useSSE.test.ts
    └── useCompleteTask.test.ts
```

---

## Coverage Targets

| Layer | Target | Rationale |
|---|---|---|
| Backend repositories | ~90% | Core data logic — bugs here corrupt data |
| Backend handlers | ~85% | HTTP layer — catches validation and status code issues |
| Backend unit (scheduler, auth, position) | ~95% | Pure logic — easy to test exhaustively |
| Frontend components | ~80% | Key interactions covered, skip purely visual/layout tests |
| Frontend views | ~75% | Integration with API, main user flows |
| Frontend utils | ~95% | Pure functions — easy to test exhaustively |

Don't chase 100% — focus on behavior that matters. Skip testing generated code, trivial getters, and pure layout.
