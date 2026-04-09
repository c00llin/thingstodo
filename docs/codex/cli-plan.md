# ThingsToDo CLI Implementation Plan

## Summary

Create a Go-based `ttd` CLI as an online-only companion to the existing HTTP API. The implementation lives under `cmd/ttd` plus `internal/cli/*` and covers config/auth resolution, read views, search/show, task create/edit/state-change commands, project/tag/area listing, JSON/text output, selector resolution, and automated coverage against the real handlers.

## Key Changes

- Add a new `ttd` binary entrypoint.
- Implement config resolution with precedence `flags > env > config file`, including named profiles in `~/.config/thingstodo/config.toml`.
- Use the live API routes already present in the repo:
  - Views: `/api/views/inbox|today|upcoming|anytime|someday|logbook`
  - Search: `/api/search`
  - Tasks: `/api/tasks`, `/api/tasks/{id}`, `/api/tasks/{id}/complete|reopen|cancel|wontdo|restore`
  - Projects, tags, and areas: `/api/projects`, `/api/tags`, `/api/areas`
- Implement task selector resolution with ID passthrough, exact-title matching, fuzzy shortlist failures, and exit code `3` for ambiguity.
- Support explicit flags for task creation and editing, plus lightweight inline capture for `ttd add "Title tomorrow #tag"`.
- Fail instead of auto-creating unknown tags in v1.

## Tests

- Unit coverage for config precedence and file parsing.
- Unit coverage for date parsing and inline capture extraction.
- Integration coverage using the real router with API-key auth for:
  - `today --json`
  - inline `add`
  - ambiguous selector handling
  - unknown-tag validation

## Defaults

- Online-only, no local cache.
- Open-task selector search by default, with command-specific lookup for `reopen` and `restore`.
- No shell completion in v1.
- No checklist CRUD, attachment workflows, reminders, schedules, repeat rules, bulk actions, or reorder commands in v1.
