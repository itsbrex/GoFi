import { CodeModeUtcpClient } from '@utcp/code-mode';
import '@utcp/cli';
import '@utcp/mcp';
import { discovery } from './provider.mjs';
import { definitions, root, validate } from './adapter.mjs';
import { join } from 'node:path';
import { openTransport } from './connection.mjs';

export async function engine(transport = process.env.GOFI_UTCP_TRANSPORT || 'auto') {
  return openTransport(transport, createEngine);
}
async function createEngine(transport) {
  const template = transport === 'cli' ? discovery : {
    name: 'gofi', call_template_type: 'mcp', config: { mcpServers: { gofi: { transport: 'stdio', command: process.execPath, args: [join(root, 'runtime/native-mcp.mjs')], env: Object.fromEntries(['GOFI_REPO','GOFI_PYTHON','GOFI_COMPANION_STATE_DIR'].filter(k => process.env[k]).map(k => [k, process.env[k]])) } } },
  };
  const client = await CodeModeUtcpClient.create(root, { manual_call_templates: [template] });
  try {
    client.transport = transport;
    const nativeCall = client.callTool.bind(client);
    const registered = await client.getTools();
    const names = new Map(definitions.map(d => [d.name, registered.find(t => t.name.split('.').at(-1) === d.name)?.name]));
    if ([...names.values()].some(n => !n)) throw new Error('GoFi tool registration incomplete');
    const tools = definitions.map(t => ({ name: `gofi.${t.name}`, description: t.description, tags: ['gofi'], inputs: t.inputSchema, outputs: { type: 'object', additionalProperties: true } }));
    client.getTools = async () => tools;
    client.callTool = async (name, args = {}) => {
      const short = name.replace(/^gofi\./, ''); validate(short, args);
      if (!names.has(short)) throw new Error('Unknown GoFi tool');
      const result = await nativeCall(names.get(short), transport === 'cli' ? { request: JSON.stringify(args) } : args);
      // The CLI protocol returns stderr on failure instead of rejecting. Require
      // our explicit envelope so a subprocess error can never look like success.
      if (transport === 'cli') {
        if (result?.ok !== true) throw new Error(result?.error || 'GoFi CLI provider failed');
        return result.result;
      }
      if (transport === 'mcp' && result?.isError) throw new Error(result.content?.[0]?.text || 'GoFi tool failed');
      if (transport === 'mcp' && result?.content) return result.structuredContent || JSON.parse(result.content.find(c => c.type === 'text').text);
      return result;
    };
    const nativeChain = client.callToolChain.bind(client);
    client.callToolChain = async (...args) => {
      const result = await nativeChain(...args);
      const error = result.logs.find(line => line.startsWith('[ERROR] Code execution failed:'));
      if (error) throw new Error(error.slice('[ERROR] Code execution failed:'.length).trim());
      return result;
    };
    return client;
  } catch (error) { await client.close().catch(() => {}); throw error; }
}
