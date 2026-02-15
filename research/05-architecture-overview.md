# Architecture Overview

## Recommended Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
│                                                              │
│  React 19 + Vite      Tailwind CSS 4      framer-motion     │
│  Radix UI             @dnd-kit             TanStack Query    │
│  Zustand              cmdk                 react-hotkeys     │
│  EventSource (SSE)    — real-time sync across devices        │
│                                                              │
│  Built as static SPA, embedded in backend binary             │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST/JSON API
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                     BACKEND (Go + Chi)                       │
│                     Single Binary / Container                │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Tasks   │ │ Projects │ │  Areas   │ │   Tags   │      │
│  │  API     │ │  API     │ │  API     │ │   API    │      │
│  │ /api/    │ │ /api/    │ │ /api/    │ │ /api/    │      │
│  │ tasks    │ │ projects │ │ areas    │ │ tags     │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       │             │            │             │             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Search  │ │   Auth   │ │Scheduler │ │   Sync   │      │
│  │  API     │ │Middleware│ │  (cron)  │ │   (SSE)  │      │
│  │ /api/    │ │          │ │          │ │ /api/    │      │
│  │ search   │ │          │ │          │ │ events   │      │
│  └────┬─────┘ └──────────┘ └──────────┘ └──────────┘      │
│       │                                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Repository / Data Layer                   │   │
│  │              (shared SQLite connection)                │   │
│  └──────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   SQLite (WAL)    │
                    │   + FTS5 index    │
                    │   Single file     │
                    └───────────────────┘
```

---

## API Design

### Endpoints Overview

```
POST   /api/auth/login           # Get session token (built-in auth mode only)
DELETE /api/auth/logout           # Invalidate session (built-in auth mode only)

GET    /api/tasks                 # List tasks (with filters)
POST   /api/tasks                 # Create task
GET    /api/tasks/:id             # Get task
PATCH  /api/tasks/:id             # Update task
DELETE /api/tasks/:id             # Delete task (soft)
PATCH  /api/tasks/:id/complete    # Complete task
PATCH  /api/tasks/:id/cancel      # Cancel task
PATCH  /api/tasks/:id/wontdo      # Won't Do (deliberate decision not to do it)
PATCH  /api/tasks/reorder         # Bulk reorder tasks

GET    /api/tasks/:id/checklist   # Get checklist items
POST   /api/tasks/:id/checklist   # Add checklist item
PATCH  /api/checklist/:id         # Update checklist item
DELETE /api/checklist/:id         # Delete checklist item

GET    /api/tasks/:id/attachments # List attachments
POST   /api/tasks/:id/attachments # Add attachment (file upload or link)
PATCH  /api/attachments/:id       # Update attachment (rename, reorder)
DELETE /api/attachments/:id       # Delete attachment
GET    /api/attachments/:id/file  # Download attached file

GET    /api/projects              # List projects
POST   /api/projects              # Create project
GET    /api/projects/:id          # Get project (with tasks)
PATCH  /api/projects/:id          # Update project
DELETE /api/projects/:id          # Delete project
PATCH  /api/projects/:id/complete # Complete project

GET    /api/projects/:id/headings # Get headings
POST   /api/projects/:id/headings # Create heading
PATCH  /api/headings/:id          # Update heading
DELETE /api/headings/:id          # Delete heading

GET    /api/areas                 # List areas
POST   /api/areas                 # Create area
PATCH  /api/areas/:id             # Update area
DELETE /api/areas/:id             # Delete area

GET    /api/tags                  # List tags
POST   /api/tags                  # Create tag
PATCH  /api/tags/:id              # Update tag
DELETE /api/tags/:id              # Delete tag

GET    /api/search?q=...          # Full-text search

GET    /api/events                # SSE stream (real-time sync across devices)

