# Host compatibility

Spec review: 2026-11-08. Field support is distinct from installation, rendering,
directory approval or a successful provider download.

| Host | Manifest and tool config | Included metadata/assets |
| --- | --- | --- |
| Agent Plugins / Codex | `plugin.json`, `mcp.json`; `.codex-plugin/plugin.json` overlay with `mcp.codex.json` for older clients | Name, version, author, description, homepage, repository, license, keywords; OpenAI display name, short/long descriptions, category, capabilities, suggested prompts, developer name, brand colors, light/dark logos and composer icons, onboarding skill |
| Claude Code | `.claude-plugin/plugin.json`, auto-discovered `.mcp.json`; root `.claude-plugin/marketplace.json` | Shared identity plus display name, icon, documentation, support and privacy URLs |
| Cursor | `.cursor-plugin/plugin.json`, explicit `mcp.cursor.json`; root `.cursor-plugin/marketplace.json` | Shared identity, logo, skills path and MCP config |

Portable MCP uses `cwd: "./"` and relative script arguments. Codex's overlay uses
`${PLUGIN_ROOT}`, Claude uses `${CLAUDE_PLUGIN_ROOT}`, and Cursor uses
`${CURSOR_PLUGIN_ROOT}`. Cursor does not expand the standard's `${PLUGIN_ROOT}`.
All point at the same local server; hosts should load one format, not register
the overlays as separate plugins. Schema tests check these paths; actual GUI
rendering across all three hosts is not covered by the fixture suite.

No screenshot field is populated with generated artwork: the brand cover is
illustration, not a screenshot. No terms URL or verified publisher badge is
invented. No rules, agents, commands, hooks, remote connectors, secret variables
or persistent tasks are added just to fill optional schema fields. The skills
cover user flows; optional hooks would introduce unsolicited side effects.
Marketplace metadata points only at the user's fork. npm publication and public
directory submission are separate release actions.

The GoFi wrappers are scoped packages, not copies or replacements of the upstream
UTCP projects. Their pinned dependencies are listed in `package.json`; both
transports use `@utcp/code-mode`. No CLI implementation is vendored. The native
adapter invokes the existing configured GoFi binary and bundled Python helpers.

## Primary sources

- [Agent Plugins manifest schema](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)
- [Agent Plugins MCP schema](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json)
- [Claude plugin reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude marketplace reference](https://code.claude.com/docs/en/plugin-marketplaces)
- [Cursor plugin reference](https://cursor.com/docs/reference/plugins)
- [UTCP TypeScript code mode](https://github.com/universal-tool-calling-protocol/code-mode)
- [UTCP CLI transport](https://github.com/universal-tool-calling-protocol/typescript-utcp/tree/main/packages/cli)
- [mcp-bootstrap](https://github.com/itsbrex/mcp-bootstrap)

The two Agent Plugins schemas are saved under `docs/schemas` for offline checks.
Host-specific fields also pass Claude's own validator and local path/version
checks. Recheck primary specs before changing host-specific metadata.
