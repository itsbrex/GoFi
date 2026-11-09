#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { definitions, invoke } from './adapter.mjs';
const server = new Server({ name: 'gofi-native', version: '1.2.1' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: definitions }));
server.setRequestHandler(CallToolRequestSchema, async req => {
  try {
    const data = await invoke(req.params.name, req.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
  } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
});
await server.connect(new StdioServerTransport());
