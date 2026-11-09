import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm, readFile, access, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { engine } from '../runtime/engine.mjs';
import { invoke, sourceKind, root } from '../runtime/adapter.mjs';
import { openTransport } from '../runtime/connection.mjs';

const exec = promisify(execFile);
const fixture = await mkdtemp(join(tmpdir(), 'gofi-test spaces-'));
process.env.GOFI_REPO = fixture;
process.env.GOFI_COMPANION_STATE_DIR = join(fixture, 'state');
process.env.GOFI_PYTHON = join(fixture, 'fake-python');
await writeFile(join(fixture, 'gofi'), '#!/bin/sh\ncase "$*" in\n  "--version") echo "gofi fixture-1";;\n  *"--help") echo "--check --force --quality --concurrency";;\n  *) exit 99;;\nesac\n');
await chmod(join(fixture, 'gofi'), 0o700);
await writeFile(process.env.GOFI_PYTHON, '#!/bin/sh\nprintf \'run\\n\' >> "$GOFI_REPO/worker-starts"\nsleep 0.3\nprintf \'%s\\n\' \'{"status":"needs_collection_reconciliation","files":[],"collection_complete":false}\'\n');
await chmod(process.env.GOFI_PYTHON, 0o700);
after(async () => { await rm(fixture, { recursive: true, force: true }); });

test('provider URL validation rejects commands, credentials and foreign hosts', () => {
  for (const url of ['https://open.spotify.com/track/a','https://www.deezer.com/playlist/42']) assert(sourceKind(url));
  for (const url of ['http://open.spotify.com/track/a','https://user:pass@open.spotify.com/track/a','https://evil.test/track/a','https://open.spotify.com/track/a;touch x']) assert.throws(() => sourceKind(url));
});

for (const transport of ['cli', 'mcp']) {
  test(`${transport} transport discovery, typed code chains and failures`, async () => {
    const client = await engine(transport);
    try {
      assert((await client.getTools()).some(t => t.name === 'gofi.jobs_list'));
      assert.match(await client.getAllToolsTypeScriptInterfaces(), /download_start/);
      assert.equal((await client.callTool('gofi.version', {})).text, 'gofi fixture-1');
      const result = await client.callToolChain('return await gofi.version({});', 10000, 128);
      assert.equal(result.result.text, 'gofi fixture-1');
      await assert.rejects(client.callTool('gofi.help', { command: 'download; touch PWNED' }), /Invalid/);
      await assert.rejects(client.callTool('gofi.status', { secret: 'unexpected' }), /Invalid/);
      await assert.rejects(client.callTool('gofi.not_a_tool', {}), /Invalid|Unknown/);
      await assert.rejects(client.callToolChain('return process.env;', 5000, 128));
    } finally { await client.close(); }
  });
}

test('CLI provider preserves malicious input as data before rejecting it', async () => {
  const { CodeModeUtcpClient } = await import('@utcp/code-mode');
  const { discovery } = await import('../runtime/provider.mjs');
  const client = await CodeModeUtcpClient.create(root, { manual_call_templates: [discovery] });
  try {
    const t = (await client.getTools()).find(t => t.name.endsWith('.help'));
    const marker = join(fixture, 'PWNED');
    const result = await client.callTool(t.name, { request: `$(touch '${marker}')` });
    assert.equal(result.ok, false);
    assert.match(result.error, /JSON|Unexpected/);
    await assert.rejects(access(marker));
  } finally { await client.close(); }
});

test('long downloads return jobs, serialize starts and retain review status', async () => {
  const job = await invoke('download_start', { url: 'https://open.spotify.com/playlist/fixture?tracking=private#fragment', output: join(fixture, 'out') });
  assert.equal(job.status, 'running');
  const saved = JSON.parse(await readFile(join(process.env.GOFI_COMPANION_STATE_DIR, 'jobs', job.job_id, 'request.json')));
  assert.equal(saved.url, 'https://open.spotify.com/playlist/fixture');
  await assert.rejects(invoke('download_start', { url: 'https://open.spotify.com/track/fixture' }), /active or interrupted/);
  let state;
  for (let i = 0; i < 100; i++) {
    state = await invoke('job_status', { job_id: job.job_id });
    if (state.status !== 'running') break;
    await delay(50);
  }
  assert.equal(state.status, 'needs_review');
  assert.equal(state.result.collection_complete, false);
  await assert.rejects(access(join(process.env.GOFI_COMPANION_STATE_DIR,'download.lock')));
  await assert.rejects(invoke('job_status', { job_id: '../credentials' }), /Invalid/);
});

test('stdio server has only code-mode tools and clean protocol stdout', async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(root,'runtime/mcp.mjs')], env: { ...process.env, GOFI_UTCP_TRANSPORT: 'mcp' }, stderr: 'pipe' });
  const client = new Client({ name: 'gofi-fixture-client', version: '1.0.0' });
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(t => t.name), ['search_tools','tools_info','call_tool_chain']);
    const result = await client.callTool({ name: 'call_tool_chain', arguments: { code: 'return await gofi.version({});' } });
    assert(!result.isError, JSON.stringify(result));
    assert.equal(JSON.parse(result.content[0].text).result.text, 'gofi fixture-1');
    const bad = await client.callTool({ name: 'call_tool_chain', arguments: { code: 42 } });
    assert.equal(bad.isError, true);
  } finally { await client.close(); }
});

