# ThingsToDo MCP Server — Design Spec

## Overview

A standalone TypeScript MCP server that exposes the ThingsToDo REST API as MCP tools, enabling full task management from Claude Code and other MCP-compatible clients.

## Architecture

- **Location:** `mcp/` directory in the ThingsToDo repo
- **Transport:** stdio (standard MCP protocol)
- **Runtime:** Node.js with TypeScript (`tsc` build)
- **SDK:** `@modelcontextprotocol/sdk`
- **HTTP client:** Built-in `fetch` (Node 18+)
- **Auth:** API key via `Authorization: Bearer <key>` header
- **Config:** Environment variables `THINGSTODO_URL` and `THINGSTODO_API_KEY`

### File Structure

```
mcp/
  package.json
  tsconfig.json
  src/
    index.ts          # Entry point — MCP server setup, tool registration
    client.ts         # HTTP client wrapper (base URL, auth header, error handling)
    tools/
      views.ts        # get_today, get_upcoming, get_inbox, get_anytime, get_someday, get_logbook
      tasks.ts        # search_tasks, get_task, create_task, update_task, complete_task, etc.
      bulk.ts         # bulk_action
      projects.ts     # list_projects, get_project, create_project, update_project, delete_project
      areas.ts        # list_areas, get_area, create_area, update_area, delete_area
      tags.ts         # list_tags, create_tag, update_tag, delete_tag
      checklist.ts    # add_checklist_item, update_checklist_item, delete_checklist_item
      attachments.ts  # add_link, delete_attachment
      schedules.ts    # add_schedule, update_schedule, delete_schedule
      headings.ts     # list_headings, create_heading, update_heading, delete_heading
```

## Tools

### Views (read-only)

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `get_today` | `GET /api/views/today` | none | Today's tasks grouped by section |
| `get_upcoming` | `GET /api/views/upcoming` | `from?` (ISO date, defaults to today) | Upcoming scheduled tasks |
| `get_inbox` | `GET /api/views/inbox` | none | Inbox tasks + review section |
| `get_anytime` | `GET /api/views/anytime` | none | Tasks without a scheduled date |
| `get_someday` | `GET /api/views/someday` | none | Someday tasks |
| `get_logbook` | `GET /api/views/logbook` | `limit?`, `offset?` | Completed/canceled tasks |

### Tasks

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `search_tasks` | `GET /api/tasks` | `search`, `status?`, `project_id?`, `area_id?`, `heading_id?`, `tag_ids?`, `when_date?`, `when_before?`, `when_after?`, `has_deadline?` | Full-text search with filters |
| `get_task` | `GET /api/tasks/:id` | `id` | Full task detail with checklist, attachments, schedules |
| `create_task` | `POST /api/tasks` | `title`, `notes?`, `when_date?`, `high_priority?`, `deadline?`, `project_id?`, `area_id?`, `heading_id?`, `tag_ids?` | Create a new task |
| `update_task` | `PATCH /api/tasks/:id` | `id`, any subset of task fields | Partial update |
| `complete_task` | `PATCH /api/tasks/:id/complete` | `id` | Mark task complete |
| `cancel_task` | `PATCH /api/tasks/:id/cancel` | `id` | Cancel task |
| `wontdo_task` | `PATCH /api/tasks/:id/wontdo` | `id` | Mark task as won't do |
| `reopen_task` | `PATCH /api/tasks/:id/reopen` | `id` | Reopen completed/canceled task |
| `delete_task` | `DELETE /api/tasks/:id` | `id` | Soft-delete (trash) |
| `purge_task` | `DELETE /api/tasks/:id/purge` | `id` | Permanently delete task |
| `restore_task` | `PATCH /api/tasks/:id/restore` | `id` | Restore soft-deleted task from trash |

### Bulk Actions

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `bulk_action` | `POST /api/tasks/bulk` | `task_ids`, `action`, `params?` | Apply action to multiple tasks. Actions: complete, cancel, wontdo, delete, set_priority, set_when, set_deadline, move_project, add_tags, remove_tags, mark_reviewed |

