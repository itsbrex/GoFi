# GoFi code-mode MCP

GoFi-specific stdio MCP server built on UTCP code mode. Install the supplied
tarball in your project, then configure your MCP host to launch the absolute
path to `node_modules/.bin/gofi-code-mode-mcp`. Set `GOFI_REPO` in that server's
environment when your existing checkout is outside `~/github/GoFi`.

The server exposes `search_tools`, `tools_info`, and `call_tool_chain`. Example
code: `return await gofi.status({});`. `GOFI_UTCP_TRANSPORT=cli` (default) or `mcp`
selects the underlying adapter; both are included. Diagnostics go to stderr.

Requires Node 22 or 24, Python 3.10+, and a compatible GoFi binary with
`auth spotify --check` and `auth deezer --force`. No binary or credentials are
bundled. Native dependency installation follows your project's npm policy.

See [full plugin documentation](dist/README.md), [privacy](dist/PRIVACY.md), and
[dependency risk notes](dist/docs/security.md). Build/install instructions for
the full source plugin in that README are separate from using this tarball.