test('shell CLI returns one JSON document and nonzero errors', async () => {
  const result = await exec(process.execPath, [join(root,'runtime/cli.mjs'),'call','gofi.version','{}'], { env: process.env });
  assert.equal(JSON.parse(result.stdout).text,'gofi fixture-1');
  await assert.rejects(exec(process.execPath, [join(root,'runtime/cli.mjs'),'call','gofi.help','{"command":"rm"}'], { env: process.env }), e => JSON.parse(e.stdout).error.includes('Invalid'));
});

test('lost responses and reconnects reuse one request without another worker', async () => {
  const before = (await readFile(join(fixture, 'worker-starts'), 'utf8').catch(() => '')).split('\n').filter(Boolean).length;
  const status = await invoke('status');
  const request = { url: 'https://open.spotify.com/track/reconnect', request_id: randomUUID(), expected_host_id: status.host_id };
  const first = await invoke('download_start', request);
  assert.equal(first.job_id, request.request_id);
  assert.equal(first.resumed, false);
  const duplicate = await invoke('download_start', request);
  assert.equal(duplicate.job_id, first.job_id);
  assert.equal(duplicate.resumed, true);
  await assert.rejects(invoke('download_start', { ...request, url: 'https://open.spotify.com/track/different' }), /different download/);
  await assert.rejects(invoke('download_start', { ...request, expected_host_id: '0'.repeat(32) }), /host identity changed/);
  let receipt;
  for (let i = 0; i < 100; i++) {
    receipt = await invoke('job_status', { job_id: first.job_id });
    if (receipt.status !== 'running') break;
    await delay(50);
  }
  assert.equal(receipt.status, 'needs_review');
  // A completed receipt remains recoverable if the executable disappears.
  await rename(join(fixture, 'gofi'), join(fixture, 'gofi.saved'));
  try { assert.equal((await invoke('download_start', request)).resumed, true); }
  finally { await rename(join(fixture, 'gofi.saved'), join(fixture, 'gofi')); }
  const recovered = await invoke('jobs_list', { source: request.url + '?tracking=discarded', limit: 1 });
  assert.deepEqual(recovered.jobs.map(job => job.job_id), [first.job_id]);
  const resumed = await exec(process.execPath, [join(root, 'runtime/cli.mjs'), 'resume', first.job_id], { env: { ...process.env, GOFI_UTCP_TRANSPORT: 'cli' } });
  assert.equal(JSON.parse(resumed.stdout).job_id, first.job_id);
  const afterCount = (await readFile(join(fixture, 'worker-starts'), 'utf8')).split('\n').filter(Boolean).length;
  assert.equal(afterCount - before, 1);
});

test('automatic transport fallback occurs only before a client is returned', async () => {
  const attempts = [];
  let writes = 0;
  const client = await openTransport('auto', async transport => {
    attempts.push(transport);
    if (transport === 'mcp') throw new Error('not reachable');
    return { callTool: async () => { writes++; throw new Error('response lost'); } };
  });
  assert.deepEqual(attempts, ['mcp', 'cli']);
  await assert.rejects(client.callTool(), /response lost/);
  assert.equal(writes, 1);
  assert.deepEqual(attempts, ['mcp', 'cli']);
  await assert.rejects(openTransport('mcp', async () => { throw new Error('forced MCP unavailable'); }), /forced MCP/);
  await assert.rejects(openTransport('auto', async () => { throw new Error('private diagnostic'); }), /Neither GoFi/);
});

test('simultaneous identical request IDs create only one worker', async () => {
  const before = (await readFile(join(fixture, 'worker-starts'), 'utf8')).split('\n').filter(Boolean).length;
  const args = { url: 'https://open.spotify.com/track/concurrent', request_id: randomUUID() };
  const results = await Promise.all([invoke('download_start', args), invoke('download_start', args), invoke('download_start', args)]);
  assert.equal(new Set(results.map(result => result.job_id)).size, 1);
  assert.equal(results.filter(result => !result.resumed).length, 1);
  let receipt;
  for (let i = 0; i < 100; i++) {
    receipt = await invoke('job_status', { job_id: args.request_id });
    if (receipt.status !== 'running') break;
    await delay(50);
  }
  assert.equal(receipt.status, 'needs_review');
  const afterCount = (await readFile(join(fixture, 'worker-starts'), 'utf8')).split('\n').filter(Boolean).length;
  assert.equal(afterCount - before, 1);
});

test('CLI connection probe reports stable host identity across transports', async () => {
  const results = [];
  for (const transport of ['auto', 'cli']) {
    const response = await exec(process.execPath, [join(root, 'runtime/cli.mjs'), 'connect'], { env: { ...process.env, GOFI_UTCP_TRANSPORT: transport } });
    const result = JSON.parse(response.stdout);
    assert.equal(result.client, 'cli');
    assert.equal(result.transport, transport === 'auto' ? 'mcp' : 'cli');
    assert.equal(result.binary_exists, true);
    assert.match(result.host_id, /^[a-f0-9]{32}$/);
    results.push(result);
  }
  assert.equal(results[0].host_id, results[1].host_id);
});
