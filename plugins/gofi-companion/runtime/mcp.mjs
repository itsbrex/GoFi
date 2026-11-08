#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { engine } from './engine.mjs';
// UTCP dependencies log lifecycle messages with console.log. Keep stdio clean.
console.log = (...args) => console.error(...args);
const client = await engine();
const server = new Server({ name: 'gofi-code-mode-mcp', version: '1.1.0' }, { capabilities: { tools: {} } });
const schema = properties => ({ type: 'object', properties, additionalProperties: false });
const tools = [
  { name: 'search_tools', description: 'Find GoFi tools and their input schemas.', inputSchema: schema({ query: { type: 'string' } }) },
  { name: 'tools_info', description: 'Read GoFi TypeScript tool interfaces.', inputSchema: schema({}) },
  { name: 'call_tool_chain', description: 'Run JavaScript against typed gofi tools. Downloads start jobs; poll job_status. Authentication and downloads require explicit user intent. No sharing or messaging tools.', inputSchema: { ...schema({ code: { type: 'string', maxLength: 64000 } }), required: ['code'] } },
];
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
server.setRequestHandler(CallToolRequestSchema, async req => {
  try {
    const a = req.params.arguments || {};
    let result;
    if (req.params.name === 'search_tools' && Object.keys(a).every(k => k === 'query') && (a.query === undefined || typeof a.query === 'string')) result = (await client.getTools()).filter(t => `${t.name} ${t.description}`.toLowerCase().includes((a.query || '').toLowerCase()));
    else if (req.params.name === 'tools_info' && !Object.keys(a).length) result = await client.getAllToolsTypeScriptInterfaces();
    else if (req.params.name === 'call_tool_chain' && Object.keys(a).length === 1 && typeof a.code === 'string' && a.code.length <= 64000) result = await client.callToolChain(a.code, 150000, 128);
    else throw new Error('Invalid GoFi code-mode request');
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  } catch (e) { return { isError: true, content: [{ type: 'text', text: e.message }] }; }
});
server.onclose = () => { client.close().catch(() => {}); };
await server.connect(new StdioServerTransport());
