---
name: gofi-track
description: "Use when downloading one Spotify or Deezer track through an existing local GoFi checkout, with auth preflight, true FLAC verification, established destination and optional iCloud finalization."
---

# Download one track

1. Run gofi-connect automatically, then use gofi-setup's discovered profile and current repository instructions. Confirm the exact URL, intended recording, requested format, and destination. Defaults for this workflow are quality 9, local Tracks, canonical iCloud FLAC storage, and a per-file local absolute symlink. No implicit sharing or Messages delivery.
2. Use gofi-code-mode through the chosen MCP connection or host CLI. Retain one UUID and start `gofi.download_start({url, output, request_id, expected_host_id})`, then poll `gofi.job_status({job_id})` on the same host. It runs this skill's helper with auth preflight and audio verification. Never create a new request because a tool call timed out; recover its receipt with job_status/jobs_list. Use `scripts/gofi_run.py` directly only when code-mode is unavailable and local execution remains verified; it has no durable code-mode job receipt. Both paths are FLAC-only at the acceptance boundary; an MP3 fallback is reported for review and never relabeled FLAC.

```bash
python3 scripts/gofi_run.py 'https://open.spotify.com/track/TRACK_ID' --repo REPO --output TRACKS --symlink-search-dir ICLOUD_FLAC
```

3. The wrapper uses the verified repo `./gofi`, quality 9, and concurrency 2. It captures raw provider output privately in memory and emits only structured auth/results. Never add undocumented strict-quality flags; inspect current CLI help first. Existing GoFi builds may still download a lower format. Such a file does not satisfy this request.
4. Check title, artist, version, duration and ISRC against requested recording. A Spotify match alone is insufficient. Use gofi-verify-library for full decode, metadata, artwork and symlink evidence. If the wrapper reports no new files, inspect the exact existing file; report reused versus downloaded honestly.
5. Use the verified existing cloud-finalize helper only after a scoped dry run. Read it first, retain fail-on-conflict behavior, move only newly verified FLAC files, and verify canonical/local hashes afterward. Do not run the whole Alfred workflow if it also sends Messages or creates public links. When no helper exists, leave verified file in the stated output and report sync as pending; do not invent helper flags.
6. If sharing was requested, invoke gofi-icloud-link with exact file scope. User approval for a file is never approval for its parent library.

On failure use gofi-diagnose. Do not retry unchanged network/license/catalog failures. Exit 21 means artifact or collection review is required, not completed success. Preserve partial/fallback artifacts and unrelated library files. Remove only task-owned temporary instrumentation.

Finish with source URL, matched recording, actual format/quality, exact canonical file and local link, verification results, and requested share link or precise blocker.
