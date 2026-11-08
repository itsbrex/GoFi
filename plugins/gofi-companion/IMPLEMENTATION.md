# GoFi Companion 1.1.0

What changed: portable host manifests, native GoFi adapter and two UTCP runtimes.
Did it work: schemas, 36 Python regressions, 7 runtime tests and clean tarball
installs pass with fixture GoFi only.
What's next: CI, final review and fork-only PR.

## Commit checklist

- [x] Host metadata, icons and marketplace catalogs
- [x] Adapter, both runtimes, bootstrap export and package builds
- [ ] Regression coverage, installation docs and final verification
- [ ] Push and read back PR against itsbrex/GoFi main

## Scope

Only this plugin and root marketplace catalogs belong to this change. The original
GoFi working tree contains unrelated changes and is preserved. This branch starts
at the fork's current main, which contains the upstream d-fi entrypoint, not the
user's customized gofi executable. The plugin requires an existing current GoFi
checkout and checks auth CLI capabilities before provider operations.

No music jobs, live auth recovery, messages, sharing changes or Swarm calls form
part of validation. Fixture receipts and package artifacts are local and ignored.

## Verification passes

1. Current host schemas, manifests and component paths.
2. Fixture behavior, argument validation, injection resistance and job lifecycle.
3. Packed npm installs, both UTCP transports and MCP stdio round trips.

## Evidence

- Agent Plugins JSON schemas and Claude plugin/marketplace validator: passed.
- Runtime tests: 7 passed; both UTCP transports, code chains, CLI errors,
  malicious argument rejection, private job lifecycle and MCP stdio.
- Python helper regressions: 36 passed, offline.
- Tarballs installed into an empty temporary project: both CLI and MCP entry
  points passed with both underlying transports. Extracted ZIP ran independently.
- Real local mcp-bootstrap 0.2.1 produced an isolated profile and MCP manual;
  no live registrations or credentials changed.
- Node 24 used locally. Native isolated-vm build succeeded. GUI rendering,
  live provider actions and npm registry publication are not claimed.
