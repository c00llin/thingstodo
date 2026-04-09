# ThingsToDo CLI Specification

## Overview

Proposed CLI name: `ttd`

Purpose: a terminal companion for ThingsToDo focused on fast capture, list/review, search, and common task state changes against the existing HTTP API.

The CLI should complement the web app, not replace it.

Non-goals for v1:

- Full parity with the web UI
- Offline sync or IndexedDB behavior
- Drag-and-drop style reordering workflows
- Advanced repeat-rule editing UX
- Rich attachment upload/download workflows beyond basic support

## Product Positioning

`ttd` should be:

- Fast for daily terminal use
- Scriptable
- Safe and predictable
- Thin over the existing API, not a second application model

`ttd` should not:

- Invent separate local state
- Bypass server validation or business rules
- Depend on browser auth cookies

## Auth Model

Primary auth:

- `THINGSTODO_URL`
- `THINGSTODO_API_KEY`

Optional config file:

- `~/.config/thingstodo/config.toml`

Example:

```toml
url = "http://localhost:2999"
api_key = "your-api-key"
output = "text"
timezone = "Europe/Amsterdam"
```

Precedence:

1. CLI flags
2. Environment variables
3. Config file

No v1 support for:

- Cookie login
- Interactive username/password login
- OIDC login flow

Reason: the backend already supports API-key machine auth cleanly, and that is the right interface for a CLI.

## Command Design Principles

- Human-readable default output
- `--json` on every read command
- Stable exit codes
- Selectors should allow avoiding raw UUIDs where possible
- Mutating commands should print the updated object or a concise confirmation
- No hidden local caches in v1

## Global Flags

Available on all commands:

- `--url <url>`
- `--api-key <key>`
- `--json`
- `--no-color`
- `--quiet`
- `--timeout <duration>`
- `--profile <name>`

Examples:

```sh
ttd --url http://localhost:2999 --api-key "$THINGSTODO_API_KEY" today
ttd --json search invoice
```

## Profiles

Support multiple servers/accounts via named profiles.

Example config:

```toml
default_profile = "home"

[profiles.home]
url = "https://tasks.example.com"
api_key = "..."

[profiles.local]
url = "http://localhost:2999"
api_key = "..."
```

Commands:

- `ttd config show`
- `ttd config set url <value>`
- `ttd config set api-key <value>`
- `ttd config use <profile>`
- `ttd config doctor`

`config doctor` checks:

- Config resolution
- Server reachability
- Auth validity
- API compatibility if a version endpoint is later added

## Core v1 Commands

Views:

- `ttd inbox`
- `ttd today`
- `ttd upcoming [--from <date>]`
- `ttd anytime`
- `ttd someday`
- `ttd logbook [--limit N] [--offset N]`

Tasks:

- `ttd add <title>`
- `ttd show <task-ref>`
- `ttd search <query>`
- `ttd done <task-ref>`
- `ttd reopen <task-ref>`
- `ttd cancel <task-ref>`
- `ttd wontdo <task-ref>`
- `ttd delete <task-ref>`
- `ttd restore <task-ref>`
- `ttd edit <task-ref> [flags...]`

Projects and tags:

- `ttd projects`
- `ttd project show <project-ref>`
- `ttd tags`
- `ttd areas`

Utility:

- `ttd version`
- `ttd config ...`
- `ttd doctor`

## v1 Task Creation

Base:

```sh
ttd add "Call dentist"
```

Supported flags:

- `--notes <text>`
- `--when <date-expression>`
- `--deadline <date-expression>`
- `--project <name-or-id>`
- `--area <name-or-id>`
- `--heading <name-or-id>`
- `--tag <tag>` repeatable
- `--priority high`

Examples:

```sh
ttd add "Call dentist" --when tomorrow
ttd add "Prepare taxes" --deadline 2026-04-15 --tag finance
ttd add "Draft roadmap" --project Work --heading Planning
```

Recommendation for v1 date parsing:

- Support ISO dates first
- Add a minimal natural-language layer for common terms:
  - `today`
  - `tomorrow`
  - `next week`
  - Weekday names
  - `someday`
- Avoid trying to clone the full frontend parser immediately

That keeps capture useful without dragging too much frontend logic into the CLI.

## v1 Task Editing

Supported flags:

- `--title <text>`
- `--notes <text>`
- `--when <date-expression|none>`
- `--deadline <date-expression|none>`
- `--project <ref|none>`
- `--area <ref|none>`
- `--heading <ref|none>`
- `--set-tag <tag>` repeatable
- `--clear-tags`
- `--priority high|normal`

Examples:

```sh
ttd edit 42 --when tomorrow --priority high
ttd edit "call dentist" --project Personal
ttd edit 42 --deadline none
```

## Task Reference Resolution

This is the main UX problem. Raw UUID-only would make the CLI feel bad.

Support three forms:

- Exact ID
- Exact title match
- Fuzzy search selector

Proposed behavior:

