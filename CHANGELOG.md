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
- **Symlink-existing-tracks support** — recursive duplicate lookup across configured output roots, creating a symlink instead of re-downloading. Controlled by `GOFI_SYMLINK_EXISTING_TRACKS` and `GOFI_SYMLINK_SEARCH_DIRS`.
- **Per-content-type output directories** via `GOFI_TRACK_OUTPUT_DIR`, `GOFI_ALBUM_OUTPUT_DIR`, and `GOFI_PLAYLIST_OUTPUT_DIR`.
- **Merged upstream `d-fi/GoFi` through v2.3.4**, bringing in the `converter/` package (Spotify/Tidal/YouTube), the `internal/dfi/` application layer, the `internal/web/` web UI, the `cmd/d-fi` entrypoint, and release packaging (`make pkg` / `make verify-pkg`). See the upstream release history below.

### Changed

- **Skip-existing logic in `download/download.go`** now uses `os.Lstat` and returns immediately when a target file exists (regular file, symlink, or macOS alias). Previous behavior renamed ID-based files to the new naming scheme and updated timestamps; that churn is gone — existing files are left untouched.
- **Test suite** no longer requires `DEEZER_ARL` in the environment. Tests look up the ARL from env, then from browser cookies, and skip gracefully when nothing is available.
- **Project documentation** consolidated into `AGENTS.md` (previously in `CLAUDE.md`). Covers build/install commands, code architecture, data flow, configuration, and conventions.

### Removed

- **Built `gofi` binary** is no longer tracked in git. It was already in `.gitignore`; `git rm --cached gofi` makes that effective.
- **`feat/concurrent-downloads`** and **`feat/spotify-integration`** branches (local and on `origin`). Their commits are already part of `main`; SHAs `095b590` and `0129ddc` remain reachable through `main`'s history.
- **Legacy `cmd/main.go` CLI** — removed upstream in favor of `cmd/d-fi`. `make build` now builds `./cmd/d-fi`; `make build-cli` continues to build the Cobra CLI at `./cmd/gofi`.

### Fixed

- **`download/download.go` timestamp side effects** — the old skip-existing path called `os.Chtimes` on every cache hit, modifying access/modification times even when no work was done. Now a hit returns the path with no side effects.
- **Race condition** in the Deezer API client during parallel downloads, via mutex-guarded session initialization.
- **Deezer ARL token extraction** — strips a leading `W` character that some browsers prefix to the cookie value.

### Notes

- `metadata.TestDownloadAlbumCover` reaches out to the live Deezer CDN and fails in sandboxed/offline environments (`dial tcp ... bad file descriptor`). The failure is pre-existing and environmental, not a code regression.
- `make install-dev` creates a symlink from `$PREFIX/bin/gofi` (default `/usr/local/bin/gofi`) to the repo binary. Re-running `make build-cli` after that updates the global binary automatically — no re-install needed.

---

## Upstream release history (d-fi/GoFi)

Releases inherited from the upstream project, merged into this fork through v2.3.4.

## 2.3.4 - 2026-06-23

This release fixes quality fallback during downloads and updates Go module dependencies.

### Changed

- Updated `golang.org/x/crypto` and `golang.org/x/text`.

### Fixed

- Fixed `fallbackQuality` not retrying at a lower bitrate when URL resolution or the download itself failed with an error. FLAC and MP3 320 requests now correctly fall back to MP3 320 and MP3 128 when higher qualities are unreachable.

## 2.3.3 - 2026-06-02

This release is a small stability and polish update for the CLI and web UI. It fixes a Deezer authentication panic reported on Windows, smooths progress refresh behavior, and improves how the web interface remembers and orders download state.

### Changed

- Web download quality is now remembered in the browser, so the last selected quality is restored when reopening the web UI.
- Web download history is now returned in a stable order: active jobs first, then most recently updated jobs.
- CLI and web progress updates are now aligned to a 1 second interval for a more consistent download experience.

### Fixed

- Fixed a panic when Deezer returns nullable stream capability flags during download URL authentication.
- Deezer download authentication data is now cached safely across concurrent download workers.

## 2.3.2 - 2026-05-31

This release continues the 2.3.x follow-up work around save layouts, release dates, cover artwork, and web UI polish.

### Changed

- Aligned metadata release-date tagging with save layout release-date selection.
- Metadata tags now prefer richer album dates when available, including original and physical release dates, before falling back to Deezer's public album release date.
- The web layout Fields modal now shows sample values for common fields when a preview is loaded.
- Shared struct-to-map conversion is now centralized in `utils`.

