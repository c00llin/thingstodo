# ThingsToDo MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that wraps the ThingsToDo REST API, enabling full task management from Claude Code.

**Architecture:** Standalone stdio MCP server using `@modelcontextprotocol/server` + Zod schemas. Each tool domain (views, tasks, projects, etc.) lives in its own file. A shared HTTP client handles auth and error formatting.

**Tech Stack:** TypeScript, `@modelcontextprotocol/server`, `zod/v4`, Node.js 18+ built-in `fetch`

**Spec:** `docs/superpowers/specs/2026-03-22-thingstodo-mcp-server-design.md`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `mcp/package.json`
- Create: `mcp/tsconfig.json`
- Create: `mcp/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "thingstodo-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.0.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create minimal index.ts**

```typescript
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';

const server = new McpServer({ name: 'thingstodo', version: '0.1.0' });

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 4: Install dependencies**

Run: `cd mcp && npm install`

- [ ] **Step 5: Build and verify**

Run: `cd mcp && npm run build`
Expected: Clean compilation, `dist/index.js` created

- [ ] **Step 6: Commit**

```bash
git add mcp/
git commit -m "feat(mcp): scaffold MCP server project"
```

---

### Task 2: HTTP Client

**Files:**
- Create: `mcp/src/client.ts`

- [ ] **Step 1: Create the HTTP client**

```typescript
const BASE_URL = process.env.THINGSTODO_URL;
const API_KEY = process.env.THINGSTODO_API_KEY;

if (!BASE_URL) throw new Error('THINGSTODO_URL environment variable is required');
if (!API_KEY) throw new Error('THINGSTODO_API_KEY environment variable is required');

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY}`,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: string }).error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export async function get(path: string): Promise<unknown> {
  return request('GET', path);
}

export async function post(path: string, body?: unknown): Promise<unknown> {
  return request('POST', path, body);
}

export async function patch(path: string, body?: unknown): Promise<unknown> {
  return request('PATCH', path, body);
}

export async function del(path: string): Promise<unknown> {
  return request('DELETE', path);
}
```

- [ ] **Step 2: Build and verify**

Run: `cd mcp && npm run build`
Expected: Clean compilation

- [ ] **Step 3: Commit**

```bash
git add mcp/src/client.ts
git commit -m "feat(mcp): add HTTP client wrapper"
```

---

### Task 3: View Tools

**Files:**
- Create: `mcp/src/tools/views.ts`
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Create views.ts**

Register tools: `get_today`, `get_upcoming`, `get_inbox`, `get_anytime`, `get_someday`, `get_logbook`.

```typescript
import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import * as client from '../client.js';

