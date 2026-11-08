---
name: gofi-verify-library
description: "Use to prove a GoFi download is a complete FLAC, verify metadata and cover art, or finalize selected verified files into an established iCloud library with local symlinks."
---

# Verify files and established library sync

Run `scripts/verify_audio.py` with explicit selected paths. It reads the FLAC stream header, tags, picture-block count, SHA-256, canonical path and symlink state, then runs `flac --test --silent` when available.

```bash
python3 scripts/verify_audio.py 'EXACT_FILE'
```

`verified` requires full decoder success. `metadata_verified` alone is a limited check. A .flac extension, a FLAC folder, a progress bar, exit 0, or successful Spotify match does not prove a complete FLAC. Check expected title/artist/version/ISRC and sensible duration. Verify requested cover art exists; report absence. Do not rewrite metadata/artwork unless requested. If needed, use the established `metaflac` tool and quality-9 cover-size convention from the checkout.

For iCloud finalization:

1. Read the existing GoFi/Alfred cloud helper and configuration. Resolve exact local and canonical roots. Keep any helper path in local profile only. Inspect for Messages, sharing, copy/delete, conflict, and bulk traversal side effects.
2. Use the helper's documented dry-run mode with only selected verified files and fail-on-conflict behavior. Review proposed changes. Local canonical storage plus per-file absolute symlinks is the recorded design; do not replace entire library directories.
3. If within the requested download/sync scope, execute the same narrow finalize action. Do not run Message delivery or link-creation helpers without corresponding authorization.
4. Re-run verification on local link and canonical file. Compare pre/post SHA-256, actual target, bytes and tags. Existing canonical conflicts remain intact. If both files differ, stop before overwrite.
5. Local canonical file proof is separate from iCloud upload completion. Inspect Finder/provider status before claiming uploaded. Do not evict local originals or alter storage settings.

Finish with each exact canonical path, local link target, actual codec, decoder result, tags/artwork presence, hash comparison, and local-versus-cloud proof level.
