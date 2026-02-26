# ThingsToDo API Contract

Base URL: `/api`

All endpoints return JSON. All mutations broadcast SSE events. Authentication via httpOnly JWT cookie (builtin/oidc mode), proxy header (proxy mode), or API key via `Authorization: Bearer <key>` header.

---

## Common Patterns

### Error Response
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Duplicate Name Errors
`POST` and `PATCH` for projects, areas, and tags return **409 Conflict** with code `DUPLICATE_NAME` if the title already exists.

### Pagination (where applicable)
Query params: `?limit=50&offset=0`

### Sort Order
All entities with `sort_order` use REAL (float) for fractional positioning. New items default to max(sort_order) + 1024. Insert-between uses (before + after) / 2.

### IDs
All entity IDs are nanoid strings (8-10 chars). Task IDs double as permalink slugs.

---

## Authentication

### API Key (builtin mode)

Set the `API_KEY` environment variable to a secret string. Then pass it via the `Authorization` header:

```
Authorization: Bearer <your-api-key>
```

The API key authenticates as the first (admin) user in the database. This is useful for programmatic access (e.g., iOS Shortcuts, scripts) where cookie-based auth isn't practical.

If the header is present but the key is wrong, the request is rejected with 401 immediately (no fallback to cookie auth).

### GET /api/auth/config
**Mode: all** (public, no authentication required)

Returns the current auth mode so the login page can render the appropriate UI.

Response (200):
```json
{ "auth_mode": "builtin|proxy|oidc|none" }
```

### POST /api/auth/login
**Mode: builtin only** (returns 404 in proxy/oidc modes)

Request:
```json
{ "username": "string", "password": "string" }
```

Response (200): Sets httpOnly JWT cookie
```json
{ "user": { "id": "string", "username": "string" } }
```

### DELETE /api/auth/logout
**Mode: builtin, oidc**

Response (200): Clears JWT cookie (local logout only, no IdP redirect)
```json
{ "ok": true }
```

### GET /api/auth/me
Response (200):
```json
{
  "user": { "id": "string", "username": "string" },
  "auth_mode": "builtin|proxy|oidc|none"
}
```

### GET /api/auth/oidc/login
**Mode: oidc only**

Redirects the browser to the configured OIDC provider's authorization endpoint. Sets a signed `oidc_state` cookie for CSRF protection. Not a JSON API — browser navigation only.

### GET /api/auth/oidc/callback
**Mode: oidc only**

OIDC redirect URI. Verifies state, exchanges authorization code for tokens, extracts the `email` claim, provisions/links the user on first login, and issues the app JWT cookie. Redirects to `/inbox` on success. Returns 403 if the OIDC email doesn't match the linked user (single-user enforcement).

