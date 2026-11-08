---
name: gofi-diagnose
description: "Use for GoFi failures involving stale auth, WrongLicense, FormatUnavailable, Spotify matching, network policy, misleading legacy CDN errors, or regression coverage for an authorized fix."
---

# Diagnose GoFi downloads

Reproduce the same request and locate the earliest failing layer. Use host-workspace-operator. Read checkout instructions, build identity, configuration precedence, existing changes, relevant source and tests. Use CodeDB first where required. Do not rebuild/replace a watched binary or alter firewall rules merely to test a guess.

Record exact executable, command, URL, matched Deezer ID, title/version/ISRC, requested quality, output and first error. Preserve secrets; log sanitized shapes only. Prefer one approved track in a fresh output directory so a skip cannot masquerade as a new download.

| Evidence | Classification |
| --- | --- |
| Spotify OAuth/metadata fails before matching | Spotify auth, scope or transport; inspect supported check |
| Deezer live response lacks authenticated user, or NEED_API_AUTH_REQUIRED | Invalid/stale session; gofi-auth recovery |
| Authenticated account lacks lossless/HQ; WrongLicense | Account capability; not automatically expired auth |
| Successful requested-format response has empty media | FormatUnavailable; catalog/media availability |
| Primary geo/license error then legacy CDN DNS failure | Preserve primary provider error |
| Timeout, policy block, bad file descriptor, socket not connected | Transport; does not test catalog/auth repair |
| MP3 bytes under a .flac name | Resolved-quality contract failure |

Do not infer validity from token length. Complete HAR response token can differ from a pasted/truncated value. Read approved HAR through the importer, validate live, and never replay its password-bearing request.

For an authorized code fix, add a provider-shaped regression at the public seam before the smallest production change. Preserve typed FormatUnavailable; `9 -> 3 -> 1` fallback only for typed availability/license errors when fallback is permitted. Use `errors.As` for wrapped errors. Keep cancellation, transport, malformed data and geo errors distinct. Propagate resolved quality to extension and tagging; MP3 cannot become FLAC by renaming. Respect strict requested quality. Check file, buffer, no-metadata and d-fi caller policies separately.

Regression fixtures should cover empty media, boolean/null/string account options, wrapped typed errors, primary-error preservation, full requested-format output, auth expiry, and no fallback for unrelated failures. Set both lossless/HQ capabilities when testing degradation so fixtures do not introduce a false license failure.

Run narrow tests, then repository full tests and `go vet ./...` for download-code changes. Test initialization may access real sessions even when bodies use fixtures; inspect it first. Preserve untouched WIP. After every repo edit follow its CodeDB refresh gate. No commit, push, release or shared-infrastructure change unless authorized.

Live re-test only the authorized target after a meaningful change. Full test success, a rebuilt binary, firewall acceptance, auth health and completed FLAC are separate evidence. Stop repeated unchanged failures. Report reproducer, proven cause versus hypotheses, changes/tests, live outcome, exact blocker and remaining proof gap.
