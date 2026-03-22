import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerScheduleTools(server: McpServer) {
  server.tool(
    'add_schedule',
    'Add a schedule entry to a task',
    {
      task_id: z.string().describe('Task ID'),
      when_date: z.string().describe('Schedule date (ISO date)'),
      start_time: z.string().optional().describe('Start time (HH:MM)'),
      end_time: z.string().optional().describe('End time (HH:MM)'),
    },
    async ({ task_id, ...fields }) => {
      const data = await client.post(`/api/tasks/${task_id}/schedules`, fields);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_schedule',
    'Update a schedule entry',
    {
      schedule_id: z.string().describe('Schedule entry ID'),
      when_date: z.string().optional().describe('New date'),
      start_time: z.string().optional().describe('New start time'),
      end_time: z.string().optional().describe('New end time'),
    },
    async ({ schedule_id, ...fields }) => {
      const data = await client.patch(`/api/schedules/${schedule_id}`, fields);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'delete_schedule',
    'Delete a schedule entry',
    { schedule_id: z.string().describe('Schedule entry ID') },
    async ({ schedule_id }) => {
      const data = await client.del(`/api/schedules/${schedule_id}`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
