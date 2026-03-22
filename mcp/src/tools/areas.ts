import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerAreaTools(server: McpServer) {
  server.tool('list_areas', 'List all areas with nested projects', {}, async () => {
    const data = await client.get('/api/areas');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool(
    'get_area',
    'Get area detail with projects and tasks',
    { id: z.string().describe('Area ID') },
    async ({ id }) => {
      const data = await client.get(`/api/areas/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'create_area',
    'Create a new area',
    { title: z.string().describe('Area title') },
    async ({ title }) => {
      const data = await client.post('/api/areas', { title });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_area',
    'Rename an area',
    {
      id: z.string().describe('Area ID'),
      title: z.string().describe('New title'),
    },
    async ({ id, title }) => {
      const data = await client.patch(`/api/areas/${id}`, { title });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'delete_area',
    'Delete an area (blocked if it still has projects)',
    { id: z.string().describe('Area ID') },
    async ({ id }) => {
      const data = await client.del(`/api/areas/${id}`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
