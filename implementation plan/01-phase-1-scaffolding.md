# Phase 1 — Project Scaffolding

**Goal:** Set up the repository structure, development environment, build pipeline, and deployment skeleton so that all subsequent phases can focus purely on feature code.

---

## 1.1 Repository Structure

```
thingstodo/
├── cmd/
│   └── server/
│       └── main.go                # Entrypoint: starts HTTP server
├── internal/
│   ├── config/
│   │   └── config.go              # Env var parsing, defaults
│   ├── database/
│   │   ├── database.go            # SQLite connection, PRAGMA setup
│   │   └── migrations/            # Embedded SQL migration files
│   │       ├── 001_initial.sql
│   │       └── ...
│   ├── middleware/
│   │   ├── auth.go                # JWT / proxy-trust middleware
│   │   ├── cors.go                # CORS (dev only)
│   │   └── logging.go             # Request logging
│   ├── handler/                   # HTTP handlers (one file per module)
│   │   ├── tasks.go
│   │   ├── projects.go
│   │   ├── areas.go
│   │   ├── tags.go
│   │   ├── headings.go
│   │   ├── checklist.go
│   │   ├── attachments.go
│   │   ├── search.go
│   │   ├── views.go
│   │   ├── auth.go
│   │   └── events.go              # SSE handler
│   ├── repository/                # Data access layer (one file per entity)
│   │   ├── tasks.go
│   │   ├── projects.go
│   │   ├── areas.go
│   │   ├── tags.go
│   │   ├── headings.go
│   │   ├── checklist.go
│   │   ├── attachments.go
│   │   └── search.go
│   ├── model/                     # Go structs for domain entities
│   │   └── models.go
│   ├── scheduler/
│   │   └── scheduler.go           # Repeating task cron
│   ├── sse/
│   │   └── broker.go              # In-memory SSE event broker
│   └── router/
│       └── router.go              # Chi router setup, mounts all routes
├── frontend/
│   ├── src/
│   │   ├── main.tsx               # React entrypoint
│   │   ├── App.tsx                # Root component + router
│   │   ├── components/            # Shared UI components
│   │   ├── pages/                 # Route-level views
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── api/                   # API client functions
│   │   ├── stores/                # Zustand stores
│   │   └── lib/                   # Utilities (date parsing, etc.)
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── .devcontainer/
│   └── devcontainer.json
├── .github/
│   └── workflows/
│       └── ci.yml                 # Lint + test + build
├── Dockerfile                     # Multi-stage: build Go + React, run scratch
├── docker-compose.yml
├── .env.example
├── .gitignore
├── go.mod
├── go.sum
├── Makefile                       # Dev commands: run, build, test, migrate
├── CLAUDE.md                      # AI agent project context
└── README.md
```

---

## 1.2 Dev Container

**File:** `.devcontainer/devcontainer.json`

Contents:
- Base image: `mcr.microsoft.com/devcontainers/go:1.23`
- Feature: Node.js 22 LTS
- Forward ports: 2999 (backend), 5173 (Vite dev)
- Post-create: `go mod download && cd frontend && npm ci`
- Extensions: golang.go, vscode-eslint, vscode-tailwindcss, prettier
- Mounts: data + attachments volumes

---

## 1.3 Go Backend Skeleton

### Steps

1. `go mod init github.com/<user>/thingstodo`
2. Install dependencies:
   - `github.com/go-chi/chi/v5` — router
   - `modernc.org/sqlite` — pure Go SQLite driver (no CGO)
   - `github.com/golang-jwt/jwt/v5` — JWT
   - `github.com/robfig/cron/v3` — scheduler
   - `golang.org/x/crypto` — bcrypt
3. Create `cmd/server/main.go`:
   - Parse config from env
   - Open SQLite, run migrations
   - Initialize router with health check endpoint
   - Start HTTP server on `:2999`
4. Create `internal/database/database.go`:
   - Open connection with `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout=5000`, `synchronous=NORMAL`
   - Embed and run migration SQL files
