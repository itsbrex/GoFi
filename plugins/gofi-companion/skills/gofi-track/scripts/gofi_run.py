#!/usr/bin/env python3
"""Run GoFi with auth preflight; report new artifacts without claiming skipped files."""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

sys.dont_write_bytecode = True
SKILLS = Path(__file__).resolve().parents[2]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


auth = module("gofi_auth", SKILLS / "gofi-auth/scripts/gofi_auth.py")
audio = module("verify_audio", SKILLS / "gofi-verify-library/scripts/verify_audio.py")


def parse_url(value):
    parsed = urlsplit(value)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Use an HTTPS Spotify or Deezer URL without credentials.")
    if parsed.hostname == "open.spotify.com":
        match = re.fullmatch(r"/(?:intl-[a-z]{2}/)?(track|album|playlist)/([A-Za-z0-9]+)", parsed.path)
        service = "spotify"
    elif parsed.hostname in ("www.deezer.com", "deezer.com"):
        match = re.fullmatch(r"/(?:[a-z]{2}/)?(track|album|playlist)/(\d+)", parsed.path)
        service = "deezer"
    else:
        match, service = None, None
    if not match:
        raise ValueError("Unsupported source URL.")
    # Tracking parameters are unnecessary for GoFi; keep credentials out of URLs.
    return service, match[1], f"https://{parsed.hostname}{parsed.path}"


def snapshot(root):
    result = {}
    if root.exists():
        for path in root.rglob("*"):
            if path.suffix.lower() not in (".flac", ".mp3"):
                continue
            try:
                info = path.lstat()
                result[str(path)] = (info.st_size, info.st_mtime_ns, os.readlink(path) if path.is_symlink() else "")
            except OSError:
                continue
    return result


def run_download(repo, url, output, *, concurrency=2, search_dirs=(), prepare=auth.prepare,
                 runner=subprocess.run, verifier=audio.verify):
    service, kind, normalized = parse_url(url)
    repo, output = Path(repo).expanduser().resolve(), Path(output).expanduser().absolute()
    if concurrency not in range(1, 11):
        raise ValueError("Concurrency must be from 1 to 10.")
    report, env, code = prepare(repo, refresh=True, spotify=service == "spotify", require_lossless=True)
    if code:
        return {"status": "preflight_blocked", "auth": report}, code
    output.mkdir(parents=True, exist_ok=True)
    before = snapshot(output)
    command = [str(repo / "gofi"), "download", normalized, "-q", "9", "-c", str(concurrency), "-o", str(output)]
    for directory in search_dirs:
        command.extend(["--symlink-search-dir", str(Path(directory).expanduser().absolute())])
    try:
        completed = runner(command, cwd=repo, env=env, stdout=subprocess.PIPE,
                           stderr=subprocess.STDOUT, text=True, timeout=7200, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return {"status": "download_interrupted", "auth": report,
                "reason": "Inspect partial files before a bounded retry."}, 20
    after = snapshot(output)
    changed = [Path(path) for path in sorted(after) if after[path] != before.get(path)]
    files = [verifier(path) for path in changed]
    success = completed.returncode == 0 and files and all(f["status"] == "verified" for f in files)
    status = "verified_new_files" if success else "needs_review"
    if kind in ("playlist", "album") and success:
        status = "needs_collection_reconciliation"
    # Raw GoFi output is deliberately not emitted; it may contain provider data.
    lower = completed.stdout.lower()
    warnings = []
    for pattern, label in (("formatunavailable", "format_unavailable"), ("wronglicense", "account_capability"),
                           ("need_api_auth_required", "authentication_expired_during_run"),
                           ("fallback", "quality_fallback_reported"), ("failed", "gofi_reported_failure")):
        if pattern in lower:
            warnings.append(label)
    if warnings:
        status = "needs_review"
    return {"status": status, "source": normalized, "kind": kind, "requested_quality": 9,
            "gofi_exit_code": completed.returncode, "auth": report, "files": files,
            "warnings": warnings, "existing_files_counted_as_new": False,
            "collection_complete": False if kind != "track" else None}, 0 if status == "verified_new_files" else 21


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--concurrency", type=int, default=2)
    parser.add_argument("--symlink-search-dir", action="append", default=[])
    args = parser.parse_args()
    os.umask(0o077)
    try:
        report, code = run_download(args.repo, args.url, args.output, concurrency=args.concurrency,
                                    search_dirs=args.symlink_search_dir)
    except (auth.AuthError, ValueError, OSError):
        report, code = {"status": "configuration_error", "reason": "Check explicit repository, output, URL and credential configuration."}, 15
    print(json.dumps(report, indent=2, sort_keys=True))
    return code


if __name__ == "__main__":
    sys.exit(main())
