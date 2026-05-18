# GoFi Branch Cleanup and Publish Plan

## Goal

Land the Claude Code setup work plus the `download/download.go` skip-existing-files fix on `origin/main`, and prune stale feature branches. `upstream` (d-fi/GoFi) is read-only — never push to it.

## Current State (verified 2026-05-17)

- Branch: `chore/claude-code-setup`, 2 commits ahead of `main`:
  - `fe386e9` feat(claude): add team-shared Claude Code config
  - `6893a7d` chore: ignore .specstory/ and untrack existing history
- Working tree:
  - `M CLAUDE.md` — reduced to a shim that `@AGENTS.md`s the real doc
  - `M download/download.go` — `os.Lstat` skip-existing logic
  - `M gofi` — rebuilt binary; should NOT be committed
  - `?? AGENTS.md` — new canonical agent doc
  - `?? .claude/plans/` — this plan file
- Remotes: `origin` = itsbrex/GoFi (write), `upstream` = d-fi/GoFi (read-only).
- `feat/concurrent-downloads` and `feat/spotify-integration` are fully merged into `main` (verified via `git log main..<branch>` — empty). Safe to delete.
- `gofi` is gitignored already but still tracked from history; needs `git rm --cached`.

## Execution Order

Each step is independently reversible up to step 6. Stop and reassess if any test fails.

### 1. Untrack the `gofi` binary on a clean tree

The working-tree `M gofi` is a rebuild we don't want. Discard it, then untrack the path in a dedicated commit so the diff is purely a `--cached` removal.

```bash
git checkout -- gofi
git rm --cached gofi
git commit -m "chore: untrack built gofi binary (already gitignored)"
```

### 2. Commit `AGENTS.md` + `CLAUDE.md` shim

These are paired — the shim has no meaning without the new doc.

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs: move agent guide to AGENTS.md, leave CLAUDE.md as shim"
```

### 3. Commit the `download/download.go` skip-existing fix separately

Product behavior change — must not be bundled with tooling/doc commits so it can be reviewed (or reverted) independently.

```bash
git add download/download.go
git commit -m "fix(download): skip existing files via os.Lstat without renaming"
```

### 4. Commit this plan (optional, but tracks the cleanup intent)

```bash
git add .claude/plans/2026-05-17-gofi-branch-cleanup.md
git commit -m "docs: add branch cleanup plan"
```

### 5. Run tests on `chore/claude-code-setup`

```bash
go test ./download
go test ./internal/ui   # may fail on ANSI-stripped output; see Test Plan
go test ./...
```

Decision gate: if `internal/ui` fails for ANSI reasons unrelated to this branch, document and proceed. If `download` fails, fix or revert step 3 before merging.

### 6. Merge into `main` and push to `origin`

```bash
git checkout main
git merge --ff-only chore/claude-code-setup   # fast-forward only; abort if not possible
git push origin main
```

If `--ff-only` rejects (because `origin/main` moved), `git fetch origin && git rebase origin/main` from `chore/claude-code-setup` first, then retry.

### 7. Delete stale feature branches (local + remote on `origin`)

Only after step 6 succeeds.

```bash
# Confirm again that nothing is unmerged
git log main..feat/concurrent-downloads --oneline   # expect empty
git log main..feat/spotify-integration --oneline    # expect empty

git branch -d feat/concurrent-downloads
git branch -d feat/spotify-integration
git push origin --delete feat/concurrent-downloads
git push origin --delete feat/spotify-integration
```

`-d` (not `-D`) is intentional — git refuses if the branch is unmerged, which is the safety net.

## Acceptance Criteria

- `origin/main` contains commits `fe386e9` (Claude config) and `6893a7d` (specstory ignore) plus the new commits from steps 1–4.
- `git ls-files | grep -E '^gofi$'` returns empty.
- `AGENTS.md` exists at repo root; `CLAUDE.md` is a short shim that references it.
- `download/download.go` skips existing regular files, symlinks, and macOS aliases via `os.Lstat` without renaming or touching timestamps.
- `git branch -a` shows no `feat/concurrent-downloads` or `feat/spotify-integration` locally or on `origin`.
- `git remote -v` is unchanged; nothing was pushed to `upstream`.
- `go test ./download` and `go test ./...` (excluding pre-existing `internal/ui` ANSI issue if confirmed unrelated) pass.

## Test Plan

- `go test ./download` — confirms the skip-existing fix doesn't regress download behavior.
- `go test ./internal/ui` — known flaky on ANSI-stripped output capture. If it fails, capture the failure, confirm it reproduces on `main` (i.e., pre-existing), and quarantine rather than block the merge.
- `go test ./...` — full suite sanity check.
- Manual smoke (optional): build via `make build-cli` and confirm `gofi --version` still reports a sensible value.

## Rollback

- Steps 1–4 are local commits; `git reset --hard <previous-sha>` undoes any/all before pushing.
- Step 6 (push): if a problem surfaces, `git push origin <previous-main-sha>:main --force-with-lease` from a worktree that still has the old `main` checked out. Coordinate with anyone else using `origin` first.
- Step 7 (branch deletion): branches deleted on `origin` can be restored from local refs via `git push origin <sha>:refs/heads/<branch-name>` as long as the local ref still exists.

## Guardrails

- Never `git push upstream <anything>`. The only `upstream` operations allowed are `git fetch upstream` and `git merge upstream/main` (per CLAUDE.md fork-update workflow).
- Do not use `-D` (force delete) on feature branches — let git's unmerged check be the safety net.
- Do not amend or rebase commits already on `origin/main`.
- Discard the working-tree `M gofi` rebuild before step 1; do not commit it.
