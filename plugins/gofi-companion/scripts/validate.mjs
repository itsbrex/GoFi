import { readFile, stat, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const json = async p => JSON.parse(await readFile(join(root, p), 'utf8'));
const ajv = new Ajv2020();
for (const [manifest, schema] of [['plugin.json', 'plugin'], ['mcp.json', 'mcp']]) {
  const validate = ajv.compile(await json(`docs/schemas/${schema}.schema.json`));
  assert(validate(await json(manifest)), JSON.stringify(validate.errors));
}
const portable = await json('plugin.json');
for (const path of ['.claude-plugin/plugin.json','.cursor-plugin/plugin.json','.codex-plugin/plugin.json','package.json','packages/code-mode-cli/package.json','packages/code-mode-mcp/package.json']) assert.equal((await json(path)).version, portable.version, path);
for (const path of ['.claude-plugin/plugin.json','.cursor-plugin/plugin.json','.codex-plugin/plugin.json']) assert.equal((await json(path)).name, portable.name);
const ui = portable.extensions['com.openai'].interface;
assert(ui.shortDescription.length <= 30);
assert.deepEqual((await json('.codex-plugin/plugin.json')).interface, ui);
for (const key of ['logo','logoDark','composerIcon','composerIconDark']) assert((await stat(join(root,ui[key]))).size > 0);
for (const host of ['claude', 'cursor']) {
  const catalog = JSON.parse(await readFile(resolve(root, `../../.${host}-plugin/marketplace.json`), 'utf8'));
  assert.equal(catalog.plugins.length, 1);
  assert.equal(catalog.plugins[0].source, './plugins/gofi-companion');
  assert.equal(catalog.plugins[0].version, portable.version);
}
for (const name of await readdir(join(root,'skills'))) {
  const skill = await readFile(join(root,'skills',name,'SKILL.md'),'utf8');
  assert(skill.startsWith('---\n') && skill.includes(`name: ${name}\n`) && skill.includes('description:'));
}
console.log('Portable schemas, host identity/assets, marketplaces, packages and skills valid');
