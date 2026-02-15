# Backend Stack Research

## Language/Framework Comparison

### Go

| Criteria | Assessment |
|---|---|
| **Performance** | Excellent. 50k-100k+ req/s on modest hardware. |
| **Docker image size** | Outstanding. Static binary in scratch/distroless: **5-15 MB**. Alpine: ~20 MB. |
| **Memory usage** | Very low. Idles at **8-15 MB RSS**. Under load stays well under 50 MB. |
| **Developer experience** | Good but verbose. Excellent tooling (formatter, linter, test runner). Fast compile (~1-3s). Error handling repetitive but explicit. |
| **API tooling** | `swaggo/swag` for OpenAPI from annotations. `oapi-codegen` for spec-first. |
| **Ecosystem** | Mature. `sqlc` or `GORM` for DB. Excellent SQLite via `modernc.org/sqlite` (pure Go, no CGO). |

**Framework pick:** **Chi** — closest to net/http stdlib, zero dependencies, idiomatic. Gin is faster in benchmarks but Chi's stdlib alignment means less lock-in.

---

### Node.js / TypeScript

| Criteria | Assessment |
|---|---|
| **Performance** | Good. Fastify: ~30-50k req/s. Single-threaded but sufficient for single-user. |
| **Docker image size** | Moderate. Node slim: ~150-180 MB. Alpine: ~80-120 MB. With node_modules: 100-250 MB total. |
| **Memory usage** | Moderate. Idles at **30-60 MB**. V8 heap overhead unavoidable. |
| **Developer experience** | Excellent. TypeScript provides strong typing. Fastest iteration speed. Prisma/Drizzle for type-safe DB. |
| **API tooling** | Best-in-class. Fastify has built-in JSON schema validation + auto Swagger. tRPC option for end-to-end type safety. |
| **Ecosystem** | Largest. NPM has everything. Risk: dependency bloat. |

**Framework pick:** **Fastify** — schema validation, plugin architecture, built-in Swagger. Hono better for edge/serverless. Express is legacy.

---

### Rust

| Criteria | Assessment |
|---|---|
| **Performance** | Best possible. 100k-300k+ req/s. Wildly overkill for single-user. |
| **Docker image size** | Excellent. Static binary in scratch: **5-10 MB**. |
| **Memory usage** | Lowest. **2-8 MB** idle. No GC. |
| **Developer experience** | Steep learning curve. CRUD development 3-5x slower than Go or TS. Compile: 30s-2min. |
| **API tooling** | Improving but immature. `utoipa` for OpenAPI. `sqlx` for compile-time queries. |
| **Ecosystem** | Growing but gaps. More manual wiring. |

**Framework pick:** **Axum** (Tokio/Tower). Only choose Rust if learning it is a goal.

---

### Python (FastAPI)

| Criteria | Assessment |
|---|---|
| **Performance** | Adequate. Uvicorn + FastAPI: ~5-15k req/s. Fine for single-user. |
| **Docker image size** | Largest. Python slim: ~150 MB. With deps: **200-400 MB**. |
| **Memory usage** | Highest. Idles at **40-80 MB**. With SQLAlchemy: 60-100 MB. |
| **Developer experience** | Very good. Auto-generated docs, Pydantic validation, async support. |
| **API tooling** | Excellent. Auto OpenAPI/Swagger UI built in. |
| **Ecosystem** | Massive, but strengths (data/ML) not relevant here. |

**Verdict:** Heaviest footprint. Only if Python is your strongest language.

---

## Architecture: Modular Monolith (Not Microservices)

### Why not full microservices for single-user?

- **Single user** = no scaling concerns, no independent deployment needs, no team boundaries
- Microservices add operational complexity: inter-service communication, distributed transactions, service discovery, log aggregation
- Each container has base memory cost. Four Go services = ~60 MB. Four Node services = ~200 MB. Pure overhead.
- Things 3's data model is highly relational — splitting across services creates artificial boundaries that fight the data model

### Recommended: Modular Monolith with API-first Design

Single binary/process with clean internal module boundaries. **Still API-based** — all functionality exposed via REST/JSON endpoints.

