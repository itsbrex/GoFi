# Mobile sessions and the Mac executor

GoFi runs on the connected Mac. The phone is a client: it does not need Node,
the GoFi binary or a copy of music credentials. `gofi-connect` automatically
checks a GoFi MCP connection, then the host CLI through an authorized executor.
It verifies host identity and paths instead of guessing from screen size.

## Connect an existing Mac

Remote Desktop Commander is a supported executor. Use its existing account and
paired device; keep other devices and permissions unchanged. First check whether
the device is already online. If it is offline, its official command is:

```bash
npx --yes @wonderwhy-er/desktop-commander@0.3.1 remote
```

This is the tested version; it needs Node 22.12 or newer. Normal restarts reuse
the saved device session. A new device needs the vendor's browser OAuth pairing:
compare the displayed codes and finish sign-in. Never upload the device session
file, provider tokens or `.env` to the plugin. The agent must remain running on
the Mac; an installed plugin alone does not keep a sleeping/offline Mac reachable.
Persistent startup is a separate, explicitly requested setup action.

In the phone's AI client, connect the existing Remote Desktop Commander account
using its supported connector. For hosts that accept remote MCP configuration,
the official endpoint is `https://mcp.desktopcommander.app/mcp` with OAuth.
The plugin does not silently install a second connector or change its permissions.

[Vendor setup](https://github.com/wonderwhy-er/DesktopCommanderMCP/blob/main/src/remote-device/README.md)
and [device dashboard](https://mcp.desktopcommander.app/) explain pairing and
revocation. Remote commands execute under the Mac user's existing permissions.

## Prepare the CLI on that Mac

Use the packaged CLI tarball from the plugin's tested distributions. With Node
22/24, install into a private prefix or use the prepared plugin directory:

```bash
npm install --prefix "$HOME/.local/share/gofi-companion/host" /absolute/path/itsbrex-gofi-code-mode-cli-1.2.0.tgz
"$HOME/.local/share/gofi-companion/host/node_modules/.bin/gofi-code-mode-cli" connect
```

The Node native build needs the same isolated-vm install-script allowance as the
main plugin. Follow the existing npm policy; do not disable global safeguards.
`connect` is read only. It returns `host_id`, `binary_exists`, executable paths,
destinations, and the selected backend. `client: "cli"` identifies the CLI
entrypoint; `transport` identifies its internal UTCP adapter. Force CLI transport
with `GOFI_UTCP_TRANSPORT=cli` when testing the complete CLI path.

Retain the verified executor device ID, host ID and absolute Node/CLI paths in
the Mac's private GoFi profile. No device ID or personal path belongs in the
distributable package. On mobile, the agent discovers executor tools and runs
this CLI on the paired Mac, not in an unrelated cloud sandbox.

## Reconnect without another download

Before submitting a new request, retain a UUID and the verified `host_id`.
Send them as `request_id` and `expected_host_id`. The request ID becomes the job
ID and is persisted before its detached worker starts. Reusing that ID with the
same request returns the receipt; a different source/output is rejected.

If a response or connection is lost:

1. Finish polling any remote executor `call_id` or process PID already returned.
2. Reconnect to the same Mac and verify its host ID.
3. Read `resume JOB_ID` or `jobs SOURCE_URL`; never invent a replacement request.
4. Reconcile terminal failures and partial files before a deliberately new attempt.

The router falls back only during transport initialization. It never retries a
download, provider sign-in, or other tool call through another transport.
Job receipts survive phone/client restarts. A Mac/worker crash remains a review
state; no startup hook replays interrupted work or removes its lock.

## Physical-phone acceptance

Use an already authorized track. From the phone client, discover the existing
Mac, probe the CLI, submit one request ID, leave/reopen the client, and recover
the same receipt. Confirm one worker and one artifact, then verify recording
identity, full FLAC decode and any scoped iCloud finalization. A desktop relay
test, simulator, or browser viewport is not proof of this physical-phone flow.
