---
description: Pre-ship workflow — review, verify, then (on green) commit + push + open PR.
argument-hint: "[PR title — optional, will be generated if omitted]"
---

Ship the current branch.

1. Run the `code-reviewer` subagent. If it reports **Blockers**, STOP and surface them to the user. Do not commit.
2. Run the `build-validator` subagent. If BUILD/VET/TESTS is `fail`, STOP and surface failures.
3. If both are green:
   - Summarize the diff in one sentence.
   - Run `git add -A` on tracked changes only (never `.env`, `d-fi.config.json`, or `*_token.json`).
   - Create a commit following the repo's existing style (see `git log --oneline -20`).
   - Push to origin.
   - Open a PR with `gh pr create`. Title from $ARGUMENTS if provided, else generate one.
4. Return the PR URL.

Never use `--force` or `--no-verify`. If a hook fails, stop and report.