```
┌─────────────────────────────────────────────┐
│              Single Application              │
│                                              │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │  Tasks   │ │ Projects │ │   Areas    │  │
│  │  Module  │ │  Module  │ │   Module   │  │
│  ├──────────┤ ├──────────┤ ├────────────┤  │
│  │  Tags    │ │  Search  │ │   Auth     │  │
│  │  Module  │ │  Module  │ │   Module   │  │
│  └──────────┘ └──────────┘ └────────────┘  │
│  ┌─────────────────────────────────────────┐ │
│  │     Scheduler (Repeating Tasks)         │ │
│  └─────────────────────────────────────────┘ │
├─────────────────────────────────────────────┤
│              SQLite (embedded)               │
└─────────────────────────────────────────────┘
```

### Module Boundaries

| Module | Responsibilities | API Prefix |
|---|---|---|
| **Tasks** | CRUD, status transitions (open/completed/canceled/wont_do), ordering, checklist items, attachments, notes, deadlines, early recurring task completion | `/api/tasks` |
| **Projects** | CRUD, task grouping, headings, progress tracking | `/api/projects` |
| **Areas** | CRUD, grouping of projects and standalone tasks | `/api/areas` |
| **Tags** | CRUD, many-to-many with tasks/projects | `/api/tags` |
| **Search** | Full-text search via SQLite FTS5 | `/api/search` |
| **Auth** | Built-in login (JWT) or proxy-trust mode (Authelia, Authentik, etc.) | `/api/auth` |
| **Sync** | SSE event stream for multi-device real-time sync | `/api/events` |
| **Scheduler** | In-process cron for repeating task generation | Internal only |

Each module owns its own route group, handlers, and repository layer. They share the database connection and call each other via direct function calls (no HTTP overhead).

**Key insight:** You get the API-based architecture the frontend needs, with the operational simplicity of a single container. The API surface is identical to what you'd have with microservices — the difference is purely internal.

---

## Multi-Device Real-Time Sync

Although this is a single-user app, the same user will have multiple clients open simultaneously (laptop, desktop, phone). When a task is completed on one device, all other open clients must reflect the change immediately.

### Approach: Server-Sent Events (SSE)

**Why SSE over alternatives:**

| Option | Verdict |
|---|---|
| **SSE (recommended)** | One-directional (server→client), works over standard HTTP, auto-reconnects on disconnect, no special proxy config needed, trivial to implement in Go. |
| **WebSockets** | Bi-directional — overkill since mutations go via REST. More complex (upgrade handshake, ping/pong, proxy config). |
| **Polling** | Works but wastes bandwidth and has inherent delay. Fine as a fallback. |
| **CRDTs** | Massive complexity for true offline-first sync. Overkill for single-user where write conflicts are rare. |

### How It Works

1. Each client opens a persistent SSE connection to `GET /api/events`
2. Client makes a mutation via normal REST (e.g., `PATCH /api/tasks/123/complete`)
3. After persisting the change, the backend broadcasts a lightweight event to **all other** connected SSE clients:
   ```
   event: task_updated
   data: {"id": "123", "type": "task", "action": "updated"}
   ```
4. Receiving clients use the event to invalidate/refetch the affected TanStack Query cache
5. UI updates seamlessly without full page refresh

### Backend Implementation (Go)

SSE is natively supported by Go's `net/http` — no library needed:
- Maintain an in-memory map of connected clients (channel per connection)
- On mutation, iterate clients and send the event
- Use `context.Done()` to clean up disconnected clients
- Chi supports SSE out of the box via standard `http.Flusher`

### Event Types

| Event | Trigger | Client Action |
|---|---|---|
| `task_created` | New task via POST | Invalidate task lists |
| `task_updated` | Task edit, complete, cancel, reorder | Invalidate specific task + relevant views |
| `task_deleted` | Task deletion | Invalidate task lists |
| `project_updated` | Project changes | Invalidate project + task lists |
| `area_updated` | Area changes | Invalidate area views |
| `tag_updated` | Tag changes | Invalidate tag list |
| `bulk_change` | Large operations (reorder, multi-select) | Invalidate all affected queries |

### Concurrency Considerations

