import { mkdtemp, writeFile, readFile, mkdir, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { root } from '../runtime/adapter.mjs';

const exec = promisify(execFile);
const temp = await mkdtemp(join(tmpdir(), 'gofi packed smoke-'));
const version = JSON.parse(await readFile(join(root, 'package.json'))).version;
const artifact = name => join(root, 'artifacts', name);
try {
  const fixture = join(temp, 'fixture');
  await mkdir(fixture);
  await writeFile(join(fixture, 'gofi'), '#!/bin/sh\ncase "$*" in\n"--version") echo "gofi packed-fixture";;\n*"--help") echo "--check --force";;\n*) exit 99;;\nesac\n');
  await chmod(join(fixture, 'gofi'), 0o700);
  const env = { ...process.env, GOFI_REPO: fixture, GOFI_COMPANION_STATE_DIR: join(temp, 'jobs') };
  // npm run exports user .npmrc as environment flags, which nested project
  // installs reject. Re-read the normal config cascade and use the fixture's
  // exact native-dependency policy; never enable all lifecycle scripts.
  delete env.npm_config_allow_scripts;
  await writeFile(join(temp, 'package.json'), JSON.stringify({ name: 'gofi-package-test', private: true, allowScripts: { 'isolated-vm@6.0.2': true } }));
  console.log('Installing both tarballs in an empty temporary project');
  await exec('npm', ['install', '--no-audit', '--no-fund', '--prefix', temp,
    ...['cli', 'mcp'].map(kind => artifact(`itsbrex-gofi-code-mode-${kind}-${version}.tgz`))], { env, timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
  const cli = join(temp, 'node_modules/@itsbrex/gofi-code-mode-cli/dist/runtime/cli.mjs');
  const mcp = join(temp, 'node_modules/@itsbrex/gofi-code-mode-mcp/dist/runtime/mcp.mjs');
  for (const type of ['cli', 'mcp']) {
    const call = await exec(process.execPath, [cli, 'run', 'return await gofi.version({});'], { env: { ...env, GOFI_UTCP_TRANSPORT: type }, timeout: 30000 });
    assert.equal(JSON.parse(call.stdout).result.text, 'gofi packed-fixture');
    const client = new Client({ name: 'packed-fixture', version: '1.0.0' });
    try {
      await client.connect(new StdioClientTransport({ command: process.execPath, args: [mcp], env: { ...env, GOFI_UTCP_TRANSPORT: type }, stderr: 'pipe' }));
      assert.equal((await client.listTools()).tools.length, 3);
      const result = await client.callTool({ name: 'call_tool_chain', arguments: { code: 'return await gofi.version({});' } });
      assert(!result.isError, JSON.stringify(result));
      assert.equal(JSON.parse(result.content[0].text).result.text, 'gofi packed-fixture');
      const failure = await client.callTool({ name: 'call_tool_chain', arguments: { code: 'return process.env;' } });
      assert.equal(failure.isError, true);
    } finally { await client.close(); }
    console.log(`Packed CLI and MCP passed through ${type} transport`);
  }
  // Validate the ZIP independently, including marketplace paths and secret/cache
  // exclusions. Reuse installed schema dependencies only for this check.
  const zip = artifact(`gofi-companion-${version}.zip`);
  const archiveTest = await exec('python3', ['-c', `
import json,pathlib,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as archive:
    names=archive.namelist()
    assert all(not any(part in ('.env','node_modules','__pycache__','.git','jobs') for part in pathlib.PurePosixPath(name).parts) for name in names)
    assert all(not name.endswith(('.pyc','.har')) and not name.startswith('/') and '..' not in pathlib.PurePosixPath(name).parts for name in names)
    for host in ('claude','cursor'):
        catalog=json.loads(archive.read(f'.{host}-plugin/marketplace.json'))
        assert catalog['plugins'][0]['source']=='./plugins/gofi-companion'
    for kind in ('cli','mcp'):
        assert f'plugins/gofi-companion/distributions/itsbrex-gofi-code-mode-{kind}-${version}.tgz' in names
    archive.extractall(sys.argv[2])
print('ZIP catalogs, packaged runtimes and export exclusions passed')
`, zip, join(temp, 'unpacked')], { timeout: 30000 });
  console.log(archiveTest.stdout.trim());
  const unpacked = join(temp, 'unpacked/plugins/gofi-companion');
  await exec(process.execPath, [join(unpacked, 'scripts/validate.mjs')], { env, timeout: 30000 });
  await exec(process.execPath, [join(unpacked, 'runtime/cli.mjs'), 'call', 'gofi.version', '{}'], { env, timeout: 30000 });
  console.log('Extracted plugin resolved dependencies and ran its fixture CLI');
} finally {
  await rm(temp, { recursive: true, force: true });
}