### Projects

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `list_projects` | `GET /api/projects` | none | All projects with task counts |
| `get_project` | `GET /api/projects/:id` | `id` | Project detail with headings and tasks |
| `create_project` | `POST /api/projects` | `title`, `area_id`, `notes?`, `when_date?`, `deadline?`, `tag_ids?` | Create project (area required) |
| `update_project` | `PATCH /api/projects/:id` | `id`, fields to update | Update project |
| `delete_project` | `DELETE /api/projects/:id` | `id` | Delete project |

### Areas

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `list_areas` | `GET /api/areas` | none | All areas with nested projects |
| `get_area` | `GET /api/areas/:id` | `id` | Area detail with projects and tasks |
| `create_area` | `POST /api/areas` | `title` | Create area |
| `update_area` | `PATCH /api/areas/:id` | `id`, `title` | Rename area |
| `delete_area` | `DELETE /api/areas/:id` | `id` | Delete area (blocked if has projects) |

### Tags

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `list_tags` | `GET /api/tags` | none | All tags |
| `create_tag` | `POST /api/tags` | `title`, `parent_tag_id?` | Create tag |
| `update_tag` | `PATCH /api/tags/:id` | `id`, `title?`, `color?` | Update tag |
| `delete_tag` | `DELETE /api/tags/:id` | `id` | Delete tag |

### Headings (sub-entity of project)

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `list_headings` | `GET /api/projects/:id/headings` | `project_id` | List headings in a project |
| `create_heading` | `POST /api/projects/:id/headings` | `project_id`, `title` | Create heading in project |
| `update_heading` | `PATCH /api/headings/:id` | `id`, `title?` | Update heading |
| `delete_heading` | `DELETE /api/headings/:id` | `id` | Delete heading |

### Checklist Items (sub-entity of task)

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `add_checklist_item` | `POST /api/tasks/:id/checklist` | `task_id`, `title` | Add checklist item |
| `update_checklist_item` | `PATCH /api/checklist/:id` | `item_id`, `title?`, `completed?` | Update item |
| `delete_checklist_item` | `DELETE /api/checklist/:id` | `item_id` | Delete item |

### Attachments (sub-entity of task)

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `add_link` | `POST /api/tasks/:id/attachments` | `task_id`, `url`, `title?` | Add link attachment |
| `delete_attachment` | `DELETE /api/attachments/:id` | `attachment_id` | Delete attachment |

### Schedules (sub-entity of task)

| Tool | Endpoint | Parameters | Description |
|------|----------|------------|-------------|
| `add_schedule` | `POST /api/tasks/:id/schedules` | `task_id`, `when_date`, `start_time?`, `end_time?` | Add schedule entry |
| `update_schedule` | `PATCH /api/schedules/:id` | `schedule_id`, `when_date?`, `start_time?`, `end_time?` | Update entry |
| `delete_schedule` | `DELETE /api/schedules/:id` | `schedule_id` | Delete entry |

## HTTP Client

A thin wrapper (`client.ts`) that:
- Constructs URLs from `THINGSTODO_URL` base
- Adds `Authorization: Bearer <key>` header from `THINGSTODO_API_KEY`
- Adds `Content-Type: application/json` for mutations
- Throws descriptive errors on non-2xx responses (includes status code and error body)
- Exposes `get()`, `post()`, `patch()`, `delete()` methods

## Response Formatting

MCP tool responses are returned as text content. The server formats JSON responses into readable text:
- View tools return task lists with title, status indicators, dates, and project/area context
- Task detail returns all fields in a structured format
- Mutations return the updated entity
- Errors return the error message clearly

## Excluded (YAGNI)

- File uploads — MCP can't stream binary files
- Reordering — UI-specific concern
- Settings management — rarely needed from CLI
- Auth management — one-time setup
- SSE/sync — not applicable to MCP
- Reminders/repeat rules — complex, can be added later if needed

## Configuration

Claude Code MCP settings (`~/.claude/settings.json` or project settings):

```json
{
  "mcpServers": {
    "thingstodo": {
      "command": "node",
      "args": ["<repo-path>/mcp/dist/index.js"],
      "env": {
        "THINGSTODO_URL": "https://tasks.cjhome.net",
        "THINGSTODO_API_KEY": "<your-api-key>"
      }
    }
  }
}
```

## Build & Run

```bash
cd mcp
npm install
npm run build    # tsc → dist/
npm run dev      # tsx watch mode for development
```

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `typescript` — build-time only
- `tsx` — dev-time only (optional, for watch mode)