- SSE connections are long-lived HTTP connections — each holds a goroutine, but Go handles thousands of goroutines trivially
- SQLite WAL mode supports concurrent reads from multiple SSE-connected clients while a single writer persists mutations — no contention
- The event broker is in-memory (no Redis/queue needed) since all clients connect to the same process
- Negligible resource impact: a handful of open SSE connections adds < 1 MB memory

---

## Database Comparison

### SQLite (Recommended)

| Factor | Assessment |
|---|---|
| **Complexity** | Zero. Embedded, no separate container, no network, no credentials. |
| **Performance** | More than sufficient. Thousands of writes/sec with WAL mode. |
| **Features needed** | FTS5 (full-text search), JSON functions, window functions, CTEs — all built in. |
| **Backup** | Copy one file. Or Litestream for continuous S3 replication. |
| **Docker footprint** | No additional container. DB is a file inside the app container. |
| **Memory** | Negligible. Uses mmap and small page cache. |
| **Concurrency** | Single-writer, multiple-reader in WAL mode. Perfect for single-user. |
| **File storage** | Uploaded attachments stored on local filesystem (separate bind mount at `/attachments`). DB stores metadata + file path. |

Key configuration:
```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
PRAGMA synchronous=NORMAL;
```

### PostgreSQL

- Separate container: ~200 MB image, 30-50 MB RAM idle
- Vastly overpowered for this use case
- LISTEN/NOTIFY, advanced FTS, JSONB — none necessary for single-user task manager
- Only consider if you need features SQLite lacks (you won't)

### Turso / libSQL

- SQLite-compatible with replication features
- Replication features irrelevant for single-user self-hosted
- Adds complexity without benefit

**Database verdict: SQLite, unambiguously.** Entire DB for a personal task manager will likely never exceed 10 MB.

---

## Infrastructure

### Reverse Proxy

**User's responsibility.** Not bundled in the app's Docker setup. Most self-hosters already run Traefik, Caddy, nginx-proxy-manager, or similar. The app exposes port 2999 and expects to be proxied.

### Message Queue

**Not needed.** Single user = no load spikes. Monolith = no inter-service communication. Repeating tasks handled by in-process cron (`robfig/cron` in Go). Adding Redis/RabbitMQ would cost 30-100 MB RAM for zero benefit.

### Caching

**Not needed.** SQLite reads from local file — no network latency to cache around. Entire dataset fits in SQLite's page cache (~2 MB). If a query is slow (it won't be), add an index, not a cache layer.

---

## Final Recommendation

| Layer | Choice | Rationale |
|---|---|---|
| **Language** | **Go + Chi** | Best balance of performance, tiny footprint, good DX, excellent SQLite support, single binary. |
| **Architecture** | **Modular monolith** | API-first, but single process. Same API surface as microservices without operational overhead. |
| **Database** | **SQLite (WAL + FTS5)** | Zero ops, embedded, more than sufficient, built-in search. |
| **Auth** | **In-process middleware** | Two modes: built-in (JWT + bcrypt) or proxy-trust (no login, for use behind Authelia/Authentik). |
| **Real-time sync** | **SSE (Server-Sent Events)** | Multi-device sync via `/api/events`. Lightweight, no WebSocket complexity, no Redis. |
| **Search** | **SQLite FTS5** | Built into DB. No Elasticsearch needed. |
| **Scheduling** | **In-process cron** (`robfig/cron`) | Repeating task generation. No external queue. |
| **Reverse proxy** | **User-provided** | Not bundled. App exposes port 2999 for user's existing proxy. |
| **API format** | **REST + JSON + SSE** | OpenAPI spec for REST, SSE for real-time push. |

### Alternative: TypeScript Full-Stack

If you prefer one language across the stack: **Fastify + TypeScript + Drizzle ORM + better-sqlite3**. Trade ~40 MB more memory for faster iteration and tRPC option for end-to-end type safety with a React frontend.

### Resource Footprint

**Go stack:** ~15-25 MB RAM, ~55 MB disk (images), one SQLite file
**Node/TS stack:** ~60-100 MB RAM, ~200 MB disk, one SQLite file
**Compared to microservices + Postgres:** 400-800 MB RAM, 6+ containers
