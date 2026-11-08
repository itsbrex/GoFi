# GoFi Companion

Local plugin for GoFi tracks, playlists, authentication recovery, verified FLAC files and scoped iCloud sharing. Includes two installable UTCP runtimes: `@itsbrex/gofi-code-mode-mcp` and `@itsbrex/gofi-code-mode-cli`.

![GoFi Companion cover](assets/brand-cover.png)

## Start here

Install with the instructions below, then ask: **Set up GoFi Companion on my Mac.** Installing on a phone does not provide remote access to your Mac; downloads need a connected host with local execution.

- **Track:** “Download this track as FLAC with GoFi and verify the file.”
- **Playlist:** “Download this playlist and report every verified, reused or failed track.”
- **Auth:** “Check GoFi authentication and recover supported sessions.”
- **Library:** “Verify this file, metadata, artwork and iCloud symlink.”
- **Share:** “Create an anyone-with-link, view-only iCloud link for this file only.”
- **Diagnose:** “Separate this GoFi auth failure from format availability and add an authorized regression.”

## Authentication contract

Checks happen before each requested download, not in an installed background daemon. Spotify access tokens refresh through GoFi's existing OAuth store. Deezer recovery uses a validated browser session through GoFi; the plugin cannot guarantee renewal after a revoked or expired provider login. Interactive reauthentication is a real stop condition. Network failures and account/format limits are not relabeled expired credentials.

Helpers use the Python standard library and the host curl client with a fixed HTTPS provider origin, no redirects and a total request deadline. Credential values travel only to their provider or the user's local GoFi process. HAR import validates a complete response token before changing `.env`. No request password replay. See [privacy](PRIVACY.md).

## Requirements

macOS or Linux with local execution; Node.js 22 or 24; Python 3.10+ and curl; `flac` for full decoder validation. The native `isolated-vm` dependency may need Python and C++ build tools if no prebuilt binary matches your host. iCloud and browser/Keychain recovery require macOS; `metaflac` is needed for requested metadata changes.

An existing compatible GoFi checkout must provide `./gofi`, `auth deezer --force`, and `auth spotify --check`. The fork's current `main` contains the upstream `d-fi` CLI; it is **not** the customized GoFi build required by these workflows. Keep your existing GoFi installation and select it with `GOFI_REPO` or `~/.config/gofi-companion/profile.json`. The plugin checks capabilities before starting recovery or downloads. Provider access, login and format availability still apply. No GoFi binary or credentials are bundled.

## Install from the fork

Claude Code marketplace installation, after this branch is merged:

```text
/plugin install gofi-companion --marketplace itsbrex/GoFi
```

For a local checkout or the unmerged PR branch, first prepare dependencies, then register that local marketplace:

```bash
git clone --branch feat/gofi-companion-code-mode https://github.com/itsbrex/GoFi.git gofi-plugins
cd gofi-plugins/plugins/gofi-companion
npm ci
npm run validate
cd ../..
claude plugin marketplace add .
claude plugin install gofi-companion@gofi-companion
```

Claude installs a cached copy. Its MCP server needs dependencies in **that installed plugin directory** too: run `npm ci` there during `gofi-setup`, then reconnect the plugin's MCP server. For local development, `claude --plugin-dir ./plugins/gofi-companion` uses this prepared directory directly. No install hook runs dependency downloads automatically.

Codex: add the local `plugins/gofi-companion` directory or the fork's marketplace through the plugin UI supported by your client. The root Agent Plugins manifest and `.codex-plugin` compatibility manifest include the same display metadata. Cursor: add this repository as a plugin marketplace, or use its plugin directory; `.cursor-plugin/marketplace.json` points to the same package. Run `npm ci` in each host's installed plugin directory, then restart its MCP connection. UI publication or directory approval is not implied by these files.

If the host cannot start a local MCP server, the skills and `gofi-code-mode-cli` remain usable with local shell access. Windows support is not claimed: the CLI transport and existing helpers use POSIX tools.

## Configure and use code mode

Set `GOFI_REPO` in the host's launch environment, or create a private non-secret profile:

```json
{
  "repo": "/absolute/path/to/GoFi",
  "track_output": "/absolute/path/to/Tracks",
  "playlist_output": "/absolute/path/to/Playlist"
}
```

Defaults are `~/github/GoFi`, `~/Music/d-fi-music/FLAC/Tracks`, and `~/Music/d-fi-music/FLAC/Playlist`. Albums use the collection destination. `GOFI_PYTHON` can select a Python executable; `GOFI_COMPANION_STATE_DIR` can select the private job directory. Secrets stay in GoFi's existing stores.

From the plugin directory:

```bash
node runtime/cli.mjs list
node runtime/cli.mjs info
node runtime/cli.mjs call gofi.status '{}'
node runtime/cli.mjs run 'return await gofi.version({});'
GOFI_UTCP_TRANSPORT=mcp node runtime/cli.mjs run 'return await gofi.version({});'
```

