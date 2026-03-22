import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerHeadingTools(server: McpServer) {
  server.tool(
    'list_headings',
    'List headings in a project',
    { project_id: z.string().describe('Project ID') },
    async ({ project_id }) => {
      const data = await client.get(`/api/projects/${project_id}/headings`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'create_heading',
    'Create a heading in a project',
    {
      project_id: z.string().describe('Project ID'),
      title: z.string().describe('Heading title'),
    },
    async ({ project_id, title }) => {
      const data = await client.post(`/api/projects/${project_id}/headings`, { title });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_heading',
    'Update a heading',
    {
      id: z.string().describe('Heading ID'),
      title: z.string().optional().describe('New title'),
    },
    async ({ id, title }) => {
      const data = await client.patch(`/api/headings/${id}`, { title });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'delete_heading',
    'Delete a heading',
    { id: z.string().describe('Heading ID') },
    async ({ id }) => {
      const data = await client.del(`/api/headings/${id}`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
