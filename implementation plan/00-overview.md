# ThingsToDo — Implementation Plan Overview

## Project Summary

A self-hosted, single-user task management app inspired by Things 3. Cross-platform web app with Things 3's signature UX: drag-and-drop reordering, keyboard-first navigation, smooth animations, quick capture, and multi-device real-time sync via SSE.

Deployed as a single Docker container (~15 MB RAM, ~15 MB disk).

---

## Tech Stack Recap

| Layer | Choice |
|---|---|
| **Frontend** | React 19 + Vite, Tailwind CSS 4, Radix UI, framer-motion, @dnd-kit, TanStack Query + Zustand, cmdk, react-hotkeys-hook, Lucide React, React Router 7, date-fns |
| **Frontend Testing** | Vitest, React Testing Library, MSW (Mock Service Worker), @testing-library/user-event |
| **Backend Testing** | Go built-in `testing`, `net/http/httptest`, in-memory SQLite |
| **Backend** | Go 1.23 + Chi router |
| **Database** | SQLite (WAL mode + FTS5) |
| **Auth** | JWT + bcrypt (built-in) OR proxy-trust mode (behind Authelia/Authentik) |
| **Real-time sync** | Server-Sent Events (SSE) |
| **Search** | SQLite FTS5 |
| **Scheduling** | In-process cron (`robfig/cron`) |
| **Deployment** | Single Docker container, embedded SPA in Go binary |
| **Dev environment** | Dev container (Go 1.23 + Node 22) |

---

## Implementation Phases

| Phase | Focus | Deliverable |
|---|---|---|
| **Phase 1** | Project scaffolding | Repo structure, dev container, Go skeleton, React skeleton, Docker setup, CI pipeline |
| **Phase 2** | Backend core | SQLite schema + migrations, full REST API (tasks, projects, areas, tags, headings, checklist, attachments), auth middleware, view endpoints, scheduler |
| **Phase 3** | Frontend core | App shell, sidebar navigation, all 8 smart list views, task CRUD UI, inline detail view, state management with TanStack Query |
| **Phase 4** | Polish & advanced features | Drag-and-drop, animations, keyboard shortcuts, quick entry (cmdk), SSE real-time sync, full-text search, file attachments, repeating tasks UI, natural language dates |

---

## Detailed Plans

| Document | Contents |
|---|---|
| [01 — Phase 1: Scaffolding](./01-phase-1-scaffolding.md) | Repo layout, dev container, Go + React skeletons, Docker, CI |
| [02 — Phase 2: Backend Core](./02-phase-2-backend-core.md) | Database schema, migrations, repository layer, all API endpoints, auth, scheduler |
| [03 — Phase 3: Frontend Core](./03-phase-3-frontend-core.md) | App shell, routing, sidebar, views, task UI, state management |
| [04 — Phase 4: Polish & Advanced](./04-phase-4-polish.md) | DnD, animations, keyboard shortcuts, quick entry, SSE, search, attachments |
| [05 — Agent Team Strategy](./05-agent-team-strategy.md) | Agent count, roles, CLAUDE.md setup, hooks, coordination, spawn prompts |
| [06 — Testing Strategy (TDD)](./06-testing-strategy.md) | TDD workflow, backend test layers, frontend test layers, MSW setup, coverage targets, agent TDD enforcement |

---

## Estimated Complexity

| Phase | Scope |
|---|---|
| Phase 1 | ~15 files, infrastructure only |
| Phase 2 | ~40-50 files, heaviest backend work |
| Phase 3 | ~30-40 components, heaviest frontend work |
| Phase 4 | ~20-30 files, cross-cutting enhancements |

---

## Key Architectural Decisions

1. **Modular monolith** — API-first but single process. Same REST surface as microservices without operational overhead.
2. **Embedded SPA** — React build output embedded in Go binary via `embed.FS`. One container serves everything.
3. **View endpoints** — `/api/views/*` return pre-structured data matching each smart list's layout. Complex grouping/filtering lives on the backend.
4. **Optimistic updates** — TanStack Query mutations update UI immediately; SSE confirms state on other devices.
5. **Fractional positioning** — Tasks use float-based `position` fields per context for insert-between-items without rewriting all positions.
6. **Dual auth modes** — Built-in JWT login OR proxy-trust mode for users behind Authelia/Authentik.
7. **TDD throughout** — Tests written before implementation at every layer. Backend tests against real in-memory SQLite (not mocks). Frontend tests use MSW to intercept API calls at the network level. CI and agent team hooks enforce all tests pass before work is marked complete.
