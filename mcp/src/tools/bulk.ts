import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerBulkTools(server: McpServer) {
  server.tool(
    'bulk_action',
    'Apply an action to multiple tasks at once. Actions: complete, cancel, wontdo, delete, set_priority, set_when, set_deadline, move_project, add_tags, remove_tags, mark_reviewed',
    {
      task_ids: z.array(z.string()).describe('Array of task IDs'),
      action: z.enum([
        'complete', 'cancel', 'wontdo', 'delete', 'set_priority',
        'set_when', 'set_deadline', 'move_project', 'add_tags',
        'remove_tags', 'mark_reviewed',
      ]).describe('Bulk action to apply'),
      params: z.record(z.unknown()).optional().describe('Action-specific parameters (e.g. { "high_priority": true } for set_priority)'),
    },
    async ({ task_ids, action, params }) => {
      const data = await client.post('/api/tasks/bulk', { task_ids, action, params });
      const text = data === null ? 'Bulk action completed successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