- If input looks like a UUID, use it
- Otherwise search open tasks by title
- If one strong match exists, use it
- If multiple matches exist, print a numbered shortlist and fail with exit code `3`
- Allow explicit disambiguation via `--id`

Examples:

```sh
ttd done "Call dentist"
ttd show 9f12d0d4-...
```

Optional enhancement:

- Display short refs in lists, like the first 8 chars of the ID, but always keep the full ID in `--json`

## Output Specification

Default text mode:

- Compact
- Scan-friendly
- One task per line in list views
- Optional sections for grouped views

Example:

```text
Today

Overdue
[ ] Call dentist                  personal  due 2026-04-08
[ ] Send invoice                  work      due 2026-04-09

Today
[!] Prepare demo                  work      14:00
[ ] Buy groceries                 errands
```

Task detail output:

```text
Call dentist
id: 9f12d0d4
status: open
project: Personal
tags: health, admin
when: 2026-04-10
deadline: none

notes:
Ask about rescheduling.
```

JSON mode:

- Return server payloads as directly as practical
- Avoid reshaping unless needed for command metadata

## Exit Codes

- `0`: success
- `1`: generic error
- `2`: usage or validation error
- `3`: ambiguous selector
- `4`: not found
- `5`: auth error
- `6`: network or server unavailable

## Error Handling

Normalize common cases:

- Invalid API key
- Server unreachable
- Timeout
- Ambiguous task/project/tag selector
- Validation errors from API

Example:

```text
error: ambiguous task reference "invoice"
matches:
  1. Send invoice to Acme
  2. Pay hosting invoice
  3. Archive invoice PDFs
```

## Read Commands Mapping

Map directly to existing endpoints:

- `inbox` -> `/api/views/inbox`
- `today` -> `/api/views/today`
- `upcoming` -> `/api/views/upcoming`
- `anytime` -> `/api/views/anytime`
- `someday` -> `/api/views/someday`
- `logbook` -> `/api/views/logbook`
- `search` -> `/api/tasks?search=...`
- `show` -> `/api/tasks/{id}`
- `projects` -> `/api/projects`
- `project show` -> `/api/projects/{id}`
- `tags` -> `/api/tags`
- `areas` -> `/api/areas`

Mutations:

- `add` -> `POST /api/tasks`
- `edit` -> `PATCH /api/tasks/{id}`
- `done` -> `PATCH /api/tasks/{id}/complete`
- `reopen` -> `PATCH /api/tasks/{id}/reopen`
- `cancel` -> `PATCH /api/tasks/{id}/cancel`
- `wontdo` -> `PATCH /api/tasks/{id}/wontdo`
- `delete` -> `DELETE /api/tasks/{id}`
- `restore` -> `PATCH /api/tasks/{id}/restore`

## v1 Scope Recommendation

Include:

- Config and auth
- Views
- Search
- Show
- Add
- Edit
- Done, reopen, cancel, wontdo, delete, restore
- List projects, tags, and areas
- JSON output
- Selector resolution
- Tests for command behavior and API integration

Exclude:

- Offline queue or sync engine
- Checklist CRUD
- Attachment upload
- Reminders CRUD
- Schedules CRUD
- Repeat rules
- Bulk actions
- Reorder commands

Those can be v1.1 or v2.

## Suggested Architecture

Since this repo is Go-first, implement the CLI in Go.

Structure:

- `cmd/ttd/main.go`
- `internal/cli/root.go`
- `internal/cli/config/...`
- `internal/cli/client/...`
- `internal/cli/format/...`
- `internal/cli/resolve/...`
- `internal/cli/commands/...`

Suggested internal packages:

- `client`: HTTP wrapper around the API
- `config`: file, env, and flag resolution
- `format`: text and JSON renderers
- `resolve`: title/name to ID lookup
- `commands`: each subcommand

Command framework:

- Stdlib `flag` if minimal dependencies are preferred
- `cobra` if better command ergonomics and shell completion are desired

Recommendation:

- Use `cobra`
- Keep the rest dependency-light

## Testing Plan

Unit tests:

- Selector resolution
- Config precedence
- Date parsing
- Formatter output
- Exit code behavior

Integration tests:

- Use `httptest` against the existing handlers
- Verify auth, read commands, and basic task mutation flows

Do not test:

- Browser or offline sync semantics
- Frontend-only date UX

## Open Design Decisions

Decide these before implementation:

1. Should `ttd add` support lightweight natural language in the title itself, such as `ttd add "Call dentist tomorrow #health"`?
2. Should selectors search only open tasks by default, or all tasks?
3. Should default output be extremely compact, or slightly richer with project/tag metadata?
4. Do you want shell completion in v1?
5. Do you want a future `ttd quick` mode optimized for capture only?

## Recommendation

Build v1 as a small, online-only CLI companion and stop there before expanding scope. That should deliver most of the value with relatively little complexity because the backend already exposes almost everything needed and API-key auth is already designed for this kind of client.
