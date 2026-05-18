# Changelog

All notable changes to GoFi are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project aims for [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Until a `v0.1.0` tag is cut, everything lives under [Unreleased].

## [Unreleased]

### Added

- **AGENTS.md** as the canonical agent guide; `CLAUDE.md` reduced to a `@AGENTS.md` shim so Claude Code's auto-discovery still works while making the doc agent-agnostic (Codex, Cursor, etc.).
- **Cleanup plan** at `.claude/plans/2026-05-17-gofi-branch-cleanup.md` documenting the repo hygiene workflow used for the May 2026 cleanup batch.
- **Spotify integration** — OAuth2 flow, URL parsing for tracks/albums/playlists, and Spotify→Deezer content matching so Spotify URLs download via the Deezer pipeline. Tokens stored at `~/.config/gofi/spotify_token.json`.
- **Automatic Deezer ARL authentication** — extracts the ARL token from local browser cookies (Chrome, Firefox, Safari, Edge, Arc). No more manual `DEEZER_ARL` environment variable.
- **Concurrent downloads** for albums and playlists, configurable 1–10 threads via `-c` / `GOFI_CONCURRENCY` (default 5). Thread-safe Deezer API client with mutex-guarded initialization.
- **mpb v8 progress bars** — multi-progress bar display where each concurrent download gets its own fixed line (no overlapping output), with percentage / size / speed / ETA. Bars are created dynamically as downloads start.
- **Beautiful CLI** built on Cobra: colored output via `fatih/color`, automatic URL detection (Spotify vs. Deezer), and improved error messages.
- **Configuration via environment variables**: `GOFI_OUTPUT_DIR`, `GOFI_QUALITY`, `GOFI_CONCURRENCY`, `GOFI_LOG_LEVEL`. Precedence: CLI flags > env vars > defaults.
- **One-line installers** at `scripts/install.sh` (macOS/Linux) and `scripts/install.ps1` (Windows) with OS/arch detection and PATH management.
- **GitHub Actions release workflow** that builds macOS (Intel + Apple Silicon), Linux (amd64 + arm64), and Windows (amd64) binaries on version tags, with `-X cmd.version` injection from `git describe`.
- **`auth deezer` and `auth spotify` subcommands** for explicit authentication flows.

### Changed

- **Skip-existing logic in `download/download.go`** now uses `os.Lstat` and returns immediately when a target file exists (regular file, symlink, or macOS alias). Previous behavior renamed ID-based files to the new naming scheme and updated timestamps; that churn is gone — existing files are left untouched.
- **Test suite** no longer requires `DEEZER_ARL` in the environment. Tests look up the ARL from env, then from browser cookies, and skip gracefully when nothing is available.
- **Project documentation** consolidated into `AGENTS.md` (previously in `CLAUDE.md`). Covers build/install commands, code architecture, data flow, configuration, and conventions.

### Removed

- **Built `gofi` binary** is no longer tracked in git. It was already in `.gitignore`; `git rm --cached gofi` makes that effective.
- **`feat/concurrent-downloads`** and **`feat/spotify-integration`** branches (local and on `origin`). Their commits are already part of `main`; SHAs `095b590` and `0129ddc` remain reachable through `main`'s history.

### Fixed

- **`download/download.go` timestamp side effects** — the old skip-existing path called `os.Chtimes` on every cache hit, modifying access/modification times even when no work was done. Now a hit returns the path with no side effects.
- **Race condition** in the Deezer API client during parallel downloads, via mutex-guarded session initialization.
- **Deezer ARL token extraction** — strips a leading `W` character that some browsers prefix to the cookie value.

### Notes

- `metadata.TestDownloadAlbumCover` reaches out to the live Deezer CDN and fails in sandboxed/offline environments (`dial tcp ... bad file descriptor`). The failure is pre-existing and environmental, not a code regression.
- `make install-dev` creates a symlink from `$PREFIX/bin/gofi` (default `/usr/local/bin/gofi`) to the repo binary. Re-running `make build-cli` after that updates the global binary automatically — no re-install needed.

[Unreleased]: https://github.com/itsbrex/GoFi/commits/main
