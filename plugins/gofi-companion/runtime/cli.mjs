#!/usr/bin/env node
import { engine } from './engine.mjs';
const [command = '--help', ...args] = process.argv.slice(2);
if (command === '--help') {
  console.log('gofi-code-mode-cli: connect | list | search QUERY | info | call TOOL JSON | run CODE | jobs [SOURCE_URL] | resume JOB_ID | validate\nGOFI_UTCP_TRANSPORT=auto (default: MCP then CLI), cli or mcp. GOFI_REPO selects an existing GoFi checkout.');
} else {
  const output = console.log.bind(console);
  console.log = (...a) => console.error(...a);
  let client;
  try {
    if (!['connect', 'list', 'search', 'info', 'call', 'run', 'jobs', 'resume', 'validate'].includes(command)) throw new Error('Unknown command; use --help');
    client = await engine();
    let result;
    if (command === 'connect') result = { client: 'cli', transport: client.transport, ...await client.callTool('gofi.status', {}) };
    if (command === 'jobs') result = await client.callTool('gofi.jobs_list', args[0] ? { source: args[0] } : {});
    if (command === 'resume') result = await client.callTool('gofi.job_status', { job_id: args[0] });
    if (command === 'list') result = (await client.getTools()).map(t => t.name);
    if (command === 'search') result = (await client.getTools()).filter(t => `${t.name} ${t.description}`.toLowerCase().includes((args[0] || '').toLowerCase()));
    if (command === 'info') result = await client.getAllToolsTypeScriptInterfaces();
    if (command === 'call') result = await client.callTool(args[0] || '', JSON.parse(args[1] || '{}'));
    if (command === 'run') { if (!args[0] || args[0].length > 64000) throw new Error('Supply code up to 64000 characters'); result = await client.callToolChain(args[0], 150000, 128); }
    if (command === 'validate') result = { valid: true, tools: (await client.getTools()).length };
    output(JSON.stringify(result));
  } catch (e) { output(JSON.stringify({ error: e.message })); process.exitCode = 1; }
  finally { await client?.close(); }
}
