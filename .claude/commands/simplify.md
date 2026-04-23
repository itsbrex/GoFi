---
description: Review recently-changed code for quality, duplication, and idiom compliance, then apply safe simplifications.
argument-hint: "[optional scope, e.g. 'download package only']"
---

Invoke the `code-simplifier` subagent on the current branch diff.

Scope hint from user: $ARGUMENTS

After the subagent finishes, run the `build-validator` subagent to confirm nothing broke. Report both results together.
