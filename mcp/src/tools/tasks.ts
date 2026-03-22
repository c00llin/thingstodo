import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerTaskTools(server: McpServer) {
  server.tool(
    'search_tasks',
    'Full-text search for tasks with optional filters',
    {
      search: z.string().describe('Search query'),
      status: z.string().optional().describe('Filter by status (open, completed, canceled)'),
      project_id: z.string().optional().describe('Filter by project ID'),
      area_id: z.string().optional().describe('Filter by area ID'),
      heading_id: z.string().optional().describe('Filter by heading ID'),
      tag_ids: z.string().optional().describe('Comma-separated tag IDs'),
      when_date: z.string().optional().describe('Filter by exact when_date (ISO date)'),
      when_before: z.string().optional().describe('Tasks scheduled before this date'),
      when_after: z.string().optional().describe('Tasks scheduled after this date'),
      has_deadline: z.boolean().optional().describe('Filter tasks that have a deadline'),
    },
    async (params) => {
      const qs = new URLSearchParams();
      qs.set('search', params.search);
      if (params.status) qs.set('status', params.status);
      if (params.project_id) qs.set('project_id', params.project_id);
      if (params.area_id) qs.set('area_id', params.area_id);
      if (params.heading_id) qs.set('heading_id', params.heading_id);
      if (params.tag_ids) qs.set('tag_ids', params.tag_ids);
      if (params.when_date) qs.set('when_date', params.when_date);
      if (params.when_before) qs.set('when_before', params.when_before);
      if (params.when_after) qs.set('when_after', params.when_after);
      if (params.has_deadline !== undefined) qs.set('has_deadline', String(params.has_deadline));
      const data = await client.get(`/api/tasks?${qs.toString()}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'get_task',
    'Get full task detail including checklist, attachments, and schedules',
    { id: z.string().describe('Task ID') },
    async ({ id }) => {
      const data = await client.get(`/api/tasks/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'create_task',
    'Create a new task',
    {
      title: z.string().describe('Task title'),
      notes: z.string().optional().describe('Task notes/description'),
      when_date: z.string().optional().describe('Scheduled date (ISO date or "someday")'),
      high_priority: z.boolean().optional().describe('Mark as high priority'),
      deadline: z.string().optional().describe('Deadline date (ISO date)'),
      project_id: z.string().optional().describe('Assign to project'),
      area_id: z.string().optional().describe('Assign to area'),
      heading_id: z.string().optional().describe('Assign to heading within project'),
      tag_ids: z.array(z.string()).optional().describe('Array of tag IDs to assign'),
    },
    async (params) => {
      const data = await client.post('/api/tasks', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_task',
    'Update an existing task (partial update)',
    {
      id: z.string().describe('Task ID'),
      title: z.string().optional().describe('New title'),
      notes: z.string().optional().describe('New notes'),
      when_date: z.string().optional().describe('New scheduled date'),
      high_priority: z.boolean().optional().describe('Priority flag'),
      deadline: z.string().optional().describe('New deadline'),
      project_id: z.string().optional().describe('Move to project'),
      area_id: z.string().optional().describe('Move to area'),
      heading_id: z.string().optional().describe('Move to heading'),
      tag_ids: z.array(z.string()).optional().describe('Replace tag assignments'),
    },
    async ({ id, ...fields }) => {
      const data = await client.patch(`/api/tasks/${id}`, fields);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'complete_task',
    'Mark a task as complete',
    { id: z.string().describe('Task ID') },
    async ({ id }) => {
      const data = await client.patch(`/api/tasks/${id}/complete`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'cancel_task',
    'Cancel a task',
    { id: z.string().describe('Task ID') },
    async ({ id }) => {
      const data = await client.patch(`/api/tasks/${id}/cancel`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'wontdo_task',
    "Mark a task as won't do",
    { id: z.string().describe('Task ID') },
    async ({ id }) => {
      const data = await client.patch(`/api/tasks/${id}/wontdo`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'reopen_task',
    'Reopen a completed or canceled task',
    { id: z.string().describe('Task ID') },
    async ({ id }) => {
      const data = await client.patch(`/api/tasks/${id}/reopen`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'delete_task',
    'Soft-delete a task (move to trash)',
    { id: z.string().describe('Task ID') },
    async ({ id }) => {
      const data = await client.del(`/api/tasks/${id}`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.tool(
    'purge_task',
    'Permanently delete a task',
    { id: z.string().describe('Task ID') },
    async ({ id }) => {
      const data = await client.del(`/api/tasks/${id}/purge`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );

  server.tool(
    'restore_task',
    'Restore a soft-deleted task from trash',
    { id: z.string().describe('Task ID') },
    async ({ id }) => {
      const data = await client.patch(`/api/tasks/${id}/restore`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
