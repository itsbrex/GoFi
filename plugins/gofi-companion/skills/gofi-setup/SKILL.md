---
name: gofi-setup
description: "Use when installing GoFi Companion, moving to a new Mac, or checking whether the current host can run the local GoFi workflow."
---

# Set up GoFi Companion

Use gofi-connect and the bundled host-workspace-operator policy. Discover the existing authorized Mac executor before asking for setup. This plugin supplies skills and local helpers; it does not grant access to a Mac or carry music credentials between devices. Remote Desktop Commander can run the host CLI from a mobile session after the Mac is paired through its official OAuth setup.

1. Discover the user's GoFi checkout. Try `~/github/GoFi` only as a candidate, then verify its instructions, README, executable `./gofi`, build identity, worktree state, and `./gofi download --help`. Follow repository CodeDB rules. Preserve existing edits and binary identity.
2. Check host capabilities: local or authorized remote shell, Node 22 or 24 for code-mode tools, Python 3.10+, curl, network to provider endpoints, `flac` for a full integrity check, and `metaflac` for approved metadata/artwork work. During authorized setup run `npm ci` in this host's installed plugin directory, or install the CLI tarball in a private host prefix, then run `gofi-code-mode-cli connect`. Native dependencies may require C++ build tools. Do not install unrelated software or change another host's cache. On a phone without a connected Mac, follow docs/mobile.md for the exact connection handoff; never claim local execution.
3. Read configuration keys without printing values. GoFi's caller environment wins over current-directory `.env`, then the `.env` beside the resolved binary. Keep credentials in GoFi's existing stores, outside the plugin. Never upload `.env`, browser databases, OAuth tokens, HAR files, account responses, or music in a plugin archive.
4. Discover local and iCloud output roots. Established layout: `~/Music/d-fi-music/FLAC/Tracks` for tracks and `~/Music/d-fi-music/FLAC/Playlist` for collections. Canonical files may live beneath `~/Library/Mobile Documents/com~apple~CloudDocs/Music/d-fi-music/FLAC`. Validate real paths; do not create or replace existing directory symlinks blindly.
5. Read `~/.config/gofi-companion/profile.json` if present. With setup authorization, store non-secret paths using `repo`, `track_output` and `playlist_output`. An `executor` object may retain the verified `device_id`, `host_id`, `node_executable` and `cli` path for reconnection. Preserve other keys. The runtime fixes quality 9 and concurrency 2. Keep any existing canonical FLAC root or finalize-helper preferences for the separate skill workflow. Never persist one-run sharing approval or passwords. Do not overwrite a customized profile without review.
6. Run gofi-auth `ensure --require-lossless`; add `--spotify` when Spotify is needed. This may refresh stored sessions. Report whether authenticated, lossless-capable, refreshable, or blocked. A valid login does not prove the requested FLAC exists.
7. Ordinary downloads must not create schedules, login agents, telemetry, tunnel services, firewall exceptions, or message delivery rules. If the user explicitly requests persistent remote connection setup, use the existing executor's documented startup method with its existing account and access scope. Checks happen before each requested download.

Finish with verified checkout, destinations, auth state, host requirements, and any exact setup gap. Phone installation and Mac execution are distinct proof levels.
