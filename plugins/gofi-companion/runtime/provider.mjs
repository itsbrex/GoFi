#!/usr/bin/env node
import { definitions, invoke } from './adapter.mjs';
import { fileURLToPath } from 'node:url';
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
const command = `${quote(process.execPath)} ${quote(fileURLToPath(import.meta.url))}`;
const inherited = ['PATH', 'HOME', 'TMPDIR', 'GOFI_REPO', 'GOFI_PYTHON', 'GOFI_COMPANION_STATE_DIR', 'DEEZER_ARL', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET'];
const template = cmd => ({ call_template_type: 'cli', commands: [{ command: cmd, append_to_final_output: true }], inherit_env_vars: inherited });
export function manual() {
  return { utcp_version: '1.0.0', manual_version: '1.1.0', tools: definitions.map(t => ({ name: t.name, description: t.description, inputs: t.inputSchema, outputs: { type: 'object' }, tags: ['gofi'], tool_call_template: { name: t.name, ...template(`${command} call ${t.name} UTCP_ARG_request_UTCP_END`) } })) };
}
// One JSON envelope avoids shell interpretation of URLs, filenames or code.
// Public tool schemas are restored by the runtime; the wire is request:string.
export function wireManual() {
  const m = manual();
  for (const t of m.tools) t.inputs = { type: 'object', properties: { request: { type: 'string' } }, required: ['request'], additionalProperties: false };
  return m;
}
export const discovery = { name: 'gofi', ...template(`${command} discover`) };
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    if (process.argv[2] === 'discover') console.log(JSON.stringify(wireManual()));
    else if (process.argv[2] === 'call') console.log(JSON.stringify({ ok: true, result: await invoke(process.argv[3], JSON.parse(process.argv[4])) }));
    else throw new Error('Use discover or call TOOL JSON');
  } catch (e) { console.error(JSON.stringify({ ok: false, error: e.message })); process.exitCode = 1; }
}
