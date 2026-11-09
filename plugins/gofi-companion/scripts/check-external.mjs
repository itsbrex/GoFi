// Optional integration check against existing UTCP clients and mcp-bootstrap.
// All profiles/configs are temporary; only a fixture GoFi executable is called.
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { root } from '../runtime/adapter.mjs';

const [cliEntry, mcpEntry, bootstrap] = process.argv.slice(2);
if (!cliEntry || !mcpEntry || !bootstrap) throw new Error('Usage: node scripts/check-external.mjs CLI_ENTRY MCP_ENTRY MCP_BOOTSTRAP_EXECUTABLE');
const exec = promisify(execFile);
const temp = await mkdtemp(join(tmpdir(), 'gofi external-check-'));
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR || tmpdir(), GOFI_REPO: temp };
try {
  await writeFile(join(temp, 'gofi'), '#!/bin/sh\nif [ "$*" = "--version" ]; then echo "gofi external-fixture"; else exit 99; fi\n');
  await chmod(join(temp, 'gofi'), 0o700);
  const exported = await exec(process.execPath, [join(root, 'scripts/export-cli-config.mjs')], { cwd: temp, env });
  await writeFile(join(temp, 'cli.json'), exported.stdout);
  await exec('python3', [join(root, 'scripts/bootstrap.py'), '--bootstrap', resolve(bootstrap), '--destination', join(temp, 'bootstrap')], { cwd: temp, env, timeout: 30000 });
  const manual = JSON.parse(await readFile(join(temp, 'bootstrap/gofi.utcp.json')));
  assert.equal(manual.manual_call_templates[0].call_template_type, 'mcp');
  for (const [type, config] of [['cli', join(temp, 'cli.json')], ['mcp', join(temp, 'bootstrap/gofi.utcp.json')]]) {
    const listed = await exec(process.execPath, [resolve(cliEntry), 'list', '--config', config], { cwd: temp, env, timeout: 30000 });
    const names = JSON.parse(listed.stdout).tools;
    assert(names.some(name => name.endsWith('.jobs_list')));
    const name = names.find(name => name.endsWith('version'));
    assert(name && /^[A-Za-z0-9_.]+$/.test(name));
    const args = type === 'cli' ? { request: '{}' } : {};
    const code = `return await ${name}(${JSON.stringify(args)});`;
    const called = await exec(process.execPath, [resolve(cliEntry), 'run', '--config', config, code], { cwd: temp, env, timeout: 30000 });
    const result = JSON.parse(called.stdout);
    assert.equal(result.success, true);
    assert.match(JSON.stringify(result.result), /gofi external-fixture/);
    const client = new Client({ name: 'gofi-external-fixture', version: '1.0.0' });
    try {
      await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(mcpEntry)], cwd: temp, env: { ...env, UTCP_CONFIG_FILE: config }, stderr: 'pipe' }));
      const tools = await client.listTools();
      assert(tools.tools.some(t => t.name === 'call_tool_chain'));
      // Installed clients may use different UTCP MCP versions and prefixes.
      // Discover each client's access name instead of borrowing the CLI's name.
      const search = await client.callTool({ name: 'search_tools', arguments: { task_description: 'GoFi executable version', limit: 10 } });
      assert(!search.isError, JSON.stringify(search));
      const found = JSON.parse(search.content.find(c => c.type === 'text').text).tools.find(t => t.name.endsWith('version'));
      assert(found && /^[A-Za-z0-9_.]+$/.test(found.name));
      const mcpCode = `return await ${found.name}(${JSON.stringify(args)});`;
      const result = await client.callTool({ name: 'call_tool_chain', arguments: { code: mcpCode } });
      assert(!result.isError, JSON.stringify(result));
      assert.match(JSON.stringify(result.content), /gofi external-fixture/);
    } finally { await client.close(); }
    console.log(`Existing UTCP CLI and MCP accepted ${type} export and called fixture GoFi`);
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
