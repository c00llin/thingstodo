import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerViewTools(server: McpServer) {
  server.tool('get_today', "Get today's tasks grouped by section (overdue, today, this evening)", {}, async () => {
    const data = await client.get('/api/views/today');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool(
    'get_upcoming',
    'Get upcoming scheduled tasks. Optionally specify a start date.',
    { from: z.string().optional().describe('ISO date to start from (defaults to today)') },
    async ({ from }) => {
      const path = from ? `/api/views/upcoming?from=${from}` : '/api/views/upcoming';
      const data = await client.get(path);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool('get_inbox', 'Get inbox tasks and review section', {}, async () => {
    const data = await client.get('/api/views/inbox');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_anytime', 'Get tasks without a scheduled date (anytime tasks)', {}, async () => {
    const data = await client.get('/api/views/anytime');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool('get_someday', 'Get someday tasks', {}, async () => {
    const data = await client.get('/api/views/someday');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool(
    'get_logbook',
    'Get completed and canceled tasks',
    {
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Offset for pagination'),
    },
    async ({ limit, offset }) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set('limit', String(limit));
      if (offset !== undefined) params.set('offset', String(offset));
      const qs = params.toString();
      const data = await client.get(`/api/views/logbook${qs ? '?' + qs : ''}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );
}
