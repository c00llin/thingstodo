import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerTagTools(server: McpServer) {
  server.tool('list_tags', 'List all tags', {}, async () => {
    const data = await client.get('/api/tags');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool(
    'create_tag',
    'Create a new tag',
    {
      title: z.string().describe('Tag title'),
      parent_tag_id: z.string().optional().describe('Parent tag ID for nesting'),
    },
    async (params) => {
      const data = await client.post('/api/tags', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_tag',
    'Update a tag (title or color)',
    {
      id: z.string().describe('Tag ID'),
      title: z.string().optional().describe('New title'),
      color: z.string().optional().describe('New color'),
    },
    async ({ id, ...fields }) => {
      const data = await client.patch(`/api/tags/${id}`, fields);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'delete_tag',
    'Delete a tag',
    { id: z.string().describe('Tag ID') },
    async ({ id }) => {
      const data = await client.del(`/api/tags/${id}`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