GET    /api/views/inbox           # Inbox view (unprocessed tasks)
GET    /api/views/today           # Today view (today + evening)
GET    /api/views/upcoming        # Upcoming view (date-grouped)
GET    /api/views/anytime         # Anytime view (area-grouped)
GET    /api/views/someday         # Someday view
GET    /api/views/logbook         # Logbook (completed tasks)
```

### View Endpoints vs. Raw CRUD

The `/api/views/*` endpoints return pre-structured data matching each smart list's layout. This keeps complex filtering/grouping logic on the backend rather than duplicating it in the frontend.

---

## Key Technical Decisions

### 1. Embedded Frontend

The React SPA is built to static files and embedded in the Go binary using `embed.FS`. This means:
- Single Docker container serves both API and UI
- No CORS issues (same origin)
- No separate frontend container or Nginx
- Deploy one binary, get everything

### 2. Multi-Device Real-Time Sync (SSE)

Single user, but multiple clients open simultaneously (laptop, desktop, phone). Solved via Server-Sent Events:

- Each client opens a persistent SSE connection to `GET /api/events`
- Mutations go via normal REST calls
- After persisting a change, the backend broadcasts a lightweight event to **all other** connected clients:
  ```
  event: task_updated
  data: {"id": "123", "type": "task", "action": "updated"}
  ```
- Receiving clients call `queryClient.invalidateQueries()` to refetch affected data
- UI updates seamlessly without full page refresh

**Why SSE over WebSockets:** SSE is unidirectional (server→client), works over standard HTTP, auto-reconnects, needs no special proxy config, and is trivial to implement in Go. Mutations already go via REST — no need for bidirectional communication.

**Why not polling:** Wastes bandwidth and has inherent delay. SSE is instant and uses fewer resources.

**Why not CRDTs:** Massive complexity for true offline-first sync. Single-user means write conflicts are extremely rare — simple last-write-wins with SSE invalidation is sufficient.

**Implementation:** In-memory event broker in Go (map of client channels). No Redis or message queue needed. A handful of SSE connections adds < 1 MB memory.

### 3. Optimistic Updates

TanStack Query on the frontend enables optimistic mutations:
- Mark task complete → UI updates instantly → API call in background
- Reorder tasks → UI animates immediately → PATCH sent to persist
- This is critical for Things 3-like responsiveness
- SSE events from the server confirm or correct the optimistic state on other devices

### 4. Sort Order Strategy

Tasks have a `position` field (float or integer) per context:
- Position in project
- Position in Today view
- Position in a heading

Using fractional positioning (or a gap-based integer system) allows inserting between items without rewriting all positions.

### 5. Authentication

Two modes, configurable via environment variable:

**Mode 1: Built-in auth (default)**
- User sets a password in `.env` on first setup
- Login returns a JWT or session token
- All `/api/*` routes protected by auth middleware
- Token stored in httpOnly cookie (not localStorage)

**Mode 2: Proxy auth / no-login mode** (`AUTH_MODE=proxy`)
- For use behind an external auth layer (Authelia, Authentik, Caddy auth, etc.)
- The app trusts the reverse proxy has already authenticated the user
- No login screen — app loads directly with a default user
- Optionally reads a trusted header (e.g., `Remote-User`) from the proxy to identify the session
- All API endpoints are accessible without a token when in this mode

This is important for self-hosters who already run a centralized auth proxy and don't want to manage a separate password for every app.

### 6. Task Permalinks

Every task gets a unique, human-friendly slug usable as a deep link:

- URL format: `https://your-domain.com/task/:slug` (e.g., `/task/abc123`)
- The slug is a short unique ID generated at task creation (e.g., nanoid, 8-10 chars)
- The SPA routes `/task/:slug` to open the task's detail view directly
- Enables bookmarking, sharing links between devices, and linking tasks from external tools
- The API already supports `GET /api/tasks/:id` — the slug *is* the task ID (or an alias)

### 7. File Attachments

Tasks can have both uploaded files and external links attached:

**Two attachment types:**
- **File**: Uploaded binary (images, PDFs, documents). Stored on local filesystem in the data volume.
- **Link**: External URL with optional title. Stored as metadata only.

**File storage strategy:**
- Uploaded files stored at `/attachments/<task_id>/<filename>`
- DB stores metadata: original filename, mime type, file size, storage path
- Served via `GET /api/attachments/:id/file` (authenticated, streams from disk)
- Separate Docker bind mount (`./attachments:/attachments`) from the DB volume (`./data:/data`)

**Upload handling:**
- `POST /api/tasks/:id/attachments` accepts `multipart/form-data` for files or JSON for links
- File size limit configurable via env var (default: 25 MB per file)
- No external object storage needed — local filesystem is fine for single-user

**Backup implications:**
- DB and attachments are separate bind mounts — can be backed up independently
- `./data` contains `thingstodo.db` — use SQLite `.backup` or Litestream
- `./attachments` contains uploaded files — use rsync, tar, or similar

### 8. Search

SQLite FTS5 provides fast full-text search:
```sql
CREATE VIRTUAL TABLE tasks_fts USING fts5(title, notes, content=tasks);
```
Kept in sync via triggers. Searches task titles and notes with ranking.

---

## Docker Deployment

### Minimal (local only)
```
┌─────────────────────┐
│   app container      │
│   Go binary          │
│   Serves SPA + API   │
│   SQLite embedded    │
│                      │
│   Port 2999          │
│   ~15 MB RAM         │
└─────────────────────┘
```

### Production (behind user's reverse proxy)
```
┌──────────────┐     ┌─────────────────────┐
│  User's      │────▶│   app container      │
│  reverse     │     │   :2999              │
│  proxy       │     │   Go binary + SPA    │
│  (Traefik,   │     │   SQLite             │
│   Caddy,etc) │     │   ~15 MB RAM         │
└──────────────┘     └─────────────────────┘
```

---

## Technology Choices Summary

| Concern | Decision | Why |
|---|---|---|
| Frontend framework | React 19 + Vite | Best DnD (@dnd-kit) and animation (framer-motion) ecosystem |
| Styling | Tailwind CSS 4 | Minimal, systematic — matches Things 3 aesthetic |
| UI primitives | Radix UI | Unstyled, accessible, composable |
| State management | TanStack Query + Zustand | Server state + light client state |
| Real-time sync | SSE + TanStack Query invalidation | Multi-device sync without WebSocket complexity or Redis |
| Backend language | Go + Chi | Tiny footprint, single binary, excellent SQLite support |
| Architecture | Modular monolith | API-first but single container. Same API surface as microservices. |
| Database | SQLite (WAL + FTS5) | Zero ops, embedded, built-in search |
| Reverse proxy | User-provided | Not bundled — app exposes port 2999 for user's existing proxy |
| Auth | JWT + bcrypt OR proxy-trust mode | Built-in login, or skip login when behind Authelia/Authentik/etc. |
| Deployment | Single Docker container | Embed SPA in Go binary |
| Dev environment | Dev container | Reproducible toolchain for devs and AI agents |

---

## Dev Container

A `.devcontainer` configuration provides a reproducible development environment that works identically for human developers and AI coding agents.

### Why Use One

- **Reproducible toolchain** — Go, Node, SQLite CLI, linting tools, and VS Code extensions are all defined in code. No manual setup.
- **Agent-friendly** — AI coding agents can spin up a known-good environment and start working immediately.
- **Host-clean** — Nothing installed on your local machine except Docker and your editor.
- **Matches production** — The dev container runs Linux, just like the Docker deployment target. Catches platform-specific issues early.

### Configuration

```
.devcontainer/
├── devcontainer.json    # Container config, extensions, settings
└── Dockerfile           # (optional) Custom image if needed
```

#### `.devcontainer/devcontainer.json`

```jsonc
{
  "name": "ThingsToDo",
  "image": "mcr.microsoft.com/devcontainers/go:1.23",

  // Frontend toolchain
  "features": {
    "ghcr.io/devcontainers/features/node:1": { "version": "22" }
  },

  // Ports
  "forwardPorts": [2999, 5173],
  "portsAttributes": {
    "2999": { "label": "Backend API" },
    "5173": { "label": "Vite Dev Server" }
  },

  // Post-create setup
  "postCreateCommand": "go mod download && cd frontend && npm ci",

  // VS Code extensions
  "customizations": {
    "vscode": {
      "extensions": [
        "golang.go",
        "dbaeumer.vscode-eslint",
        "bradlc.vscode-tailwindcss",
        "esbenp.prettier-vscode"
      ],
      "settings": {
        "go.lintTool": "golangci-lint",
        "editor.formatOnSave": true
      }
    }
  },

  // Mount data volumes for SQLite and attachments
  "mounts": [
    "source=thingstodo-data,target=/data,type=volume",
    "source=thingstodo-attachments,target=/attachments,type=volume"
  ]
}
```

### What's Included

| Tool | Version | Purpose |
|---|---|---|
| Go | 1.23 | Backend compilation and tooling |
| Node.js | 22 LTS | Frontend build (Vite, React) |
| SQLite | Pre-installed in base image | Database CLI for debugging |
| golangci-lint | Via Go extension | Backend linting |
| ESLint + Prettier | Via extensions | Frontend linting and formatting |

### Workflow

```bash
# Open in VS Code / Cursor — dev container starts automatically
# OR from CLI:
devcontainer up --workspace-folder .

# Backend (inside container)
go run ./cmd/server

# Frontend (inside container, separate terminal)
cd frontend && npm run dev
```

The dev container reuses concepts from the production Dockerfile (same Go/Node versions, same SQLite) but adds developer tooling on top. The production Dockerfile remains lean and separate.

---

## Alternative: Full TypeScript Stack

If you prefer one language everywhere:

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite (same) |
| Backend | Fastify + TypeScript |
| DB access | Drizzle ORM + better-sqlite3 |
| Type safety | tRPC (end-to-end types, no API client generation) |
| Deployment | Node.js Docker container (~150 MB, ~60 MB RAM) |

tRPC eliminates the API contract layer entirely — your frontend directly calls typed backend functions. Trade-off: heavier footprint, but faster development if TypeScript is your primary language.