Required env vars: `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`
```

---

## Tasks

### GET /api/tasks
Query params: `status`, `project_id`, `area_id`, `heading_id`, `tag_ids` (comma-separated), `when_date`, `when_before`, `when_after`, `has_deadline`, `is_evening`, `search`

Response (200):
```json
{
  "tasks": [
    {
      "id": "string",
      "title": "string",
      "notes": "string",
      "status": "open|completed|canceled|wont_do",
      "when_date": "string|null",
      "when_evening": false,
      "high_priority": false,
      "deadline": "string|null",
      "project_id": "string|null",
      "project_name": "string|null",
      "area_id": "string|null",
      "area_name": "string|null",
      "heading_id": "string|null",
      "sort_order_today": 0.0,
      "sort_order_project": 0.0,
      "sort_order_heading": 0.0,
      "completed_at": "string|null",
      "canceled_at": "string|null",
      "deleted_at": "string|null",
      "created_at": "string",
      "updated_at": "string",
      "tags": [{ "id": "string", "title": "string", "color": "string|null" }],
      "checklist_count": 0,
      "checklist_done": 0,
      "has_notes": false,
      "has_links": false,
      "has_files": false,
      "has_repeat_rule": false
    }
  ]
}
```

### POST /api/tasks
Request:
```json
{
  "title": "string (required)",
  "notes": "string",
  "when_date": "string|null",
  "when_evening": false,
  "high_priority": false,
  "deadline": "string|null",
  "project_id": "string|null",
  "area_id": "string|null",
  "heading_id": "string|null",
  "tag_ids": ["string"]
}
```

Response (201): Full task object (same shape as list item)

### GET /api/tasks/:id
Response (200): Full task object with nested checklist, attachments, tags, repeat_rule
```json
{
  "id": "string",
  "title": "string",
  "notes": "string",
  "status": "open|completed|canceled|wont_do",
  "when_date": "string|null",
  "when_evening": false,
  "high_priority": false,
  "deadline": "string|null",
  "project_id": "string|null",
  "project": { "id": "string", "title": "string" },
  "area_id": "string|null",
  "area": { "id": "string", "title": "string" },
  "heading_id": "string|null",
  "heading": { "id": "string", "title": "string" },
  "sort_order_today": 0.0,
  "sort_order_project": 0.0,
  "sort_order_heading": 0.0,
  "completed_at": "string|null",
  "canceled_at": "string|null",
  "deleted_at": "string|null",
  "created_at": "string",
  "updated_at": "string",
  "tags": [{ "id": "string", "title": "string", "color": "string|null" }],
  "checklist": [
    {
      "id": "string",
      "title": "string",
      "completed": false,
      "sort_order": 0.0
    }
  ],
  "attachments": [
    {
      "id": "string",
      "type": "file|link",
      "title": "string",
      "url": "string",
      "mime_type": "string",
      "file_size": 0,
      "sort_order": 0.0,
      "created_at": "string"
    }
  ],
  "repeat_rule": {
    "id": "string",
    "frequency": "daily|weekly|monthly|yearly",
    "interval_value": 1,
    "mode": "fixed|after_completion",
    "day_constraints": ["mon", "wed", "fri"]
  }
}
```

### PATCH /api/tasks/:id
Request: Partial update (any subset of task fields)
```json
{
  "title": "string",
  "notes": "string",
  "when_date": "string|null",
  "when_evening": false,
  "high_priority": false,
  "deadline": "string|null",
  "project_id": "string|null",
  "area_id": "string|null",
  "heading_id": "string|null",
  "tag_ids": ["string"]
}
```

Response (200): Updated full task object

### DELETE /api/tasks/:id
Soft delete (moves to trash).

Response (204): No content

### DELETE /api/tasks/:id/purge
Permanently deletes the task.

Response (204): No content

### PATCH /api/tasks/:id/complete
Response (200): Updated task with status=completed, completed_at set

### PATCH /api/tasks/:id/cancel
Response (200): Updated task with status=canceled, canceled_at set

### PATCH /api/tasks/:id/wontdo
Response (200): Updated task with status=wont_do

### PATCH /api/tasks/:id/reopen
Response (200): Updated task with status=open

### PATCH /api/tasks/:id/restore
Restores a soft-deleted task from trash.

Response (200): Updated task with deleted_at cleared

### PATCH /api/tasks/:id/review
Marks a task as reviewed by bumping its `updated_at` timestamp. Used by the review feature to dismiss tasks from the review queue.

Response (200): Updated task

### PATCH /api/tasks/:id/move
Move task to a different project, area, or heading.

Request:
```json
{
  "project_id": "string|null",
  "area_id": "string|null",
  "heading_id": "string|null",
  "when_date": "string|null",
  "when_evening": true
}
```

Response (200): Updated task

### PATCH /api/tasks/reorder
Request:
```json
{
  "items": [
    { "id": "string", "sort_field": "sort_order_today|sort_order_project|sort_order_heading", "sort_order": 0.0 }
  ]
}
```

Response (200):
```json
{ "ok": true }
```

---

## Checklist Items

### GET /api/tasks/:id/checklist
Response (200):
```json
{
  "items": [
    { "id": "string", "title": "string", "completed": false, "sort_order": 0.0 }
  ]
}
```

### POST /api/tasks/:id/checklist
Request:
```json
{ "title": "string (required)" }
```

Response (201): Checklist item object

### PATCH /api/checklist/:id
Request:
```json
{ "title": "string", "completed": true, "sort_order": 0.0 }
```

Response (200): Updated checklist item

### DELETE /api/checklist/:id
Response (204): No content

---

## Attachments

### GET /api/tasks/:id/attachments
Response (200):
```json
{
  "attachments": [
    {
      "id": "string",
      "type": "file|link",
      "title": "string",
      "url": "string",
      "mime_type": "string",
      "file_size": 0,
      "sort_order": 0.0,
      "created_at": "string"
    }
  ]
}
```

### POST /api/tasks/:id/attachments
**For files:** multipart/form-data with `file` field
**For links:**
```json
{ "type": "link", "title": "string", "url": "string" }
```

Response (201): Attachment object

### PATCH /api/attachments/:id
Request:
```json
{ "title": "string", "sort_order": 0.0 }
```

Response (200): Updated attachment

### DELETE /api/attachments/:id
Response (204): No content

### GET /api/attachments/:id/file
Response: Binary file stream with appropriate Content-Type

---

## Projects

### GET /api/projects
Query params: `area_id`, `status` (open|completed|canceled)

Response (200):
```json
{
  "projects": [
    {
      "id": "string",
      "title": "string",
      "notes": "string",
      "area_id": "string (required)",
      "area": { "id": "string", "title": "string" },
      "status": "open|completed|canceled",
      "when_date": "string|null",
      "deadline": "string|null",
      "sort_order": 0.0,
      "task_count": 0,
      "completed_task_count": 0,
      "tags": [{ "id": "string", "title": "string", "color": "string|null" }],
      "created_at": "string",
      "updated_at": "string"
    }
  ]
}
```

### POST /api/projects
Request:
```json
{
  "title": "string (required)",
  "notes": "string",
  "area_id": "string (required)",
  "when_date": "string|null",
  "deadline": "string|null",
  "tag_ids": ["string"]
}
```

Response (201): Full project object

### GET /api/projects/:id
Response (200): Project with nested headings and tasks
```json
{
  "id": "string",
  "title": "string",
  "notes": "string",
  "area_id": "string (required)",
  "area": { "id": "string", "title": "string" },
  "status": "open|completed|canceled",
  "when_date": "string|null",
  "deadline": "string|null",
  "sort_order": 0.0,
  "task_count": 0,
  "completed_task_count": 0,
  "tags": [{ "id": "string", "title": "string", "color": "string|null" }],
  "created_at": "string",
  "updated_at": "string",
  "headings": [
    {
      "id": "string",
      "title": "string",
      "sort_order": 0.0,
      "tasks": [/* task objects */]
    }
  ],
  "tasks_without_heading": [/* task objects */],
  "completed_tasks": [/* completed/canceled/wont_do task objects */]
}
```

### PATCH /api/projects/:id
Request: Partial update
Response (200): Updated project

### DELETE /api/projects/:id
Response (204): No content

### PATCH /api/projects/:id/complete
Response (200): Updated project with status=completed

### PATCH /api/projects/reorder
Request:
```json
{
  "items": [
    { "id": "string", "sort_order": 0.0 }
  ]
}
```

Response (200):
```json
{ "ok": true }
```

---

## Headings

### GET /api/projects/:id/headings
Response (200):
```json
{
  "headings": [
    { "id": "string", "title": "string", "project_id": "string", "sort_order": 0.0 }
  ]
}
```

### POST /api/projects/:id/headings
Request:
```json
{ "title": "string (required)" }
```

Response (201): Heading object

### PATCH /api/headings/:id
Request:
```json
{ "title": "string", "sort_order": 0.0 }
```

Response (200): Updated heading

### DELETE /api/headings/:id
Response (204): No content

### PATCH /api/headings/reorder
Request:
```json
{
  "items": [
    { "id": "string", "sort_order": 0.0 }
  ]
}
```

Response (200):
```json
{ "ok": true }
```

---

## Areas

### GET /api/areas
Response (200):
```json
{
  "areas": [
    {
      "id": "string",
      "title": "string",
      "sort_order": 0.0,
      "project_count": 0,
      "task_count": 0,
      "standalone_task_count": 0,
      "created_at": "string",
      "updated_at": "string"
    }
  ]
}
```

### POST /api/areas
Request:
```json
{ "title": "string (required)" }
```

Response (201): Area object

### GET /api/areas/:id
Response (200): Area with nested projects and tasks
```json
{
  "id": "string",
  "title": "string",
  "sort_order": 0.0,
  "created_at": "string",
  "updated_at": "string",
  "projects": [/* project objects */],
  "tasks": [/* standalone tasks in this area (no project) */],
  "completed_tasks": [/* completed standalone tasks */]
}
```

### PATCH /api/areas/:id
Request:
```json
{ "title": "string", "sort_order": 0.0 }
```

Response (200): Updated area

### PATCH /api/areas/reorder
Request:
```json
{
  "items": [
    { "id": "string", "sort_order": 0.0 }
  ]
}
```

Response (200):
```json
{ "ok": true }
```

### DELETE /api/areas/:id
Response (204): No content

Response (409): Area still has projects
```json
{ "error": "area still has projects", "code": "HAS_PROJECTS" }
```

---

## Tags

### GET /api/tags
Response (200):
```json
{
  "tags": [
    {
      "id": "string",
      "title": "string",
      "color": "string|null",
      "parent_tag_id": "string|null",
      "sort_order": 0.0,
      "task_count": 0
    }
  ]
}
```

### POST /api/tags
Request:
```json
{ "title": "string (required)", "parent_tag_id": "string|null" }
```

Response (201): Tag object

### PATCH /api/tags/:id
Request:
```json
{ "title": "string", "color": "string|null", "parent_tag_id": "string|null", "sort_order": 0.0 }
```

Response (200): Updated tag

### DELETE /api/tags/:id
Response (204): No content

### PATCH /api/tags/reorder
Request:
```json
{
  "items": [
    { "id": "string", "sort_order": 0.0 }
  ]
}
```

Response (200):
```json
{ "ok": true }
```

### GET /api/tags/:id/tasks
Response (200): Tasks with this tag
```json
{ "tasks": [/* task objects */] }
```

---

## Repeat Rules

### GET /api/tasks/:id/repeat
Response (200):
```json
{
  "repeat_rule": {
    "id": "string",
    "pattern": { /* RecurrencePattern, see below */ },
    "frequency": "daily",
    "interval_value": 1,
    "mode": "fixed",
    "day_constraints": []
  }
}
```
Response (200, no rule): `{ "repeat_rule": null }`

The `pattern` field is the canonical recurrence definition. The flat fields (`frequency`, `interval_value`, `mode`, `day_constraints`) are deprecated but still populated for backwards compatibility.

### PUT /api/tasks/:id/repeat
Request (new pattern format — preferred):
```json
{
  "pattern": {
    "type": "weekly",
    "every": 2,
    "mode": "fixed",
    "on": ["mon", "wed", "fri"]
  }
}
```

Request (legacy format — still accepted):
```json
{
  "frequency": "daily|weekly|monthly|yearly",
  "interval_value": 1,
  "mode": "fixed|after_completion",
  "day_constraints": ["mon", "wed", "fri"]
}
```

Response (200): Repeat rule object

### DELETE /api/tasks/:id/repeat
Response (204): No content

### RecurrencePattern Types

All patterns share: `type` (string), `every` (int, interval), `mode` ("fixed" | "after_completion")

| Type | Extra Fields | Example |
|------|-------------|---------|
| `daily` | — | `{"type":"daily","every":3,"mode":"fixed"}` |
| `daily_weekday` | — | `{"type":"daily_weekday","every":1,"mode":"fixed"}` |
| `daily_weekend` | — | `{"type":"daily_weekend","every":1,"mode":"fixed"}` |
| `weekly` | `on`: DayOfWeek[] | `{"type":"weekly","every":1,"mode":"fixed","on":["mon","wed"]}` |
| `monthly_dom` | `day`: int (1-31, 0=last, negative=last-N, null=use when_date) | `{"type":"monthly_dom","every":1,"mode":"fixed","day":15}` |
| `monthly_dow` | `ordinal`: string, `weekday`: string | `{"type":"monthly_dow","every":1,"mode":"fixed","ordinal":"first","weekday":"monday"}` |
| `monthly_workday` | `workday_position`: "first"\|"last" | `{"type":"monthly_workday","every":1,"mode":"fixed","workday_position":"first"}` |
| `yearly_date` | `month`: 1-12, `day`: 1-31 | `{"type":"yearly_date","every":1,"mode":"fixed","month":3,"day":15}` |
| `yearly_dow` | `month`: 1-12, `ordinal`: string, `weekday`: string | `{"type":"yearly_dow","every":1,"mode":"fixed","month":11,"ordinal":"fourth","weekday":"thursday"}` |

**DayOfWeek values**: mon, tue, wed, thu, fri, sat, sun
**Ordinal values**: first, second, third, fourth, last
**Weekday values** (full): monday, tuesday, wednesday, thursday, friday, saturday, sunday

---

## User Settings

### GET /api/user/settings
Response (200):
```json
{
  "play_complete_sound": true,
  "show_count_main": true,
  "show_count_projects": true,
  "show_count_tags": true,
  "review_after_days": 7,
  "sort_areas": "manual",
  "sort_tags": "manual"
}
```

### PATCH /api/user/settings
Request: Partial update (any subset of fields)
```json
{
  "play_complete_sound": true,
  "show_count_main": true,
  "show_count_projects": true,
  "show_count_tags": true,
  "review_after_days": 7,
  "sort_areas": "manual|a-z|z-a",
  "sort_tags": "manual|a-z|z-a"
}
```

Response (200): Updated settings object

---

## View Endpoints

Pre-structured data for each smart list. Complex grouping/filtering happens server-side.

### GET /api/views/inbox
Tasks with no project, no area, no when_date, status=open.
```json
{
  "tasks": [/* task objects ordered by sort_order_today */],
  "review": [/* tasks not updated in review_after_days, excluding inbox tasks */]
}
```

### GET /api/views/today
```json
{
  "sections": [
    {
      "title": "Today",
      "groups": [
        {
          "project": { "id": "string", "title": "string" } | null,
          "tasks": [/* task objects */]
        }
      ]
    },
    {
      "title": "This Evening",
      "groups": [
        {
          "project": { "id": "string", "title": "string" } | null,
          "tasks": [/* task objects */]
        }
      ]
    }
  ],
  "overdue": [/* tasks with deadline < today */],
  "earlier": [/* past-dated open tasks without overdue deadlines */],
  "completed": [/* tasks completed today */]
}
```

### GET /api/views/upcoming
Query params: `from` (ISO date, default today), `days` (default 30)
```json
{
  "overdue": [/* tasks with deadline < today */],
  "dates": [
    {
      "date": "2024-03-15",
      "tasks": [/* task objects */]
    }
  ],
  "earlier": [/* past-dated open tasks */]
}
```

### GET /api/views/anytime
```json
{
  "areas": [
    {
      "area": { "id": "string", "title": "string" },
      "projects": [
        {
          "project": { "id": "string", "title": "string" },
          "tasks": [/* task objects */]
        }
      ],
      "standalone_tasks": [/* tasks in area but no project */]
    }
  ],
  "no_area": {
    "projects": [/* projects with no area */],
    "standalone_tasks": [/* tasks with no area, no project, but with when_date or not inbox */]
  }
}
```

### GET /api/views/someday
Same structure as anytime but filtered to someday-deferred items.
```json
{
  "areas": [/* same structure as anytime */],
  "no_area": {/* same structure as anytime */}
}
```

### GET /api/views/logbook
Query params: `limit` (default 50), `offset` (default 0)
```json
{
  "groups": [
    {
      "date": "2024-03-15",
      "tasks": [/* completed/canceled/wont_do task objects */]
    }
  ],
  "total": 150
}
```

### GET /api/views/trash
Query params: `limit` (default 50), `offset` (default 0)
```json
{
  "groups": [
    {
      "date": "2024-03-15",
      "tasks": [/* soft-deleted task objects */]
    }
  ],
  "total": 150
}
```

### GET /api/views/counts
Response (200):
```json
{
  "inbox": 5,
  "today": 3,
  "overdue": 1,
  "review": 2,
  "anytime": 12,
  "someday": 4,
  "logbook": 50,
  "trash": 2
}
```

---

## Search

### GET /api/search
Query params: `q` (required, FTS5 query string), `limit` (default 20)

Response (200):
```json
{
  "results": [
    {
      "task": {/* task object */},
      "title_snippet": "string with <mark>highlights</mark>",
      "notes_snippet": "string with <mark>highlights</mark>",
      "rank": -1.5
    }
  ]
}
```

---

## SSE Events

### GET /api/events
**No auth required.** Response: text/event-stream

Event types:
```
event: task_created
data: {"id": "string", "task": {/* task object */}}

