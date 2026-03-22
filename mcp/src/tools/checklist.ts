import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerChecklistTools(server: McpServer) {
  server.tool(
    'add_checklist_item',
    'Add a checklist item to a task',
    {
      task_id: z.string().describe('Task ID'),
      title: z.string().describe('Checklist item title'),
    },
    async ({ task_id, title }) => {
      const data = await client.post(`/api/tasks/${task_id}/checklist`, { title });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_checklist_item',
    'Update a checklist item',
    {
      item_id: z.string().describe('Checklist item ID'),
      title: z.string().optional().describe('New title'),
      completed: z.boolean().optional().describe('Completion status'),
    },
    async ({ item_id, ...fields }) => {
      const data = await client.patch(`/api/checklist/${item_id}`, fields);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'delete_checklist_item',
    'Delete a checklist item',
    { item_id: z.string().describe('Checklist item ID') },
    async ({ item_id }) => {
      const data = await client.del(`/api/checklist/${item_id}`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
