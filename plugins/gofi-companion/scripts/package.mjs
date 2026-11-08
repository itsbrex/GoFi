import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'artifacts');
await mkdir(out, { recursive: true });
execFileSync(process.execPath, [join(root, 'scripts/build.mjs')], { stdio: 'inherit' });
for (const kind of ['mcp', 'cli']) execFileSync('npm', ['pack', '--workspace', `packages/code-mode-${kind}`, '--pack-destination', out], { cwd: root, stdio: 'inherit' });
const stage = join(out, 'stage');
await rm(stage, { recursive: true, force: true });
const version = JSON.parse(await readFile(join(root, 'package.json'))).version;
const plugin = join(stage, 'plugins', 'gofi-companion');
await mkdir(plugin, { recursive: true });
for (const host of ['claude', 'cursor']) await cp(resolve(root, `../../.${host}-plugin`), join(stage, `.${host}-plugin`), { recursive: true });
// Explicit export allowlist: no caches, node_modules, credentials or run receipts.
for (const name of ['plugin.json','.codex-plugin','.claude-plugin','.cursor-plugin','.mcp.json','mcp.json','mcp.codex.json','mcp.cursor.json','assets','skills','runtime','scripts','docs','tests','package.json','package-lock.json','README.md','PRIVACY.md','CHANGELOG.md']) {
  await cp(join(root, name), join(plugin, name), { recursive: true, filter: path => !path.includes('__pycache__') && !path.endsWith('.pyc') });
}
await mkdir(join(plugin, 'packages'), { recursive: true });
for (const kind of ['mcp','cli']) await cp(join(root, `packages/code-mode-${kind}`), join(plugin, `packages/code-mode-${kind}`), { recursive: true });
await mkdir(join(plugin, 'distributions'));
const tarballs = ['mcp','cli'].map(kind => `itsbrex-gofi-code-mode-${kind}-${version}.tgz`);
for (const file of tarballs) await cp(join(out, file), join(plugin, 'distributions', file));
const archive = `gofi-companion-${version}.zip`;
execFileSync('python3', ['-c', 'import shutil,sys; shutil.make_archive(sys.argv[1], "zip", sys.argv[2])', join(out, archive.slice(0, -4)), stage]);
const sums = [];
for (const name of [...tarballs, archive].sort()) sums.push(`${createHash('sha256').update(await readFile(join(out,name))).digest('hex')}  ${name}`);
await writeFile(join(out, 'SHA256SUMS'), sums.join('\n') + '\n');
await rm(stage, { recursive: true, force: true });
console.log(`Artifacts: ${resolve(out)}`);
