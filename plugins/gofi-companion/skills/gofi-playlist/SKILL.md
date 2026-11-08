---
name: gofi-playlist
description: "Use when downloading a Spotify or Deezer playlist or album with GoFi, maintaining bounded concurrency, per-track results, resumable work and complete collection reconciliation."
---

# Download playlists and albums

Use gofi-setup and gofi-auth first. A playlist is a tracked collection job, not a count of files in a folder.

1. Resolve the exact playlist/album URL, visibility, owner/source, expected item count, destination, quality and duplicate policy. Read metadata with existing authorized provider access. Do not expand private-playlist scopes or invite accounts without approval. Snapshot ordered item IDs, titles, artists, versions and ISRC where available into a private run receipt outside the plugin.
2. Prefer gofi-code-mode's `gofi.download_start({url, output})` and poll the returned job ID with `gofi.job_status({job_id})`. It uses the sibling gofi-track helper with quality 9 and concurrency 2. If MCP is unavailable, call the helper below directly. It validates auth automatically and reports changed files. Existing files and unrelated artist folders are not new successes. Retain the job ID; a request timeout is not permission to replay the collection.

```bash
python3 ../gofi-track/scripts/gofi_run.py 'https://open.spotify.com/playlist/PLAYLIST_ID' --repo REPO --output PLAYLIST_DEST --concurrency 2 --symlink-search-dir ICLOUD_FLAC
```

Resolve this path relative to the installed skill, not arbitrary cwd. Use existing `Playlist` output convention when confirmed; do not invent a renamed `Playlists` directory.

3. For each source item record exactly one status: newly verified FLAC, verified existing/link, unavailable recording/format, account capability denied, auth blocked, transport blocked, or failed. Match recordings, not filenames alone. Preserve playlist ordering and source IDs in the private receipt.
4. Wrapper exit 21 with `needs_collection_reconciliation` intentionally requires this step even when new files decode successfully. Reconcile expected total against all item statuses. Native exit 0 is insufficient; a partial batch is a partial batch.
5. On confirmed mid-batch auth expiry, attempt supported recovery once and resume unresolved items only after validating changed auth. Back off on provider rate limiting. Do not lower quality or change accounts silently. If FLAC unavailable, ask before accepting a different format when necessary.
6. Finalize only verified FLAC files through the inspected existing scoped cloud helper. Verify each canonical path and per-file local link. Avoid broad library moves, overwrites, or hidden whole-folder sharing.
7. If user requests a share, establish whether selected files or one collection folder is intended, then use gofi-icloud-link. Never share the entire Tracks/Playlist library by default.

Finish with expected/new/reused/failed/pending counts that reconcile, exact output location, failure reasons and retry scope, and only observed share URLs. If metadata access prevents enumeration, mark completeness unverified and state the access gap.
