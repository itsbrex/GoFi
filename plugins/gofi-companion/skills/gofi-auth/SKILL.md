---
name: gofi-auth
description: "Use before GoFi downloads or when Spotify authorization or Deezer session tokens fail. Check live authentication and account quality separately, then recover through supported stored-token or browser-session flows."
---

# Check and recover authentication

Run gofi-connect first to select the actual GoFi host. On mobile, use that authorized Mac executor; never copy tokens into the phone or a cloud sandbox.

Use `scripts/gofi_auth.py` with Python 3.10+ on the connected GoFi Mac. Commands print credential-free JSON. The host curl client handles live requests with TLS verification, no redirects, no personal curl config, a 15-second total deadline and credential headers passed privately on stdin. Resolve the helper from this installed skill directory; replace REPO with the verified checkout path and quote all paths.

```bash
python3 scripts/gofi_auth.py check --repo REPO
python3 scripts/gofi_auth.py ensure --repo REPO --require-lossless --spotify
```

`check` probes the configured Deezer session without changing it. `ensure` recovers invalid or missing auth from a valid saved value or GoFi's supported browser flow, validates the candidate, then atomically updates only `DEEZER_ARL` with mode 600. The helper isolates GoFi's cwd `.env` write in a private temporary directory. `--spotify` runs `./gofi auth spotify --check`; that check can refresh and persist Spotify access tokens. Omit it for Deezer-only work.

Read JSON, not token length, to determine login validity. Authentication, lossless/HQ capability, requested-track availability, and network access are separate facts. Unknown lossless capability blocks a FLAC-only job pending diagnosis. Do not label a valid but non-lossless account expired.

Recovery rules:

- Only missing or provider-invalid auth permits automatic browser recovery. Prefer the existing supported GoFi `auth deezer --force` flow. It can recover a valid browser session; it cannot mint a replacement for a revoked login. If no session exists, ask the user to sign in to Deezer through the supported browser. Do not automate password collection, CAPTCHA bypass, account switching, or permission expansion.
- Spotify uses its stored OAuth refresh token through GoFi. `invalid_grant` or revoked refresh authorization requires user sign-in. Do not repeatedly retry an expired refresh grant. Do not expand OAuth scopes merely to fix a private playlist.
- Network errors, HTTP 403/429, provider failures, missing license details, and malformed responses do not authorize a refresh loop. Preserve their distinct states. Use the host's supported network authorization controls when needed; never tunnel around policy or disable security controls.
- The shell's old `DEEZER_ARL` can shadow a newly written `.env`. The download wrapper passes the validated value to its child process. If running GoFi manually, use a fresh environment or safely reload only the intended credentials. Never echo values or use token command-line arguments.
- At most one recovery attempt per failing layer after a meaningful change. After a mid-download auth failure, run ensure once and resume only with evidence of changed/renewed authentication. Existing files must be verified before treating a retry as idempotent.

For an explicitly supplied HAR, prefer the bundled importer:

```bash
python3 scripts/gofi_auth.py import-har --repo REPO --har APPROVED_HAR
```

It reads only successful first-party Deezer response tokens, handles base64 bodies, validates the complete token live, and changes `.env` only on success. It never replays login request bodies or logs credentials. Never scan unrelated HARs or browser profiles. A successful import is not proof the provider will accept that session forever.

Exit codes: 0 authenticated; 10 missing/invalid or sign-in required; 11 account capability; 12 transport; 13 rate limit; 14 provider/response; 15 local configuration. Read status fields to distinguish detail. Credentials remain local. No token, HAR, password, or signed media URL belongs in reports, plugin metadata, tests, or source control.

Finish with redacted auth state, recovery method actually used, quality capability, and next required action. Never promise permanent or unattended authentication when the provider requires a new login.
