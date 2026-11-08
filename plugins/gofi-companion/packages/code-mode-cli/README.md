# GoFi code-mode CLI

GoFi-specific shell client built on UTCP code mode. Install the supplied tarball
in your project, then run:

```bash
node_modules/.bin/gofi-code-mode-cli list
node_modules/.bin/gofi-code-mode-cli call gofi.status '{}'
node_modules/.bin/gofi-code-mode-cli run 'return await gofi.version({});'
```

Requires Node 22 or 24, Python 3.10+, and an existing compatible GoFi checkout
with `auth spotify --check` and `auth deezer --force`. Set `GOFI_REPO` when the
checkout is outside `~/github/GoFi`. `GOFI_UTCP_TRANSPORT=mcp` selects the native
MCP adapter; `cli` is the default. Both are included. No binary or credentials
are bundled. Native dependency installation follows your project's npm policy.

See [full plugin documentation](dist/README.md), [privacy](dist/PRIVACY.md), and
[dependency risk notes](dist/docs/security.md). Build/install instructions for
the full source plugin in that README are separate from using this tarball.
