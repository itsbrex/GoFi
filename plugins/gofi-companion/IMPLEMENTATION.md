# GoFi Companion 1.2.1

What changed: automatic connected-host routing, transport initialization fallback,
host-bound request IDs and reconnectable job receipts.
Did it work: runtime, Python, schema and package checks pass; the user confirmed
the same verified job on a physical iPhone before and after reopening the chat.
What's next: keep the connected Mac executor running; PR #9 tracks release status.

## Mobile update checklist

- [x] Verify a real track through the installed code-mode CLI
- [x] Reconnect the existing Mac executor and recover the same receipt remotely
- [x] Implement host routing, stable request IDs and recent-job lookup
- [x] Verify final runtime regressions and clean package installs
- [x] Publish fork-only PR and update the existing account plugin
- [x] Verify physical-phone reconnect and polling (user-performed test)

## Initial distribution checklist

- [x] Host metadata, icons and marketplace catalogs
- [x] Adapter, both runtimes, bootstrap export and package builds
- [x] Regression coverage, installation docs and final verification
- [x] Push and read back PR against itsbrex/GoFi main

## Scope

Only this plugin, its scoped CI and root marketplace catalogs belong to this change. The original
GoFi working tree contains unrelated changes and is preserved. This branch starts
at the fork's current main, which contains the upstream d-fi entrypoint, not the
user's customized gofi executable. The plugin requires an existing current GoFi
checkout and checks auth CLI capabilities before provider operations.

Initial distribution validation used offline fixtures. The mobile update also
used the one explicitly requested live track described below. No messages,
public sharing changes or Swarm calls formed part of this update. Fixture
receipts and package artifacts are local and ignored.

## Verification passes

1. Current host schemas, manifests and component paths.
2. Fixture behavior, argument validation, injection resistance and job lifecycle.
3. Packed npm installs, both UTCP transports and MCP stdio round trips.

## Initial 1.1.0 evidence

- Agent Plugins JSON schemas and Claude plugin/marketplace validator: passed.
- Runtime tests: 7 passed; both UTCP transports, code chains, CLI errors,
  malicious argument rejection, private job lifecycle and MCP stdio.
- Python helper regressions: 36 passed, offline.
- Tarballs installed into an empty temporary project: both CLI and MCP entry
  points passed with both underlying transports. Extracted ZIP ran independently.
- Real local mcp-bootstrap 0.2.1 produced an isolated profile and MCP manual;
  no live registrations or credentials changed.
- Existing UTCP code-mode-cli 0.1.2 and local code-mode-mcp 1.4.0 each accepted
  both exported transport types and called only the fixture GoFi version tool.
- Claude Code 2.1.319 installed the local marketplace in isolated configuration,
  listed 10 skills, and reported the plugin MCP server connected.
- Scoped GitHub Actions workflow covers Linux/Node 22 and macOS/Node 24;
  actionlint passed. No Claude/Codex AI-review actions exist in this branch's CI.
- Dependency audit remains open: one high Zod advisory affects five package
  entries through UTCP's Zod 3 requirement. See docs/security.md; no automatic
  compatible fix is available. No clean-audit claim is made.
- Node 24 used locally. Native isolated-vm build succeeded. GUI rendering,
  live provider actions and npm registry publication are not claimed.
- Fork-only publication: [PR #8](https://github.com/itsbrex/GoFi/pull/8),
  `feat/gofi-companion-code-mode` into `itsbrex/GoFi:main`. Both repositories
  were read back through GitHub. No upstream push or PR occurred.
- Distributions: `artifacts/gofi-companion-1.1.0.zip`, the two scoped npm
  tarballs, and `artifacts/SHA256SUMS`. CI status and downloadable copies are
  attached to the PR's GoFi Companion workflow; see that live run for results.

## Current live evidence

- One requested Spotify track completed through the installed CLI with CLI transport.
  Provider auth, recording ISRC/duration, full FLAC decode and embedded artwork passed.
- Scoped iCloud finalization produced a canonical file and local absolute symlink;
  the SHA-256 remained unchanged. Cloud upload completion is not claimed.
- Existing Remote Desktop Commander device session was restored with version 0.3.1.
  A remote CLI read returned the same completed job without starting another download.
- The user tested the physical iPhone: recovered the existing verified track job,
  closed/reopened the chat, then checked the same job again. The user reported
  "Same verified job both times." A subsequent remote read found exactly one
  matching job with the original completion time. This is user-performed phone
  proof; iPhone Mirroring automation remained unavailable after repeated timeouts.
- Source changes remain isolated from unrelated original GoFi work.

- Version 1.2.0: 11 runtime regressions and 36 offline Python checks passed.
  Fresh installs passed both CLI/MCP entrypoints over both transport types, and
  the extracted marketplace ZIP ran independently. Schema validation passed.

- Private account plugin v1.2.0 saved; manifest, CLI, adapter, routing module,
  connection skill and mobile guide matched source on readback. Existing prompts
  and private audience were preserved; old distribution tarballs were replaced.
- Stable host CLI installed outside the plugin cache. Through the existing
  remote executor, repeating the original completed request returned resumed=true,
  the same completion time/hash, and one matching job before and after.
- [PR #9](https://github.com/itsbrex/GoFi/pull/9) targets the fork main branch.
  Initial head passed Linux/Node 22, macOS/Node 24 and Go CI in
  [run 42539684387](https://github.com/itsbrex/GoFi/actions/runs/42539684387).
- The next documentation-only head hit one macOS native sandbox abort:
  `libc++abi: terminating due to uncaught exception of type std::length_error`
  during a packed CLI fixture code chain on Node 24.22.2. No runtime change was
  made or fix claimed. Investigation passed 20 separate fixture chains on Node
  24.19.0, 40 on the exact CI Node 24.22.2, and clean package/ZIP checks on 24.22.2.
  The failed macOS job passed on its single rerun in
  [run 42539925342](https://github.com/itsbrex/GoFi/actions/runs/42539925342).
  The native abort remains an unreproduced dependency/runtime risk.
- Version 1.2.1 corrects the external integration check for MCP's server-prefixed
  `gofi.gofi_jobs_list` name. Both existing UTCP clients accepted both CLI and
  mcp-bootstrap MCP exports and called only the fixture version tool. Fresh
  package/ZIP checks and schemas passed. The mobile runtime is unchanged.
- Account plugin and stable host CLI are now 1.2.1. Account readback preserved
  prompts/private audience and confirmed the corrected check and new tarballs;
  old 1.2.0 tarballs were removed. A remote code chain on the updated host CLI
  still found the same host, one matching verified job and its original finish time.