export function registerViewTools(server: McpServer) {
  server.registerTool('get_today', {
    description: "Get today's tasks grouped by section (overdue, today, this evening)",
    inputSchema: z.object({}),
  }, async () => {
    const data = await client.get('/api/views/today');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('get_upcoming', {
    description: 'Get upcoming scheduled tasks. Optionally specify a start date.',
    inputSchema: z.object({
      from: z.string().optional().describe('ISO date to start from (defaults to today)'),
    }),
  }, async ({ from }) => {
    const path = from ? `/api/views/upcoming?from=${from}` : '/api/views/upcoming';
    const data = await client.get(path);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('get_inbox', {
    description: 'Get inbox tasks and review section',
    inputSchema: z.object({}),
  }, async () => {
    const data = await client.get('/api/views/inbox');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('get_anytime', {
    description: 'Get tasks without a scheduled date (anytime tasks)',
    inputSchema: z.object({}),
  }, async () => {
    const data = await client.get('/api/views/anytime');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('get_someday', {
    description: 'Get someday tasks',
    inputSchema: z.object({}),
  }, async () => {
    const data = await client.get('/api/views/someday');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.registerTool('get_logbook', {
    description: 'Get completed and canceled tasks',
    inputSchema: z.object({
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Offset for pagination'),
    }),
  }, async ({ limit, offset }) => {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const qs = params.toString();
    const data = await client.get(`/api/views/logbook${qs ? '?' + qs : ''}`);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });
}
```

- [ ] **Step 2: Wire up in index.ts**

```typescript
import { McpServer, StdioServerTransport } from '@modelcontextprotocol/server';
import { registerViewTools } from './tools/views.js';

const server = new McpServer({ name: 'thingstodo', version: '0.1.0' });

registerViewTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
```

- [ ] **Step 3: Build and verify**

Run: `cd mcp && npm run build`
Expected: Clean compilation

- [ ] **Step 4: Commit**

```bash
git add mcp/src/tools/views.ts mcp/src/index.ts
git commit -m "feat(mcp): add view tools (today, upcoming, inbox, anytime, someday, logbook)"
```

---

### Task 4: Task Tools

**Files:**
- Create: `mcp/src/tools/tasks.ts`
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Create tasks.ts**

Register tools: `search_tasks`, `get_task`, `create_task`, `update_task`, `complete_task`, `cancel_task`, `wontdo_task`, `reopen_task`, `delete_task`, `purge_task`, `restore_task`.

Key schemas:
- `search_tasks`: `search` (string), plus optional `status`, `project_id`, `area_id`, `heading_id`, `tag_ids` (comma-separated string), `when_date`, `when_before`, `when_after`, `has_deadline`
- `create_task`: `title` (required), optional `notes`, `when_date`, `high_priority`, `deadline`, `project_id`, `area_id`, `heading_id`, `tag_ids` (array of strings)
- `update_task`: `id` (required), optional fields same as create

All single-ID action tools (`complete_task`, etc.) take just `{ id: string }`.

Pattern for each tool:
```typescript
server.registerTool('tool_name', {
  description: '...',
  inputSchema: z.object({ id: z.string().describe('Task ID') }),
}, async ({ id }) => {
  const data = await client.patch(`/api/tasks/${id}/action`);
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
});
```

- [ ] **Step 2: Wire up in index.ts**

Add `import { registerTaskTools } from './tools/tasks.js';` and call `registerTaskTools(server);`

- [ ] **Step 3: Build and verify**

Run: `cd mcp && npm run build`

- [ ] **Step 4: Commit**

```bash
git add mcp/src/tools/tasks.ts mcp/src/index.ts
git commit -m "feat(mcp): add task tools (CRUD, complete, cancel, wontdo, reopen, delete, purge, restore, search)"
```

---

### Task 5: Bulk Action Tool

**Files:**
- Create: `mcp/src/tools/bulk.ts`
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Create bulk.ts**

Register `bulk_action` tool with schema:
- `task_ids`: array of strings (required)
- `action`: enum of supported actions (required)
- `params`: optional record for action-specific parameters

```typescript
inputSchema: z.object({
  task_ids: z.array(z.string()).describe('Array of task IDs'),
  action: z.enum([
    'complete', 'cancel', 'wontdo', 'delete', 'set_priority',
    'set_when', 'set_deadline', 'move_project', 'add_tags',
    'remove_tags', 'mark_reviewed',
  ]).describe('Bulk action to apply'),
  params: z.record(z.unknown()).optional().describe('Action-specific parameters'),
}),
```

Handler calls `client.post('/api/tasks/bulk', { task_ids, action, params })`.

- [ ] **Step 2: Wire up in index.ts and build**

- [ ] **Step 3: Commit**

```bash
git add mcp/src/tools/bulk.ts mcp/src/index.ts
git commit -m "feat(mcp): add bulk action tool"
```

---

### Task 6: Project Tools

**Files:**
- Create: `mcp/src/tools/projects.ts`
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Create projects.ts**

Register: `list_projects`, `get_project`, `create_project`, `update_project`, `delete_project`.

- `list_projects`: no params, `GET /api/projects`
- `get_project`: `{ id }`, `GET /api/projects/:id`
- `create_project`: `{ title, area_id, notes?, when_date?, deadline?, tag_ids? }`, `POST /api/projects`
- `update_project`: `{ id, title?, notes?, area_id?, when_date?, deadline?, tag_ids? }`, `PATCH /api/projects/:id`
- `delete_project`: `{ id }`, `DELETE /api/projects/:id`

- [ ] **Step 2: Wire up, build, commit**

```bash
git commit -m "feat(mcp): add project tools"
```

---

### Task 7: Area Tools

**Files:**
- Create: `mcp/src/tools/areas.ts`
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Create areas.ts**

Register: `list_areas`, `get_area`, `create_area`, `update_area`, `delete_area`.

- `list_areas`: no params, `GET /api/areas`
- `get_area`: `{ id }`, `GET /api/areas/:id`
- `create_area`: `{ title }`, `POST /api/areas`
- `update_area`: `{ id, title }`, `PATCH /api/areas/:id`
- `delete_area`: `{ id }`, `DELETE /api/areas/:id`

- [ ] **Step 2: Wire up, build, commit**

```bash
git commit -m "feat(mcp): add area tools"
```

---

### Task 8: Tag Tools

**Files:**
- Create: `mcp/src/tools/tags.ts`
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Create tags.ts**

Register: `list_tags`, `create_tag`, `update_tag`, `delete_tag`.

- `list_tags`: no params, `GET /api/tags`
- `create_tag`: `{ title, parent_tag_id? }`, `POST /api/tags`
- `update_tag`: `{ id, title?, color? }`, `PATCH /api/tags/:id`
- `delete_tag`: `{ id }`, `DELETE /api/tags/:id`

- [ ] **Step 2: Wire up, build, commit**

```bash
git commit -m "feat(mcp): add tag tools"
```

---

### Task 9: Heading Tools

**Files:**
- Create: `mcp/src/tools/headings.ts`
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Create headings.ts**

Register: `list_headings`, `create_heading`, `update_heading`, `delete_heading`.

- `list_headings`: `{ project_id }`, `GET /api/projects/:id/headings`
- `create_heading`: `{ project_id, title }`, `POST /api/projects/:id/headings`
- `update_heading`: `{ id, title? }`, `PATCH /api/headings/:id`
- `delete_heading`: `{ id }`, `DELETE /api/headings/:id`

- [ ] **Step 2: Wire up, build, commit**

```bash
git commit -m "feat(mcp): add heading tools"
```

---

### Task 10: Sub-Entity Tools (Checklist, Attachments, Schedules)

**Files:**
- Create: `mcp/src/tools/checklist.ts`
- Create: `mcp/src/tools/attachments.ts`
- Create: `mcp/src/tools/schedules.ts`
- Modify: `mcp/src/index.ts`

- [ ] **Step 1: Create checklist.ts**

Register: `add_checklist_item`, `update_checklist_item`, `delete_checklist_item`.

- `add_checklist_item`: `{ task_id, title }`, `POST /api/tasks/:task_id/checklist`
- `update_checklist_item`: `{ item_id, title?, completed? }`, `PATCH /api/checklist/:item_id`
- `delete_checklist_item`: `{ item_id }`, `DELETE /api/checklist/:item_id`

- [ ] **Step 2: Create attachments.ts**

Register: `add_link`, `delete_attachment`.

- `add_link`: `{ task_id, url, title? }`, `POST /api/tasks/:task_id/attachments`
- `delete_attachment`: `{ attachment_id }`, `DELETE /api/attachments/:attachment_id`

- [ ] **Step 3: Create schedules.ts**

Register: `add_schedule`, `update_schedule`, `delete_schedule`.

- `add_schedule`: `{ task_id, when_date, start_time?, end_time? }`, `POST /api/tasks/:task_id/schedules`
- `update_schedule`: `{ schedule_id, when_date?, start_time?, end_time? }`, `PATCH /api/schedules/:schedule_id`
- `delete_schedule`: `{ schedule_id }`, `DELETE /api/schedules/:schedule_id`

- [ ] **Step 4: Wire all up in index.ts, build**

- [ ] **Step 5: Commit**

```bash
git add mcp/src/tools/checklist.ts mcp/src/tools/attachments.ts mcp/src/tools/schedules.ts mcp/src/index.ts
git commit -m "feat(mcp): add checklist, attachment, and schedule tools"
```

---

### Task 11: End-to-End Test

**Files:** none (manual verification)

- [ ] **Step 1: Build the project**

Run: `cd mcp && npm run build`
Expected: Clean compilation, all files in `dist/`

- [ ] **Step 2: Test with Claude Code**

Add to `~/.claude/settings.json` or project `.claude/settings.json`:

```json
{
  "mcpServers": {
    "thingstodo": {
      "command": "node",
      "args": ["/Users/collinjanssen/Sync/Antigravity/ThingsToDo/mcp/dist/index.js"],
      "env": {
        "THINGSTODO_URL": "https://tasks.cjhome.net",
        "THINGSTODO_API_KEY": "<key from .env>"
      }
    }
  }
}
```

- [ ] **Step 3: Verify tools are visible**

Restart Claude Code, check that `mcp__thingstodo__get_today` and other tools appear in the deferred tools list.

- [ ] **Step 4: Test key operations**

Test: `get_today`, `create_task`, `complete_task`, `search_tasks`, `list_projects`

- [ ] **Step 5: Final commit**

```bash
git commit -m "feat(mcp): complete ThingsToDo MCP server v0.1.0"
```

- [ ] **Step 6: Add mcp/node_modules to .gitignore**

Ensure `mcp/node_modules/` and `mcp/dist/` are in `.gitignore`.
