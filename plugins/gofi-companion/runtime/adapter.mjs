import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, rename, stat, open, rm, realpath } from 'node:fs/promises';
import { dirname, resolve, join, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import Ajv from 'ajv';

const exec = promisify(execFile);
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string', minLength: 1, maxLength: 4096 };
export const definitions = [
  ['status', 'Read local GoFi paths and prerequisites. No provider requests.', object()],
  ['version', 'Read the configured GoFi executable version.', object()],
  ['help', 'Read GoFi help without opening authentication or downloading.', object({ command: { enum: ['root', 'download', 'auth'] } })],
  ['auth_check', 'Check Deezer live authentication without recovery. Explicit provider request.', object()],
  ['auth_ensure', 'Recover supported stored/browser authentication and refresh Spotify when requested. May write private credentials.', object({ spotify: { type: 'boolean' } })],
  ['verify_audio', 'Fully decode an explicitly selected FLAC and report metadata, artwork and SHA-256.', object({ path: string }, ['path'])],
  ['download_start', 'Start an explicit FLAC track, album or playlist download with auth preflight and concurrency 2. Returns a job ID; poll job_status. No sharing, messaging or automatic cloud moves.', object({ url: string, output: string }, ['url'])],
  ['job_status', 'Read a download receipt. Playlist completeness still requires source reconciliation.', object({ job_id: { type: 'string', pattern: '^[a-f0-9-]{36}$' } }, ['job_id'])],
].map(([name, description, inputSchema]) => ({ name, description, inputSchema, annotations: {
  readOnlyHint: !['auth_ensure', 'download_start'].includes(name),
  destructiveHint: false,
  openWorldHint: ['auth_check', 'auth_ensure', 'download_start'].includes(name),
} }));
const ajv = new Ajv({ allErrors: true });
const validators = new Map(definitions.map(t => [t.name, ajv.compile(t.inputSchema)]));
export function validate(name, args) {
  const v = validators.get(name);
  if (!v || !v(args)) throw new Error(`Invalid ${name} arguments`);
}
export function sourceKind(value) {
  const u = new URL(value);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) throw new Error('Use an HTTPS provider URL without credentials');
  const match = u.hostname === 'open.spotify.com'
    ? u.pathname.match(/^\/(?:intl-[a-z]{2}\/)?(track|album|playlist)\/[A-Za-z0-9]+$/)
    : ['www.deezer.com', 'deezer.com'].includes(u.hostname) && u.pathname.match(/^\/(?:[a-z]{2}\/)?(track|album|playlist)\/\d+$/);
  if (!match) throw new Error('Unsupported Spotify or Deezer URL');
  return match[1];
}
export async function settings() {
  let p = {};
  try { p = JSON.parse(await readFile(join(homedir(), '.config/gofi-companion/profile.json'), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw new Error('Invalid GoFi Companion profile'); }
  const repo = resolve(process.env.GOFI_REPO || p.repo || join(homedir(), 'github/GoFi'));
  return {
    repo, binary: join(repo, 'gofi'), python: process.env.GOFI_PYTHON || 'python3',
    tracks: resolve(p.track_output || join(homedir(), 'Music/d-fi-music/FLAC/Tracks')),
    playlists: resolve(p.playlist_output || join(homedir(), 'Music/d-fi-music/FLAC/Playlist')),
    state: resolve(process.env.GOFI_COMPANION_STATE_DIR || join(homedir(), '.local/state/gofi-companion')),
  };
}
async function exists(path) { try { return (await stat(path)).isFile(); } catch { return false; } }
export async function atomicJson(path, data) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  await rename(tmp, path);
}
function privateEnv() {
  // Native GoFi/auth retain their established environment and .env precedence.
  return { ...process.env, PYTHONDONTWRITEBYTECODE: '1' };
}
async function pythonJson(config, relative, args, timeout = 120000) {
  let result;
  try { result = await exec(config.python, [join(root, 'skills', relative), ...args], { cwd: config.repo, env: privateEnv(), timeout, maxBuffer: 16 * 1024 * 1024 }); }
  catch (e) {
    if (e.killed || typeof e.code !== 'number') throw new Error('Helper could not run or timed out; inspect the selected job before retrying');
    result = e; // Expected nonzero helper codes carry redacted JSON.
  }
  try { return JSON.parse(result.stdout); } catch { throw new Error('Helper returned invalid JSON; raw provider output withheld'); }
}
export async function invoke(name, args = {}) {
  validate(name, args);
  const c = await settings();
  if (name === 'status') return { ...c, python: undefined, binary_exists: await exists(c.binary), quality: 9, concurrency: 2, cloud_finalization: 'explicit skill workflow', sharing: 'host approval required', messaging: 'host approval required' };
  if (name === 'job_status') {
    const result = JSON.parse(await readFile(join(c.state, 'jobs', args.job_id, 'result.json'), 'utf8'));
    return result;
  }
  if (name === 'verify_audio') {
    if (!isAbsolute(args.path) || !args.path.toLowerCase().endsWith('.flac')) throw new Error('Select an absolute FLAC file path');
    await realpath(args.path);
    return pythonJson({ ...c, repo: root }, 'gofi-verify-library/scripts/verify_audio.py', [args.path]);
  }
  if (!await exists(c.binary)) throw new Error('GoFi executable missing. Set GOFI_REPO to an existing checkout containing ./gofi');
  if (name === 'version' || name === 'help') {
    const command = name === 'version' ? ['--version'] : args.command && args.command !== 'root' ? [args.command, '--help'] : ['--help'];
    try {
      const { stdout } = await exec(c.binary, command, { cwd: c.repo, env: privateEnv(), timeout: 15000, maxBuffer: 128 * 1024 });
      return { text: stdout.trim() };
    } catch { throw new Error('GoFi inspection failed; provider output withheld'); }
  }
  if (name === 'auth_check' || name === 'auth_ensure') {
    if (name === 'auth_ensure') await requireCapabilities(c);
    const argv = [name === 'auth_check' ? 'check' : 'ensure', '--repo', c.repo];
    if (name === 'auth_ensure') argv.push('--require-lossless', ...(args.spotify ? ['--spotify'] : []));
    return pythonJson(c, 'gofi-auth/scripts/gofi_auth.py', argv);
  }
  if (name === 'download_start') {
    const kind = sourceKind(args.url);
    await requireCapabilities(c);
    if (args.output && !isAbsolute(args.output)) throw new Error('Output must be an absolute path');
    await mkdir(join(c.state, 'jobs'), { recursive: true, mode: 0o700 });
    const lock = join(c.state, 'download.lock');
    let handle;
    try { handle = await open(lock, 'wx', 0o600); } catch (e) {
      if (e.code === 'EEXIST') throw new Error('A GoFi Companion download is active or interrupted. Review its receipt before removing the lock');
      throw e;
    }
    const job_id = randomUUID();
    const dir = join(c.state, 'jobs', job_id);
    try {
      await handle.writeFile(job_id); await handle.close();
      await mkdir(dir, { mode: 0o700 });
      const source = new URL(args.url);
      const request = { url: source.origin + source.pathname, output: args.output || (kind === 'track' ? c.tracks : c.playlists), repo: c.repo };
      await atomicJson(join(dir, 'request.json'), request);
      await atomicJson(join(dir, 'result.json'), { job_id, status: 'running', kind, started_at: new Date().toISOString() });
      const child = spawn(process.execPath, [join(root, 'runtime/worker.mjs'), dir], { detached: true, stdio: 'ignore', env: privateEnv() });
      await new Promise((ok, fail) => { child.once('spawn', ok); child.once('error', fail); });
      child.unref();
      return { job_id, status: 'running', kind, output: request.output, next: 'Poll job_status; do not start the same job again' };
    } catch (e) { await handle.close().catch(() => {}); await rm(lock, { force: true }); throw e; }
  }
  throw new Error('Unknown GoFi tool');
}
async function requireCapabilities(c) {
  // Old GoFi releases lack --force/--check. Fail before any live auth request.
  const inspect = async args => (await exec(c.binary, args, { cwd: c.repo, timeout: 15000, maxBuffer: 128 * 1024 })).stdout;
  try {
    if (!(await inspect(['auth', 'spotify', '--help'])).includes('--check') || !(await inspect(['auth', 'deezer', '--help'])).includes('--force')) throw new Error();
  } catch { throw new Error('This GoFi build lacks auth spotify --check or auth deezer --force; configure a compatible current checkout'); }
}
export async function runWorker(dir) {
  const c = await settings();
  let receipt = JSON.parse(await readFile(join(dir, 'result.json'), 'utf8'));
  try {
    const request = JSON.parse(await readFile(join(dir, 'request.json'), 'utf8'));
    const result = await pythonJson({ ...c, repo: request.repo }, 'gofi-track/scripts/gofi_run.py', [request.url, '--repo', request.repo, '--output', request.output, '--concurrency', '2'], 7260000);
    receipt = { ...receipt, status: result.status === 'verified_new_files' ? 'verified' : 'needs_review', result };
  } catch (e) { receipt = { ...receipt, status: 'failed', error: e.message }; }
  finally {
    await atomicJson(join(dir, 'result.json'), { ...receipt, finished_at: new Date().toISOString() });
    const lock = join(c.state, 'download.lock');
    // An operator may have reviewed an interrupted job and replaced its lock.
    // Never remove another job's lock when this worker eventually finishes.
    if (await readFile(lock, 'utf8').catch(() => '') === receipt.job_id) await rm(lock, { force: true });
  }
}
