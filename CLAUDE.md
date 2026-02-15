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
- Go: Chi router, repository pattern, handler -> repository -> SQLite
- React: TanStack Query for server state, Zustand for client state
- Styling: Tailwind CSS 4, Radix UI primitives
- API: REST + JSON, view endpoints at /api/views/*
- Auth: JWT middleware, check AUTH_MODE env var
- Task IDs are nanoid strings (8-10 chars), also used as permalink slugs
- Sort order uses REAL (float) columns for fractional positioning

## File Ownership (to avoid conflicts)
- Backend agent: /cmd/*, /internal/*
- Frontend agent: /frontend/src/*
- Infra agent: .devcontainer/*, Dockerfile, docker-compose.yml, .github/*
- Shared (coordinate via lead): go.mod, CLAUDE.md, /docs/*

## Current Phase: Phase 1 - Scaffolding
- Reference: /implementation plan/01-phase-1-scaffolding.md
