#!/usr/bin/env python3
"""Verify audio bytes, FLAC integrity, tags, artwork, and canonical symlink targets."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import struct
import subprocess
import sys
from pathlib import Path


def flac_blocks(path):
    with path.open("rb") as stream:
        if stream.read(4) != b"fLaC":
            return None
        result = {"codec": "FLAC", "tags": {}, "picture_blocks": 0}
        total = 0
        for _ in range(256):
            header = stream.read(4)
            if len(header) != 4:
                raise ValueError("Truncated FLAC metadata")
            size = int.from_bytes(header[1:], "big")
            total += size
            if total > 32 * 1024 * 1024:
                raise ValueError("FLAC metadata exceeds limit")
            body = stream.read(size)
            if len(body) != size:
                raise ValueError("Truncated FLAC block")
            kind = header[0] & 127
            if kind == 0:
                if size != 34:
                    raise ValueError("Invalid STREAMINFO")
                packed = int.from_bytes(body[10:18], "big")
                rate = packed >> 44
                samples = packed & ((1 << 36) - 1)
                result.update(sample_rate=rate, channels=((packed >> 41) & 7) + 1,
                              bits_per_sample=((packed >> 36) & 31) + 1, total_samples=samples,
                              duration_seconds=round(samples / rate, 3) if rate else None)
            elif kind == 4:
                cursor = 0
                def number():
                    nonlocal cursor
                    if cursor + 4 > len(body):
                        raise ValueError("Truncated Vorbis comment")
                    value = struct.unpack_from("<I", body, cursor)[0]
                    cursor += 4
                    return value
                cursor = 4 + number()
                count = number()
                if count > 10000:
                    raise ValueError("Too many FLAC comments")
                for _ in range(count):
                    length = number()
                    if cursor + length > len(body):
                        raise ValueError("Truncated Vorbis value")
                    comment = body[cursor:cursor + length].decode("utf-8", errors="replace")
                    cursor += length
                    key, sep, value = comment.partition("=")
                    if sep and key.upper() in {"TITLE", "ARTIST", "ALBUM", "ALBUMARTIST", "ISRC", "TRACKNUMBER", "DATE"}:
                        result["tags"].setdefault(key.upper(), []).append(value)
            elif kind == 6:
                result["picture_blocks"] += 1
            if header[0] & 128:
                if "sample_rate" not in result or not result["sample_rate"] or not result["total_samples"]:
                    raise ValueError("Missing or empty audio stream")
                return result
        raise ValueError("Too many FLAC blocks")


def verify(path, *, decode=True, runner=subprocess.run, which=shutil.which):
    path = Path(path).expanduser().absolute()
    linked = path.is_symlink()
    try:
        canonical = path.resolve(strict=True)
        if not canonical.is_file() or canonical.stat().st_size == 0:
            return {"path": str(path), "status": "missing_or_empty"}
        metadata = flac_blocks(canonical)
        if metadata is None:
            with canonical.open("rb") as stream:
                magic = stream.read(3)
            codec = "MP3" if magic == b"ID3" or (len(magic) >= 2 and magic[0] == 255 and magic[1] & 224 == 224) else "unknown"
            return {"path": str(path), "canonical_path": str(canonical), "status": "not_flac", "codec": codec}
        digest = hashlib.sha256()
        with canonical.open("rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        result = {"path": str(path), "canonical_path": str(canonical), "symlink": linked,
                  "bytes": canonical.stat().st_size, "sha256": digest.hexdigest(), **metadata,
                  "status": "metadata_verified", "decoder_test": "not_run"}
        decoder = which("flac")
        if decode and decoder:
            tested = runner([decoder, "--test", "--silent", str(canonical)], stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, timeout=180, check=False)
            result["decoder_test"] = "passed" if tested.returncode == 0 else "failed"
            result["status"] = "verified" if tested.returncode == 0 else "corrupt_audio"
        elif decode:
            result["decoder_test"] = "unavailable"
        return result
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return {"path": str(path), "status": "verification_failed"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()
    results = [verify(path) for path in args.paths]
    print(json.dumps({"files": results}, indent=2, sort_keys=True))
    return 0 if all(item["status"] == "verified" for item in results) else 1


if __name__ == "__main__":
    sys.exit(main())