Both packages use the real `@utcp/code-mode` engine. `GOFI_UTCP_TRANSPORT=cli` (default) discovers a UTCP CLI manual; `mcp` discovers the bundled native stdio MCP adapter. The host-facing MCP server exposes `search_tools`, `tools_info`, and `call_tool_chain`. Code runs as JavaScript in `isolated-vm`, with generated TypeScript tool interfaces; TypeScript-specific syntax is not transpiled.

Tools: `gofi.status`, `version`, `help`, `auth_check`, `auth_ensure`, `verify_audio`, `download_start`, and `job_status`. Auth checks contact the provider; auth recovery may update private credentials. Downloads require explicit user intent. Code-mode is a local execution surface, not a permission boundary replacing host approvals.

`download_start({url, output?})` returns a job ID immediately. Poll `job_status({job_id})`; never replay a job because an MCP request ended. Workers finish in the background only for requested jobs, with private receipts under `~/.local/state/gofi-companion/jobs`. `verified` means the helper fully verified newly created FLAC files. `needs_review` covers reused files, fallback formats and collection reconciliation. It does not prove a complete playlist. An interrupted worker leaves its lock for review; inspect its receipt and confirm no worker remains before manually removing `download.lock`.

Sharing, messages and iCloud moves remain explicit skill workflows. No generic shell or messaging tool is exposed.

## Export to existing UTCP clients

`mcp-bootstrap` registers MCP servers; it does not turn an arbitrary CLI into MCP. `runtime/native-mcp.mjs` supplies that GoFi adapter. With an existing `mcp-bootstrap` installation (tested with 0.2.1; requires Python 3.12+):

```bash
python3 scripts/bootstrap.py --destination /new/private/directory/gofi-bootstrap
# Or select an existing executable with --bootstrap /path/to/mcp-bootstrap
node scripts/export-cli-config.mjs > /private/path/gofi-cli.utcp.json
```

The bootstrap helper uses isolated state, creates a local no-OAuth profile, and calls `register gofi --dry-run` to export `gofi.utcp.json`. It does not change live host registrations or sign in. Both exports use real `manual_call_templates`, with `call_template_type: mcp` or `cli`, accepted by UTCP code-mode-mcp and code-mode-cli. Select the exported file using your client's config option. Paths point at this installed plugin; regenerate after moving it. The external CLI manual takes a JSON `request` string and returns an `ok/result/error` envelope; bundled runtimes expose natural typed arguments and turn failures into tool errors. No music credentials appear in either export.

Use each client's search/info output to obtain the exact callable name. UTCP MCP versions differ in server-name prefixes; a name discovered in one client may differ in another. The bundled runtimes normalize names to `gofi.*`.

## Package

Ten skills include setup, operations and code-mode guidance. Root `plugin.json` uses Agent Plugins 1.0. Host overlays add supported display fields and correct root variables. Light/dark SVG and PNG logos, composer icons, and a generated brand cover are included. See [host support and spec sources](docs/compatibility.md) for exact fields and deliberately unused components.

Build both npm packages and a marketplace ZIP:

```bash
npm ci
npm run pack:all
npm run test:packages
```

`artifacts/` contains `itsbrex-gofi-code-mode-{mcp,cli}-1.1.0.tgz`, `gofi-companion-1.1.0.zip`, and `SHA256SUMS`. The ZIP contains root Claude/Cursor marketplace catalogs, the plugin, and both tarballs under its `distributions/` directory. Extract it, prepare the plugin with `npm ci`, then register the extracted marketplace directory. Archives contain no dependencies, music, credentials or run receipts.

Install either tarball into your own project with `npm install /path/to/package.tgz`; use `node_modules/.bin/gofi-code-mode-cli` or configure `node_modules/.bin/gofi-code-mode-mcp` as a stdio MCP server. Both packages include all adapter/helper source they need. The names are package identities; this change builds tarballs and CI artifacts, not an npm registry publication. Native dependencies install on the destination host. GitHub Actions publishes the tested archives as workflow artifacts, not a release.

## Verification

Run `npm run validate`, `npm test`, and `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v` for offline schema and behavior checks. `npm run test:packages` installs tarballs in a temporary project and uses a fake GoFi executable; it needs registry/cache access for dependencies. Live auth, music downloads and actual host UI rendering are separate proof levels. A collection run requires per-item reconciliation before claiming completion. Author attribution is package metadata; no verified publisher identity or directory approval is claimed.

An optional `node scripts/check-external.mjs CLI_ENTRY MCP_ENTRY MCP_BOOTSTRAP_EXECUTABLE` checks existing UTCP installations against both exports using isolated fixtures. See [dependency and execution notes](docs/security.md) for the outstanding upstream Zod advisory; the audit is not clean.
