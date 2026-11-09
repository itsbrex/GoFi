---
name: gofi-connect
description: "Use automatically before every GoFi operation, on desktop or mobile, and after reconnecting. Discover a working GoFi MCP connection or run the code-mode CLI on the user's connected Mac. Recover existing jobs without duplicate downloads."
---

# Connect to GoFi

Choose by verified capabilities, never by device name, user-agent, screen size,
or whether the conversation is on a phone. A phone or cloud sandbox is not the
Mac holding the user's GoFi checkout, credentials, job receipts and music.
Run these read-only checks automatically; do not ask the user to choose MCP
versus CLI. Ask only if multiple reachable machines remain ambiguous.

## Find a working route

1. Discover the actual tools available in this session. Prefer the GoFi MCP
   connection: inspect its schemas, then call `gofi.status({})`. A connection is
   usable when `binary_exists` is true and `host_id` matches the host retained
   for this workflow. Version 1.2 adds `host_id`, `request_id` and `jobs_list`;
   use the updated host CLI if an old MCP connection lacks these fields.
2. If GoFi MCP is absent or its **read-only connection probe** cannot complete,
   look for local shell execution or an already authorized remote Mac executor.
   Run the installed `gofi-code-mode-cli connect` with Node 22 or 24. Verify its
   `host_id`, `repo`, `binary_exists` and destinations before selecting it.
   A sandbox without the configured GoFi checkout does not pass this check.
3. With Remote Desktop Commander, discover `list_devices` and `start_process`
   through the host's tool inventory, then list devices. Select the retained
   `executor.device_id`, or the sole online Mac whose CLI probe succeeds.
   Use the exact discovered device ID on every call. Never switch to another
   user's or an unverified machine after a disconnect. An offline device is
   not permission to enroll a new account or change remote access settings.
4. Use the selected executor's file tools to read the private GoFi profile
   after discovering its home directory. `executor.node_executable` and
   `executor.cli` may provide absolute executable paths. Otherwise discover
   the installed package or plugin on that host; do not assume a versioned
   cache path or reuse this chat's sandbox path on the remote Mac.
5. If neither route works, give the precise next step: reconnect the existing
   Mac device, complete its provider sign-in, or install the host CLI during
   authorized setup. Keep credentials on the Mac. Never claim an install or
   an online device proves the GoFi binary, job store or iCloud folder works.

Remote Desktop Commander command calls can return a `call_id` or process PID.
Poll `get_tool_result` for a pending call, or `read_process_output` for that
process on the same device. Never resubmit an uncertain command. Quote every
path and JSON argument as data. Commands must stay within the user's requested
GoFi operation; this skill does not grant general remote administration.

## Keep reconnects safe

- Retain the chosen host/device and one UUID `request_id` **before** submitting
  `download_start`. Generate it on the connected host with Node's
  `crypto.randomUUID()`, and retain it in conversation state.
- Send `{url, request_id, expected_host_id}` with the verified host ID. Output
  is optional and defaults to that host's configured Tracks/Playlist path.
- `job_id` equals `request_id`. Poll `job_status`; a timeout or disconnected
  phone never means the download failed or should be restarted.
- On reconnect, probe the same host, then read `job_status` using the retained
  ID. If the response containing the ID was lost, use `jobs_list({source: URL})`
  and reconcile existing receipts. Multiple matching jobs require choosing
  the intended receipt, not creating another request.
- Repeating the exact same `request_id` and request returns its existing
  receipt, including terminal failures. Changing its URL/output is rejected.
  A deliberate new attempt needs a new ID only after the prior result and
  partial files have been reviewed. Never remove a lock automatically.
- Runtime `auto` transport tries native MCP discovery, then CLI discovery.
  It switches only while opening a client. Auth errors, unavailable formats,
  download errors and lost write responses are never transport-fallback triggers.

CLI equivalents:

```bash
gofi-code-mode-cli connect
gofi-code-mode-cli jobs 'https://open.spotify.com/track/TRACK_ID'
gofi-code-mode-cli resume JOB_ID
```

These inspect state only. Continue through gofi-track/gofi-playlist for actual
download acceptance, file identity, full decoding and any scoped cloud work.
Report the selected route and host readiness. Distinguish a remote relay test
from a test actually performed through a physical phone client.
