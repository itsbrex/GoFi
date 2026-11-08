---
name: gofi-setup
description: "Use when installing GoFi Companion, moving to a new Mac, or checking whether the current host can run the local GoFi workflow."
---

# Set up GoFi Companion

Use the bundled host-workspace-operator policy. This plugin supplies skills and local helpers; it does not grant access to a Mac, install GoFi, create a remote execution server, or carry music credentials between devices.

1. Discover the user's GoFi checkout. Try `~/github/GoFi` only as a candidate, then verify its instructions, README, executable `./gofi`, build identity, worktree state, and `./gofi download --help`. Follow repository CodeDB rules. Preserve existing edits and binary identity.
2. Check host capabilities: local shell, Node 22 or 24 for code-mode tools, Python 3.10+, curl, network to provider endpoints, `flac` for a full integrity check, and `metaflac` for approved metadata/artwork work. During authorized setup run `npm ci` in this host's installed plugin directory, then reconnect MCP and use gofi-code-mode to inspect `gofi.status`. Native dependencies may require C++ build tools. Do not install unrelated software or change another host's cache. On a phone without a connected Mac, provide a concrete handoff; never claim local execution.
3. Read configuration keys without printing values. GoFi's caller environment wins over current-directory `.env`, then the `.env` beside the resolved binary. Keep credentials in GoFi's existing stores, outside the plugin. Never upload `.env`, browser databases, OAuth tokens, HAR files, account responses, or music in a plugin archive.
4. Discover local and iCloud output roots. Established layout: `~/Music/d-fi-music/FLAC/Tracks` for tracks and `~/Music/d-fi-music/FLAC/Playlist` for collections. Canonical files may live beneath `~/Library/Mobile Documents/com~apple~CloudDocs/Music/d-fi-music/FLAC`. Validate real paths; do not create or replace existing directory symlinks blindly.
5. Read `~/.config/gofi-companion/profile.json` if present. With setup authorization, store non-secret paths using `repo`, `track_output` and `playlist_output`. The runtime fixes quality 9 and concurrency 2. Keep any existing canonical FLAC root or finalize-helper preferences for the separate skill workflow. Never persist one-run sharing approval or passwords. Do not overwrite a customized profile without review.
6. Run gofi-auth `ensure --require-lossless`; add `--spotify` when Spotify is needed. This may refresh stored sessions. Report whether authenticated, lossless-capable, refreshable, or blocked. A valid login does not prove the requested FLAC exists.
7. On this host, do not create schedules, login agents, telemetry, tunnel services, firewall exceptions, or message delivery rules. Checks happen before each requested download.

Finish with verified checkout, destinations, auth state, host requirements, and any exact setup gap. Phone installation and Mac execution are distinct proof levels.
