---
description: Scan the repo for duplicated logic, dead code, and cleanup opportunities. Report only; do not modify.
argument-hint: "[optional path to focus, e.g. 'download/']"
---

Do a read-only tech-debt scan of GoFi. Focus path: $ARGUMENTS (default: whole repo).

Look for:
- Near-duplicate functions across `api/`, `download/`, `metadata/`, `internal/services/spotify/`, `request/`.
- Dead code (unreferenced exported symbols, unused files).
- Stale comments referencing removed features.
- Overlap between `cmd/main.go` (legacy CLI) and `cmd/gofi/cmd/` — flag if legacy code is still reachable but unused.
- Inconsistent error wrapping patterns.
- Hardcoded values that belong in config (quality mappings, cover sizes, concurrency defaults).

Output a ranked punch list (top 10), each entry: file:line, category, one-line impact, estimated effort (S/M/L). Do not write code. End with a suggested "next 30 minutes" action.
