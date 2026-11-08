---
name: gofi-code-mode
description: "Use GoFi Companion's local code-mode MCP or CLI tools for status, auth, verified FLAC downloads and job polling. Also use when exporting the adapter to existing UTCP clients."
---

# GoFi code mode

Use `search_tools` and `tools_info` on the GoFi MCP connection before composing
a chain. Only this plugin's `gofi` tools belong to that connection. Run JavaScript
with `call_tool_chain`; TypeScript interfaces describe arguments but type syntax
is not transpiled. Example: `return await gofi.status({});`.

Without MCP, run the bundled `runtime/cli.mjs` or installed
`gofi-code-mode-cli`. Commands: `list`, `search QUERY`, `info`, `call TOOL JSON`,
`run CODE`, `validate`. Quote code and JSON as data; never interpolate user text
into a shell command. Follow the active host's execution permissions.

`status`, `version` and `help` inspect local state. `auth_check` makes a provider
request. `auth_ensure` may refresh credentials and requires the requested auth or
download workflow. Use gofi-setup, gofi-auth, gofi-track and gofi-playlist for
their acceptance criteria; a tool response does not override those criteria.

For an authorized download call `gofi.download_start({url, output?})`, retain its
job ID, and poll `gofi.job_status({job_id})` until terminal. Poll briefly, then
wait between checks. Never replay a start on a timeout. `needs_review` requires
artifact/collection review, not a blind retry. A `verified` track still needs
recording identity checked; playlists always need source reconciliation. Do not
remove an interrupted job's lock until its receipt and worker state are reviewed.

The MCP server needs `npm ci` in its actual installed plugin directory using Node
22 or 24, then reconnection. Dependency installs are normal local setup work;
follow session authorization. Do not mutate another host's plugin cache.

For existing UTCP clients, use `scripts/bootstrap.py --destination NEW_PATH` to
export an isolated mcp-bootstrap MCP profile, or
`node scripts/export-cli-config.mjs` for the CLI manual. Read README for the
external CLI envelope. Never register into or overwrite live host configurations
as an implicit test. Do not persist secrets in exported configurations.

Report job state, verified artifacts and exact remaining gaps. Sharing, cloud
moves and messages still follow the separate skills and current authorization.
