import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerViewTools } from './tools/views.js';
import { registerTaskTools } from './tools/tasks.js';
import { registerBulkTools } from './tools/bulk.js';
import { registerProjectTools } from './tools/projects.js';
import { registerAreaTools } from './tools/areas.js';
import { registerTagTools } from './tools/tags.js';
import { registerHeadingTools } from './tools/headings.js';
import { registerChecklistTools } from './tools/checklist.js';
import { registerAttachmentTools } from './tools/attachments.js';
import { registerScheduleTools } from './tools/schedules.js';

const server = new McpServer({ name: 'thingstodo', version: '0.1.0' });

registerViewTools(server);
registerTaskTools(server);
registerBulkTools(server);
registerProjectTools(server);
registerAreaTools(server);
registerTagTools(server);
registerHeadingTools(server);
registerChecklistTools(server);
registerAttachmentTools(server);
registerScheduleTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
