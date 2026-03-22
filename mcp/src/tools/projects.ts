import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerProjectTools(server: McpServer) {
  server.tool('list_projects', 'List all projects with task counts', {}, async () => {
    const data = await client.get('/api/projects');
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  });

  server.tool(
    'get_project',
    'Get project detail with headings and tasks',
    { id: z.string().describe('Project ID') },
    async ({ id }) => {
      const data = await client.get(`/api/projects/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'create_project',
    'Create a new project (area is required)',
    {
      title: z.string().describe('Project title'),
      area_id: z.string().describe('Area ID (required)'),
      notes: z.string().optional().describe('Project notes'),
      when_date: z.string().optional().describe('Scheduled date'),
      deadline: z.string().optional().describe('Deadline date'),
      tag_ids: z.array(z.string()).optional().describe('Tag IDs to assign'),
    },
    async (params) => {
      const data = await client.post('/api/projects', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'update_project',
    'Update a project',
    {
      id: z.string().describe('Project ID'),
      title: z.string().optional().describe('New title'),
      notes: z.string().optional().describe('New notes'),
      area_id: z.string().optional().describe('Move to area'),
      when_date: z.string().optional().describe('New scheduled date'),
      deadline: z.string().optional().describe('New deadline'),
      tag_ids: z.array(z.string()).optional().describe('Replace tag assignments'),
    },
    async ({ id, ...fields }) => {
      const data = await client.patch(`/api/projects/${id}`, fields);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'delete_project',
    'Delete a project',
    { id: z.string().describe('Project ID') },
    async ({ id }) => {
      const data = await client.del(`/api/projects/${id}`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
