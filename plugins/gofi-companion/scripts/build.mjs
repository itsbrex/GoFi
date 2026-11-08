import { cp, mkdir, rm, chmod, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
for (const kind of ['mcp', 'cli']) {
  const out = join(root, `packages/code-mode-${kind}/dist`);
  await rm(out, { force: true, recursive: true });
  await mkdir(out, { recursive: true });
  for (const name of ['runtime', 'skills', 'assets', 'docs', 'README.md', 'PRIVACY.md', 'CHANGELOG.md']) await cp(join(root, name), join(out, name), { recursive: true, filter: path => !path.includes('__pycache__') && !path.endsWith('.pyc') });
  await mkdir(join(out, 'scripts'));
  for (const name of ['bootstrap.py', 'export-cli-config.mjs']) await cp(join(root, 'scripts', name), join(out, 'scripts', name));
  await chmod(join(out, `runtime/${kind}.mjs`), 0o755);
}
console.log(`Built both GoFi runtimes ${(JSON.parse(await readFile(join(root, 'package.json')))).version}`);