event: task_updated
data: {"id": "string", "task": {/* task object */}}

event: task_deleted
data: {"id": "string"}

event: task_purged
data: {"id": "string"}

event: project_updated
data: {"id": "string", "project": {/* project object */}}

event: area_updated
data: {"id": "string", "area": {/* area object */}}

event: tag_updated
data: {"id": "string", "tag": {/* tag object */}}

event: bulk_change
data: {"type": "reorder|move|delete", "entity": "task|project|heading|area|tag", "ids": ["string"]}
```

---

## Saved Filters

### GET /saved-filters?view={view}

Returns all saved filters for the current user for a specific view, sorted A-Z by name.

Query params: `view` — one of `today`, `upcoming`, `anytime`, `someday`, `logbook` (required)

Response (200):
```json
{
  "saved_filters": [
    {
      "id": "abc1234567",
      "view": "today",
      "name": "High priority",
      "config": "{\"areas\":[],\"projects\":[],\"tags\":[],\"highPriority\":true,\"plannedDate\":null,\"deadline\":null,\"search\":\"\"}",
      "created_at": "2026-02-26T12:00:00"
    }
  ]
}
```

### POST /saved-filters

Creates a new saved filter. Maximum 10 per view.

Request:
```json
{
  "view": "today",
  "name": "High priority",
  "config": "{\"areas\":[],\"projects\":[],\"tags\":[],\"highPriority\":true,\"plannedDate\":null,\"deadline\":null,\"search\":\"\"}"
}
```

Response (201): the created SavedFilter object.

Error (422): `LIMIT_REACHED` — maximum 10 saved filters per view.

SSE: broadcasts `saved_filter_changed` with `{ "view": "<view>" }`.

### DELETE /saved-filters/{id}

Deletes a saved filter. Only the owning user can delete it.

Response: 204 No Content.

Error (404): `NOT_FOUND`.

SSE: broadcasts `saved_filter_changed` with `{ "view": "<view>" }`.

---

## Health

### GET /health
**No auth required.**

Response (200):
```json
{ "status": "ok" }
```
