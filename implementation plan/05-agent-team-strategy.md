# Agent Team Strategy

**Goal:** Define how to use Claude Code's agent teams feature to build ThingsToDo efficiently with multiple coordinated agents working in parallel.

---

## Why Agent Teams?

This project has clean separation between frontend and backend, with well-defined API contracts. This makes it ideal for parallel agent work:

- **Backend and frontend are independently buildable** once the API contract is defined
- **Within each layer**, modules are largely independent (tasks handler doesn't depend on tags handler)
- **Phase 4 features** (DnD, animations, shortcuts) are independent of each other

Agent teams let multiple Claude Code instances work simultaneously on different parts of the codebase, coordinating through a shared task list and direct messaging.

---

## Recommended Setup: 1 Lead + 3 Teammates

### Agent Roles

| Role | Name | Focus | Works On |
|---|---|---|---|
| **Lead** | Architect / Coordinator | Orchestration, code review, integration, conflict resolution | CLAUDE.md, API contracts, schema review, final integration |
| **Teammate 1** | Backend Engineer | Go backend: handlers, repositories, database, auth, SSE | `/cmd/`, `/internal/` |
| **Teammate 2** | Frontend Engineer | React UI: components, views, routing, state management | `/frontend/src/` |
| **Teammate 3** | Infrastructure & Polish | Dev container, Docker, CI, then DnD/animations/shortcuts | `.devcontainer/`, `Dockerfile`, `/frontend/src/` (Phase 4) |

### Why 3 Teammates (Not More, Not Fewer)?

**Why not 2:**
- Backend and frontend can work in parallel, but Phase 1 (scaffolding) and Phase 4 (polish) create a third stream of work that would bottleneck one of the two agents.

**Why not 4+:**
- The codebase isn't large enough to sustain 4+ agents without file conflicts
- Coordination overhead increases non-linearly — more agents means more time spent on messaging and conflict resolution
- Token cost is high (each teammate is a full Claude session)
- SQLite schema and API contracts are shared state — more agents means more contention on these

**3 is the sweet spot** for a full-stack app of this size.

---

## Phase-by-Phase Agent Assignments

### Phase 1: Scaffolding

| Agent | Tasks |
|---|---|
| **Lead** | Create CLAUDE.md, define API contract (OpenAPI or detailed spec), review all scaffolding |
| **Teammate 1 (Backend)** | Go module init, Chi router skeleton, SQLite setup, health endpoint, Makefile |
| **Teammate 2 (Frontend)** | Vite + React + Tailwind setup, TanStack Query provider, API client base, routing skeleton |
| **Teammate 3 (Infra)** | Dev container, Dockerfile, docker-compose.yml, CI pipeline, .env.example |

All three teammates work in parallel. No dependencies between them.

### Phase 2: Backend Core

| Agent | Tasks |
|---|---|
| **Lead** | Review schema, review API contracts, test endpoint responses |
| **Teammate 1 (Backend)** | Database migrations → models → repositories → handlers (in order from 02-phase-2) |
| **Teammate 2 (Frontend)** | Can start on Phase 3 early: API client types, TanStack Query hooks, app shell, sidebar (using mock/stub data) |
| **Teammate 3 (Infra)** | Write backend integration tests, set up test fixtures, help with SSE broker implementation |

**Key:** Frontend can start before backend is finished by coding against the API contract. TanStack Query hooks can be written with known endpoint shapes.

### Phase 3: Frontend Core

| Agent | Tasks |
|---|---|
| **Lead** | Review components, ensure consistency, test integration |
| **Teammate 1 (Backend)** | Fix API issues surfaced by frontend integration, add view endpoints, optimize queries |
| **Teammate 2 (Frontend)** | All view components, TaskItem, TaskDetail, sidebar, inline editing |
| **Teammate 3 (Infra)** | Frontend component tests, accessibility audit, responsive layout |

### Phase 4: Polish & Advanced Features

| Agent | Tasks |
|---|---|
| **Lead** | Coordinate cross-cutting features, final review |
| **Teammate 1 (Backend)** | Repeating task scheduler, search FTS5 optimization, SSE event types |
| **Teammate 2 (Frontend)** | DnD (@dnd-kit), animations (framer-motion), optimistic mutations |
| **Teammate 3 (Infra → Polish)** | Keyboard shortcuts, Quick Entry (cmdk), search UI, natural language dates, theming |

Phase 4 has the most parallelism — all three teammates work on independent features simultaneously.

---

## Coordination Strategy

### CLAUDE.md — Shared Project Context

All teammates automatically read CLAUDE.md. Keep it updated with:

```markdown
# ThingsToDo

## Architecture
- Backend: Go + Chi at /cmd/server, /internal/*
- Frontend: React 19 + Vite at /frontend/src/*
- Database: SQLite (WAL + FTS5) at /data/thingstodo.db

## API Contract
- All endpoints documented in /docs/api.md
- View endpoints return structured JSON (not flat arrays)
- All mutations broadcast SSE events

## Commands
- Backend: `go run ./cmd/server`
- Frontend: `cd frontend && npm run dev`
- Test backend: `go test ./...`
- Test frontend: `cd frontend && npm test`
- Full build: `make build`

## Conventions
- Go: repository pattern (handler → repository → SQLite)
- React: TanStack Query for server state, Zustand for UI state
- Tailwind CSS 4 for styling, Radix UI for accessible primitives
- Task IDs are nanoid strings (8-10 chars), also used as permalink slugs
- Sort order uses REAL (float) columns for fractional positioning

## File Ownership (to avoid conflicts)
- Backend agent: /cmd/*, /internal/*
- Frontend agent: /frontend/src/*
- Infra agent: .devcontainer/*, Dockerfile, docker-compose.yml, .github/*
- Shared (coordinate via lead): go.mod, CLAUDE.md, /docs/*
```

### Avoiding File Conflicts

The #1 risk with agent teams is two agents editing the same file. Prevent this with clear file ownership:

| Directory/File | Owner |
|---|---|
| `/cmd/*`, `/internal/*` | Backend agent |
| `/frontend/src/*` | Frontend agent |
| `.devcontainer/*`, `Dockerfile`, `docker-compose.yml`, `.github/*` | Infra agent |
| `CLAUDE.md`, `/docs/*`, `go.mod` | Lead only |
| `/internal/model/models.go` | Backend agent (Frontend reads types from API, not Go source) |

### Task Dependencies

Use the shared task list with dependencies:

```
Task: "Create SQLite migration 001" (Backend)
  → blocks: "Write task repository" (Backend)
  → blocks: "Create TanStack Query hooks for tasks" (Frontend)

Task: "Define API response types in TypeScript" (Frontend)
  → blocked by: "Finalize API contract" (Lead)
```

### Communication Patterns

1. **Lead → Teammates:** Assign tasks, provide API specs, request status
2. **Teammates → Lead:** Report completion, flag blockers, request decisions
3. **Backend ↔ Frontend:** "Task endpoint now returns `attachments` array" — Frontend teammate adjusts types
4. **Lead reviews:** After each phase, lead reviews all code before proceeding

---

## Spawn Prompts

### Starting the Team

```
Enable agent teams and create a 3-teammate team to build ThingsToDo,
a self-hosted Things 3-inspired task manager.

Assign roles:
- Teammate 1 "Backend": Go + Chi backend. Owns /cmd/* and /internal/*.
  Implements SQLite schema, repositories, HTTP handlers, auth, SSE broker.
  Reference /implementation plan/02-phase-2-backend-core.md for specs.

- Teammate 2 "Frontend": React 19 + Vite frontend. Owns /frontend/src/*.
  Implements app shell, sidebar, all views, task components, state management.
  Reference /implementation plan/03-phase-3-frontend-core.md for specs.

- Teammate 3 "Infra": Dev container, Docker, CI, then polish features.
  Owns .devcontainer/*, Dockerfile, docker-compose.yml, .github/*.
  Reference /implementation plan/01-phase-1-scaffolding.md for infra specs
  and /implementation plan/04-phase-4-polish.md for polish features.

Start with Phase 1 scaffolding. All three teammates can work in parallel.
I (the lead) will review before moving to Phase 2.

IMPORTANT: Do not edit files owned by another teammate. If you need a
change in another teammate's area, message them or the lead.
```

### Phase Transition Prompt (Lead)

```
Phase 1 is complete. Moving to Phase 2.

Backend: Start implementing the database schema and repository layer
per /implementation plan/02-phase-2-backend-core.md. Build in the order
specified (migrations → models → task repo → project repo → ...).

Frontend: Start on Phase 3 early — build the app shell, sidebar navigation,
and API client types. Use the API contract in /docs/api.md to write
TanStack Query hooks. You can use mock data until Backend endpoints are ready.

Infra: Write integration tests for the backend endpoints as Backend
implements them. Also implement the SSE broker at /internal/sse/broker.go.
```

---

## Settings Configuration

### Enable Agent Teams

**File:** `.claude/settings.json` (project-level)

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "teammateMode": "tmux"
}
```

### Quality Gate Hooks

**File:** `.claude/settings.json`

```json
{
  "hooks": {
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cd /workspaces/thingstodo && go test ./... 2>&1 | tail -5 && cd frontend && npm run lint 2>&1 | tail -5"
          }
        ]
      }
    ]
  }
}
```

This runs linting and tests whenever a teammate marks a task as complete, catching regressions early.

---

## Alternative: Solo Agent with Subagents

If you prefer not to use agent teams (they're experimental), you can achieve decent parallelism with a single Claude Code session using subagents:

| Approach | Parallelism | Coordination | Cost |
|---|---|---|---|
| **Agent teams (recommended)** | True parallel — 3 agents working simultaneously | Shared task list + messaging | ~4x token usage |
| **Solo + subagents** | Sequential with parallel research/exploration | Parent manages everything | ~1.5x token usage |
| **Solo agent** | Sequential | N/A | 1x token usage |

For **solo + subagents**, the workflow is:
1. Main agent implements one module at a time
2. Spawns Explore subagents in parallel to research upcoming work
3. Spawns Bash subagents to run tests in the background
4. No file conflict risk, but much slower overall

---

## Summary

| Decision | Choice |
|---|---|
| **Team size** | 1 lead + 3 teammates |
| **Roles** | Backend Engineer, Frontend Engineer, Infrastructure & Polish |
| **Display mode** | tmux (split panes for visibility) |
| **Conflict prevention** | Strict file ownership per agent |
| **Coordination** | Shared task list + direct messaging + CLAUDE.md |
| **Quality gates** | Hooks running tests/lint on task completion |
| **Phase overlap** | Frontend starts Phase 3 while Backend is in Phase 2 |
| **Most parallel phase** | Phase 4 (all 3 agents on independent features) |
