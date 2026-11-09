import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, rename, stat, open, rm, realpath, readdir } from 'node:fs/promises';
import { dirname, resolve, join, isAbsolute, basename } from 'node:path';
import { homedir, hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import Ajv from 'ajv';

const exec = promisify(execFile);
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const object = (properties = {}, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const string = { type: 'string', minLength: 1, maxLength: 4096 };
const uuid = { type: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' };
export const definitions = [
  ['status', 'Read local GoFi paths and prerequisites. No provider requests.', object()],
  ['version', 'Read the configured GoFi executable version.', object()],
  ['help', 'Read GoFi help without opening authentication or downloading.', object({ command: { enum: ['root', 'download', 'auth'] } })],
  ['auth_check', 'Check Deezer live authentication without recovery. Explicit provider request.', object()],
  ['auth_ensure', 'Recover supported stored/browser authentication and refresh Spotify when requested. May write private credentials.', object({ spotify: { type: 'boolean' } })],
  ['verify_audio', 'Fully decode an explicitly selected FLAC and report metadata, artwork and SHA-256.', object({ path: string }, ['path'])],
  ['download_start', 'Start an explicit FLAC download. Retain one UUID request_id before sending; repeats return the same receipt without restarting work. Pin expected_host_id from status. No sharing or messaging.', object({ url: string, output: string, request_id: uuid, expected_host_id: { type: 'string', pattern: '^[a-f0-9]{32}$' } }, ['url'])],
  ['job_status', 'Read a download receipt, including after reconnect. Playlist completeness still requires source reconciliation.', object({ job_id: uuid }, ['job_id'])],
  ['jobs_list', 'Recover recent job IDs after a lost response. Optionally filter by exact source URL. Read only; never resumes or restarts work.', object({ source: string, limit: { type: 'integer', minimum: 1, maximum: 50 } })],
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
export function hostId(config) {
  // A routing identity, not a credential or a security boundary. It stays stable
  // across plugin upgrades but changes for another machine or job store.
  return createHash('sha256').update(JSON.stringify([hostname(), homedir(), config.repo, config.state])).digest('hex').slice(0, 32);
}
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
  if (name === 'status') return { ...c, python: undefined, host_id: hostId(c), platform: process.platform, node: process.version, cli: join(root, 'runtime/cli.mjs'), node_executable: process.execPath, binary_exists: await exists(c.binary), quality: 9, concurrency: 2, cloud_finalization: 'explicit skill workflow', sharing: 'host approval required', messaging: 'host approval required' };
  if (name === 'job_status') {
    const result = JSON.parse(await readFile(join(c.state, 'jobs', args.job_id, 'result.json'), 'utf8'));
    return { host_id: hostId(c), ...result };
  }
  if (name === 'jobs_list') return listJobs(c, args);
  if (name === 'download_start') return startDownload(c, args);
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
  throw new Error('Unknown GoFi tool');
}
async function listJobs(c, args) {
  const source = args.source ? normalizedSource(args.source) : undefined;
  let entries;
  try { entries = await readdir(join(c.state, 'jobs'), { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return { host_id: hostId(c), jobs: [], unreadable_receipts: 0 }; throw e; }
  const jobs = [];
  let unreadable_receipts = 0;
  for (const entry of entries) {
    if (!entry.isDirectory() || !new RegExp(uuid.pattern).test(entry.name)) continue;
    try {
      const dir = join(c.state, 'jobs', entry.name);
      const request = JSON.parse(await readFile(join(dir, 'request.json'), 'utf8'));
      if (source && request.url !== source) continue;
      const receipt = JSON.parse(await readFile(join(dir, 'result.json'), 'utf8'));
      jobs.push({ job_id: receipt.job_id, status: receipt.status, kind: receipt.kind, source: request.url, output: request.output, started_at: receipt.started_at, finished_at: receipt.finished_at });
    } catch { unreadable_receipts++; }
  }
  jobs.sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''));
  return { host_id: hostId(c), jobs: jobs.slice(0, args.limit || 20), unreadable_receipts };
}
function normalizedSource(value) {
  sourceKind(value);
  const source = new URL(value);
  return source.origin + source.pathname;
}
async function replay(dir, request, c) {
  try { await stat(dir); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  let saved, receipt;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      saved = JSON.parse(await readFile(join(dir, 'request.json'), 'utf8'));
      receipt = JSON.parse(await readFile(join(dir, 'result.json'), 'utf8'));
      break;
    } catch {
      const owner = await readFile(join(c.state, 'download.lock'), 'utf8').catch(() => '');
      if (owner !== basename(dir) || attempt === 19) throw new Error('Request receipt is incomplete. Inspect jobs_list and the existing worker; do not start a new request');
      await delay(25);
    }
  }
  if (['url', 'output', 'repo'].some(key => saved[key] !== request[key])) throw new Error('request_id already belongs to a different download');
  return { ...receipt, host_id: hostId(c), output: saved.output, resumed: true, next: 'Read job_status; this request was not started again' };
}
async function startDownload(c, args) {
  if (args.expected_host_id && args.expected_host_id !== hostId(c)) throw new Error('GoFi host identity changed. Reconnect to the original host before starting or resuming');
  const kind = sourceKind(args.url);
  if (args.output && !isAbsolute(args.output)) throw new Error('Output must be an absolute path');
  const request = { url: normalizedSource(args.url), output: args.output || (kind === 'track' ? c.tracks : c.playlists), repo: c.repo };
  const job_id = args.request_id || randomUUID();
  const dir = join(c.state, 'jobs', job_id);
  // Replays must work even if GoFi/auth is currently unavailable.
  const previous = await replay(dir, request, c);
  if (previous) return previous;
  if (!await exists(c.binary)) throw new Error('GoFi executable missing. Set GOFI_REPO to an existing checkout containing ./gofi');
  await requireCapabilities(c);
  await mkdir(join(c.state, 'jobs'), { recursive: true, mode: 0o700 });
  const lock = join(c.state, 'download.lock');
  let handle;
  try { handle = await open(lock, 'wx', 0o600); } catch (e) {
    if (e.code === 'EEXIST') {
      // An identical concurrent start may still be persisting its receipt.
      for (let i = 0; args.request_id && i < 20; i++) {
        const owner = await readFile(lock, 'utf8').catch(() => '');
        if (owner && owner !== job_id) break;
        await delay(25);
        try { const prior = await replay(dir, request, c); if (prior) return prior; }
        catch (error) { if (!error.message.startsWith('Request receipt is incomplete')) throw error; }
      }
      throw new Error('A GoFi Companion download is active or interrupted. Read jobs_list/job_status before retrying; keep the same request_id');
    }
    throw e;
  }
  let started = false;
  let receipt;
  try {
    await handle.writeFile(job_id); await handle.close();
    const prior = await replay(dir, request, c);
    if (prior) return prior;
    await mkdir(dir, { mode: 0o700 });
    await atomicJson(join(dir, 'request.json'), request);
    receipt = { job_id, request_id: job_id, host_id: hostId(c), status: 'running', kind, started_at: new Date().toISOString() };
    await atomicJson(join(dir, 'result.json'), receipt);
    const child = spawn(process.execPath, [join(root, 'runtime/worker.mjs'), dir], { detached: true, stdio: 'ignore', env: privateEnv() });
    await new Promise((ok, fail) => { child.once('spawn', ok); child.once('error', fail); });
    child.unref();
    started = true;
    return { ...receipt, output: request.output, resumed: false, next: 'Poll job_status; retain request_id across reconnects' };
  } catch (e) {
    if (receipt) await atomicJson(join(dir, 'result.json'), { ...receipt, status: 'failed', error: 'Worker did not start; inspect this receipt before any new request', finished_at: new Date().toISOString() });
    throw e;
  } finally {
    await handle.close().catch(() => {});
    if (!started && await readFile(lock, 'utf8').catch(() => '') === job_id) await rm(lock, { force: true });
  }
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
    const lock = join(dirname(dirname(dir)), 'download.lock');
    // An operator may have reviewed an interrupted job and replaced its lock.
    // Never remove another job's lock when this worker eventually finishes.
    if (await readFile(lock, 'utf8').catch(() => '') === receipt.job_id) await rm(lock, { force: true });
  }
}