### Fixed

- Fixed separate cover-file placement for single-disc albums when the save layout contains `{DISK_FOLDER}`. Covers now stay inside the album folder instead of moving up to the artist folder.
- Fixed public Deezer API HTTP errors being cached as valid responses.
- Fixed failed Deezer cover CDN responses being cached or saved as artwork.
- Added `ORIGINAL_RELEASE_DATE` decoding from Deezer album data so release date fields can use it when Deezer provides it.

## 2.3.1 - 2026-05-30

This release is a focused follow-up to 2.3.0. It improves compatibility with current Deezer links and playlist responses, adds more flexible save layouts for multi-disc albums, and tightens cover artwork handling in the CLI and web UI.

### Added

- Added support for modern Deezer share links such as `https://link.deezer.com/s/...`.
- Added fallback save layout placeholders using `{FIRST|SECOND|THIRD}` syntax.
- Added opt-in multi-disc folder layouts with `{DISK_FOLDER}` and `{DISK_NUMBER}`.
- Added support for custom cover sizes between `50` and `1800`.
- Added web handling for custom saved cover sizes, shown as custom dropdown options.

### Changed

- Kept the existing default multi-disc album behavior unchanged unless `{DISK_FOLDER}` is used in the save layout.
- Changed separate cover-file saving for `{DISK_FOLDER}` layouts so one cover file is saved at the album root instead of once per disc folder.
- Improved release date placeholder fallback behavior for layouts.
- Improved web preview behavior by removing redundant success toasts when tracks are already shown in the preview table.
- Improved release package checks so package contents are verified after `make pkg`.

### Fixed

- Fixed Deezer playlist decoding when `ALB_ID`, `ART_ID`, `SNG_ID`, and related IDs are returned as numbers instead of strings.
- Fixed request cache collisions by including request params in cache keys.
- Fixed cover size validation so web-selected high-resolution values like `1200` and `1400` do not fail during download.
- Fixed invalid manual cover sizes so out-of-range values fall back to the existing/default value instead of being saved.
- Fixed layout placeholder parsing for fallback placeholders and disc-folder detection.

## 2.3.0 - 2026-05-29

This release focuses on the web UI, Spotify conversion reliability, cover artwork handling, and release packaging.

### Added

- Added Linux ARM64, macOS ARM64, and Windows ARM64 release packages.
- Added a dark/light theme switch to the web UI, saved locally in the browser.
- Added explicit Save buttons for each web settings section.
- Added a collapsible Deezer ARL section in the web UI.
- Added a CLI-style track range selector to the web preview table.
- Added a web layout fields reference modal for save layout placeholders.
- Added configurable cover artwork behavior:
  - embed artwork in tracks
  - save artwork as a separate file
  - embed and save artwork
  - disable artwork
- Added configurable cover file names.
- Added release date layout placeholders including release date and release year.
- Added Spotify partner playlist fallback for playlist conversion.
- Added Spotify metadata matching fallback when ISRC matching is unavailable.

### Changed

- Improved Spotify playlist conversion and matching against Deezer.
- Switched Spotify matching to authenticated Deezer search.
- Tuned request retry behavior and converter concurrency.
- Improved Spotify match safety by rejecting mismatched featured artists and requiring the primary artist to match.
- Improved web preview flow so the Preview button sits beside the query input and Enter starts preview.
- Changed cover size inputs in the web UI to selectors with known working sizes.
- Disabled cover filename input when the selected cover mode does not write a separate file.
- Split the web UI into dedicated HTML, CSS, and JavaScript assets.
- Cleaned up web internals and removed stale request fields and handlers.
- Simplified cover metadata APIs and cover config normalization.
- Improved disabled field styling in the web UI.

### Fixed

- Fixed search result decoding when Deezer returns string booleans.
- Fixed Spotify matching edge cases around featured artists and version conflicts.
- Fixed release year parsing to use safer string splitting.
- Fixed stale/unnecessary web code after UI changes.

### Notes

- Existing package names remain for amd64 users:
  - `d-fi-linux.zip`
  - `d-fi-macos.zip`
  - `d-fi-win.zip`
- New ARM64 packages are:
  - `d-fi-linux-arm64.zip`
  - `d-fi-macos-arm64.zip`
  - `d-fi-win-arm64.zip`

[Unreleased]: https://github.com/itsbrex/GoFi/commits/main