5. Create `internal/router/router.go`:
   - Mount `/health` returning `{"status": "ok"}`
   - Mount `/api/*` group with auth middleware (placeholder)
   - Mount `/` serving embedded frontend static files
6. Create `Makefile` with targets:
   - `run` — `go run ./cmd/server`
   - `build` — `go build -ldflags="-s -w" -o bin/thingstodo ./cmd/server`
   - `test` — `go test ./...`
   - `dev` — run backend + frontend dev server concurrently

---

## 1.4 React Frontend Skeleton

### Steps

1. `npm create vite@latest frontend -- --template react-ts`
2. Install core dependencies:
   - `tailwindcss @tailwindcss/vite` — styling
   - `@tanstack/react-query` — server state
   - `zustand` — client state
   - `react-router` — routing
   - `lucide-react` — icons
3. Configure Vite:
   - Proxy `/api` to `http://localhost:2999` in dev
   - Build output to `../internal/frontend/dist` (for Go embed)
4. Set up Tailwind CSS 4 (CSS-first config via `@import "tailwindcss"`)
5. Create minimal `App.tsx` with router and layout placeholder
6. Create API client base (`frontend/src/api/client.ts`) with fetch wrapper
7. Create TanStack Query provider in `main.tsx`

---

## 1.5 Docker Setup

### Dockerfile (multi-stage)

```
Stage 1 (frontend-build): node:22-alpine
  → npm ci && npm run build

Stage 2 (backend-build): golang:1.23-alpine
  → Copy frontend dist into internal/frontend/dist
  → go build with embed

Stage 3 (runtime): scratch
  → Copy binary + CA certs
  → EXPOSE 2999
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    volumes:
      - ./data:/data
      - ./attachments:/attachments
    ports:
      - "2999:2999"
    env_file: .env
    restart: unless-stopped
    healthcheck: curl -f http://localhost:2999/health
```

### .env.example

```
PORT=2999
AUTH_MODE=builtin
AUTH_PROXY_HEADER=Remote-User
LOG_LEVEL=info
ATTACHMENTS_PATH=/attachments
MAX_UPLOAD_SIZE=25MB
DB_PATH=/data/thingstodo.db
```

---

## 1.6 CI Pipeline

**File:** `.github/workflows/ci.yml`

Jobs:
1. **lint-backend** — `golangci-lint run`
2. **test-backend** — `go test ./... -race`
3. **lint-frontend** — `npm run lint`
4. **build** — Full Docker build (ensures Dockerfile works)

---

## 1.7 CLAUDE.md

Create project context file for AI agents:

```markdown
# ThingsToDo

Self-hosted Things 3-inspired task manager.

## Architecture
- Backend: Go + Chi at /cmd/server, /internal/*
- Frontend: React 19 + Vite at /frontend/src/*
- Database: SQLite (WAL + FTS5) at /data/thingstodo.db
- Single Docker container, SPA embedded in Go binary

## Commands
- Backend: `go run ./cmd/server` (port 2999)
- Frontend: `cd frontend && npm run dev` (port 5173, proxies to 2999)
- Build: `make build`
- Test backend: `go test ./...`
- Test frontend: `cd frontend && npm test`
- Lint: `golangci-lint run` / `cd frontend && npm run lint`

## Conventions
- Go: Chi router, repository pattern, handler → repository → SQLite
- React: TanStack Query for server state, Zustand for client state
- Styling: Tailwind CSS 4, Radix UI primitives
- API: REST + JSON, view endpoints at /api/views/*
- Auth: JWT middleware, check AUTH_MODE env var
```

---

## Phase 1 Completion Criteria

- [ ] `go run ./cmd/server` starts and serves `/health`
- [ ] `cd frontend && npm run dev` shows a blank React app with Tailwind working
- [ ] `docker compose up` builds and runs the full stack
- [ ] Dev container opens and all tools work
- [ ] CI pipeline passes (lint + test + build)
