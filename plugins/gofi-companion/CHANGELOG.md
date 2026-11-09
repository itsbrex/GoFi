# Changelog

## 1.2.1

- Accept server-prefixed MCP tool names in the external UTCP integration check.
- Package the user-verified physical-phone reconnect workflow unchanged.

## 1.2.0

- Add automatic connection discovery for desktop and mobile sessions using an existing authorized Mac executor.
- Add MCP-to-CLI fallback during transport initialization only, plus CLI connect/jobs/resume commands.
- Bind downloads to a verified host and stable request ID; repeated requests recover receipts without another worker.
- Add reconnect, host mismatch and duplicate-request regressions, with scoped remote setup guidance.

## 1.1.0

- Add Codex, Claude Code and Cursor metadata, icons and marketplace catalogs.
- Add typed GoFi tools over native MCP and UTCP CLI transports.
- Package GoFi-specific code-mode-mcp and code-mode-cli runtimes with pinned dependencies.
- Export isolated mcp-bootstrap profiles and native UTCP configurations.
- Keep long downloads in private, serialized jobs with explicit verification receipts.
- Add offline transport, input safety, packaging and host manifest checks.

## 1.0.0

- Original local skills, authentication helpers and FLAC verification workflows.
