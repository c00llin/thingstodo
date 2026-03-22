import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as client from '../client.js';

export function registerAttachmentTools(server: McpServer) {
  server.tool(
    'add_link',
    'Add a link attachment to a task',
    {
      task_id: z.string().describe('Task ID'),
      url: z.string().describe('URL to attach'),
      title: z.string().optional().describe('Link title'),
    },
    async ({ task_id, url, title }) => {
      const body: Record<string, string> = { url };
      if (title) body.title = title;
      const data = await client.post(`/api/tasks/${task_id}/attachments`, body);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    'delete_attachment',
    'Delete an attachment',
    { attachment_id: z.string().describe('Attachment ID') },
    async ({ attachment_id }) => {
      const data = await client.del(`/api/attachments/${attachment_id}`);
      const text = data === null ? 'Deleted successfully' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    },
  );
}
