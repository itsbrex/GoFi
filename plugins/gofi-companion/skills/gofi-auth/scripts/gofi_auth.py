#!/usr/bin/env python3
"""Private GoFi auth checks: Python stdlib orchestration and the host curl client."""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request

ENDPOINT = "https://www.deezer.com/ajax/gw-light.php"
ARL_LINE = re.compile(r"^\s*(?:export\s+)?DEEZER_ARL\s*=")
ASSIGNMENT = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$")
TOKEN = re.compile(r"[A-Za-z0-9._~+/=-]{100,512}\Z")
AUTH_KEYS = {"DEEZER_ARL", "SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"}
EXIT = {"authenticated": 0, "missing": 10, "invalid": 10, "reauth_required": 10,
        "capability_required": 11, "transport_error": 12, "rate_limited": 13,
        "provider_error": 14, "malformed_response": 14, "configuration_error": 15}


class AuthError(Exception):
    """Only fixed, credential-free messages may cross this boundary."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def literal_value(raw: str) -> str:
    """Parse credentials as data; never evaluate shell or interpolate variables."""
    raw = raw.strip()
    if raw.startswith(("'", '"')):
        quote = raw[0]
        end = raw.find(quote, 1)
        if end < 0 or (raw[end + 1:].strip() and not raw[end + 1:].lstrip().startswith("#")):
            raise AuthError("Credential assignment is not a supported literal.")
        value = raw[1:end]
    else:
        value = re.split(r"\s+#", raw, maxsplit=1)[0].strip()
    if any(c in value for c in ("\n", "\r", "\x00", "`", "$")):
        raise AuthError("Credential assignment must be literal; shell evaluation is disabled.")
    return value


def read_env(path: Path) -> tuple[bytes, dict[str, str]]:
    if path.is_symlink():
        raise AuthError("Refusing a symlinked credential file.")
    if path.exists() and not path.is_file():
        raise AuthError("Credential path must be a regular file.")
    try:
        if path.stat().st_size > 1024 * 1024:
            raise AuthError("Environment file exceeds the size limit.")
        raw = path.read_bytes()
    except FileNotFoundError:
        return b"", {}
    values: dict[str, str] = {}
    for line in raw.decode("utf-8").splitlines():
        match = ASSIGNMENT.match(line)
        if match and match[1] in AUTH_KEYS:
            if match[1] in values:
                raise AuthError("Duplicate credential assignments; file left unchanged.")
            values[match[1]] = literal_value(match[2])
    return raw, values


def credentials(repo: Path, environ=None) -> tuple[bytes, dict[str, str], dict]:
    original, saved = read_env(repo / ".env")
    source = os.environ if environ is None else environ
    env = dict(source)
    for key, value in saved.items():
        env.setdefault(key, value)
    shadowed = "DEEZER_ARL" in source and source.get("DEEZER_ARL") != saved.get("DEEZER_ARL")
    return original, env, {"source": "environment" if "DEEZER_ARL" in source else "repo_env",
                           "environment_overrides_env_file": shadowed}


def boolish(value):
    if value is None:
        return None
    if value is True or value == 1 or value == "1" or value == "true":
        return True
    if value is False or value == 0 or value == "0" or value == "false":
        return False
    return None


def either_option(options, names):
    values = [boolish(options.get(name)) for name in names]
    if True in values:
        return True
    return False if False in values else None


def classify_payload(data):
    if not isinstance(data, dict):
        return {"status": "malformed_response"}
    error = data.get("error")
    if error:
        # Never echo a provider payload; it can contain signed URLs or credentials.
        keys = set(error) if isinstance(error, dict) else set()
        state = "invalid" if "NEED_API_AUTH_REQUIRED" in keys else "provider_error"
        return {"status": state}
    if not isinstance(data.get("results"), dict):
        return {"status": "malformed_response"}
    user = data["results"].get("USER")
    if not isinstance(user, dict):
        return {"status": "malformed_response"}
    user_id = user.get("USER_ID")
    if not str(user_id).isdigit() or int(str(user_id)) <= 0:
        return {"status": "invalid", "reason": "provider_did_not_authenticate_session"}
    options = user.get("OPTIONS")
    if (not isinstance(options, dict) or not isinstance(options.get("license_token"), str)
            or not options["license_token"].strip()):
        return {"status": "provider_error", "reason": "authenticated_session_missing_license"}
    return {"status": "authenticated", "lossless": either_option(options, ("web_lossless", "mobile_loseless", "mobile_lossless")),
            "hq": either_option(options, ("web_hq", "mobile_hq")), "expires_at": "not_exposed"}


def curl_probe(arl, runner=subprocess.run, curl=None):
    """Use the host curl client with a total deadline; secret config travels on stdin."""
    if not isinstance(arl, str) or not TOKEN.fullmatch(arl):
        return {"status": "invalid", "reason": "unsafe_or_incomplete_token_shape"}
    executable = curl or ("/usr/bin/curl" if Path("/usr/bin/curl").is_file() else shutil.which("curl"))
    if not executable:
        return {"status": "configuration_error", "reason": "curl_unavailable"}
    params = urlencode({"method": "deezer.getUserData", "api_version": "1.0", "api_token": "null"})
    command = [executable, "--disable", "--silent", "--show-error", "--connect-timeout", "5",
               "--max-time", "15", "--max-filesize", "2097152", "--proto", "=https",
               "--user-agent", "GoFiCompanion/1.0", "--config", "-", "--write-out", "\n%{http_code}",
               "--url", ENDPOINT + "?" + params]
    try:
        result = runner(command, input='header = "Cookie: arl=' + arl + '"\n',
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=20, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return {"status": "transport_error", "reason": "client_unavailable_or_timeout"}
    if result.returncode:
        reasons = {5: "proxy_resolution", 6: "dns_resolution", 7: "connection_failed", 28: "timeout",
                   35: "tls_handshake", 60: "tls_validation", 63: "response_too_large"}
        return {"status": "transport_error", "reason": reasons.get(result.returncode, "http_client_failed")}
    try:
        body, status_text = result.stdout.rsplit("\n", 1)
        status = int(status_text)
        if status == 401:
            return {"status": "invalid", "http_status": status}
        if status == 429:
            return {"status": "rate_limited", "http_status": status}
        if not 200 <= status < 300:
            return {"status": "provider_error", "http_status": status}
        if len(body.encode("utf-8")) > 2 * 1024 * 1024:
            return {"status": "malformed_response"}
        return classify_payload(json.loads(body))
    except (ValueError, TypeError, UnicodeError):
        return {"status": "malformed_response"}


def probe(arl, opener=None):
    if not arl:
        return {"status": "missing"}
    if not TOKEN.fullmatch(arl):
        return {"status": "invalid", "reason": "unsafe_or_incomplete_token_shape"}
    if opener is None:
        return curl_probe(arl)
    params = urlencode({"method": "deezer.getUserData", "api_version": "1.0", "api_token": "null"})
    req = Request(ENDPOINT + "?" + params, headers={"Cookie": "arl=" + arl,
                  "User-Agent": "GoFiCompanion/1.0", "Accept": "application/json"})
    client = opener
    try:
        with client.open(req, timeout=15) as response:
            raw = response.read(2 * 1024 * 1024 + 1)
        if len(raw) > 2 * 1024 * 1024:
            return {"status": "malformed_response"}
        return classify_payload(json.loads(raw))
    except HTTPError as exc:
        if exc.code == 401:
            return {"status": "invalid", "http_status": 401}
        if exc.code == 429:
            return {"status": "rate_limited", "http_status": 429}
        # 403 may be a policy or entitlement failure, not an expired session.
        return {"status": "provider_error", "http_status": exc.code}
    except (URLError, TimeoutError, OSError):
        return {"status": "transport_error"}
    except (ValueError, TypeError, UnicodeError):
        return {"status": "malformed_response"}


def replace_arl(path: Path, arl: str, expected: bytes):
    if not TOKEN.fullmatch(arl):
        raise AuthError("Replacement token is malformed; file left unchanged.")
    lock = path.with_name(".gofi-companion-auth.lock")
    try:
        lock.mkdir(mode=0o700)
    except FileExistsError:
        raise AuthError("Another credential update holds the lock; file left unchanged.") from None
    tmp = None
    try:
        raw, _ = read_env(path)
        if raw != expected:
            raise AuthError("Environment file changed concurrently; update cancelled.")
        lines = raw.decode("utf-8").splitlines(keepends=True)
        indices = [i for i, line in enumerate(lines) if ARL_LINE.match(line)]
        if len(indices) > 1:
            raise AuthError("Duplicate ARL assignments; file left unchanged.")
        newline = "\r\n" if b"\r\n" in raw else "\n"
        entry = "DEEZER_ARL=" + arl + newline
        if indices:
            lines[indices[0]] = entry
        else:
            if lines and not lines[-1].endswith(("\n", "\r")):
                lines[-1] += newline
            lines.append(entry)
        fd, name = tempfile.mkstemp(prefix=".gofi-companion-", dir=path.parent)
        tmp = Path(name)
        with os.fdopen(fd, "wb") as handle:
            os.fchmod(handle.fileno(), 0o600)
            handle.write("".join(lines).encode("utf-8"))
            handle.flush()
            os.fsync(handle.fileno())
        current, _ = read_env(path)
        if current != expected:
            raise AuthError("Environment file changed concurrently; update cancelled.")
        os.replace(tmp, path)
        tmp = None
    finally:
        if tmp is not None:
            tmp.unlink(missing_ok=True)
        lock.rmdir()


def command_state(binary, arguments, cwd, env, runner=subprocess.run):
    try:
        result = runner([str(binary), *arguments], cwd=cwd, env=env,
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                        timeout=60, check=False)
    except subprocess.TimeoutExpired:
        return {"status": "transport_error", "reason": "command_timed_out"}
    except OSError:
        return {"status": "configuration_error", "reason": "gofi_command_unavailable"}
    if result.returncode == 0:
        return {"status": "authenticated"}
    output = result.stdout.lower()
    if any(x in output for x in ("unknown flag", "unknown command", "missing spotify_client", "must be set")):
        return {"status": "configuration_error", "reason": "gofi_auth_configuration"}
    if any(x in output for x in ("invalid_grant", "no token found", "token file does not exist", "not authenticated")):
        return {"status": "reauth_required"}
    if any(x in output for x in ("timeout", "connection refused", "no such host", "network", "operation not permitted", "socket")):
        return {"status": "transport_error"}
    if any(x in output for x in ("insufficient", "forbidden", "403")):
        return {"status": "capability_required"}
    if any(x in output for x in ("429", "rate limit")):
        return {"status": "rate_limited"}
    return {"status": "reauth_required", "reason": "supported_auth_command_failed"}


def browser_candidate(binary, env, runner=subprocess.run):
    # GoFi writes cwd/.env. Isolate that write, then validate and atomically commit.
    child_env = dict(env)
    child_env.pop("DEEZER_ARL", None)
    with tempfile.TemporaryDirectory(prefix="gofi-session-") as directory:
        state = command_state(binary, ["auth", "deezer", "--force"], Path(directory), child_env, runner)
        if state["status"] != "authenticated":
            return None, state
        _, found = read_env(Path(directory) / ".env")
        candidate = found.get("DEEZER_ARL")
        if not candidate:
            return None, {"status": "reauth_required", "reason": "browser_session_unavailable"}
        return candidate, state


def prepare(repo, *, refresh=False, spotify=False, require_lossless=False,
            environ=None, checker=probe, browser=browser_candidate, runner=subprocess.run):
    repo = Path(repo).expanduser().resolve()
    binary = repo / "gofi"
    if not binary.is_file() or not os.access(binary, os.X_OK):
        raise AuthError("Expected an executable ./gofi in the selected repository.")
    original, env, source = credentials(repo, environ)
    arl = env.get("DEEZER_ARL", "")
    state = checker(arl)
    recovered = "none"
    if refresh and state["status"] in ("missing", "invalid"):
        _, stored = read_env(repo / ".env")
        saved = stored.get("DEEZER_ARL")
        if saved and saved != arl:
            saved_state = checker(saved)
            if saved_state["status"] == "authenticated":
                arl, state, recovered = saved, saved_state, "repo_env"
            elif saved_state["status"] not in ("missing", "invalid"):
                state = saved_state
        if state["status"] in ("missing", "invalid"):
            candidate, recovery_state = browser(binary, env, runner)
            if candidate:
                candidate_state = checker(candidate)
                if candidate_state["status"] == "authenticated":
                    replace_arl(repo / ".env", candidate, original)
                    arl, state, recovered = candidate, candidate_state, "browser_session"
                else:
                    state = candidate_state
            else:
                state = recovery_state
    env["DEEZER_ARL"] = arl
    report = {"deezer": {**state, **source, "recovery": recovered}, "spotify": {"status": "not_requested"}}
    code = EXIT.get(state["status"], 14)
    if code == 0 and require_lossless and state.get("lossless") is not True:
        code = 11
        report["quality"] = {"status": "capability_required", "requested": "FLAC", "available": state.get("lossless")}
    if spotify and code == 0:
        # The supported check may refresh and persist Spotify access tokens.
        report["spotify"] = command_state(binary, ["auth", "spotify", "--check"], repo, env, runner)
        code = EXIT.get(report["spotify"]["status"], 14)
    return report, env, code


def candidates_from_har(path):
    path = Path(path).expanduser()
    if path.is_symlink() or path.stat().st_size > 64 * 1024 * 1024:
        raise AuthError("HAR must be a regular file no larger than 64 MiB.")
    data = json.loads(path.read_bytes())
    if not isinstance(data, dict) or not isinstance(data.get("log"), dict) or not isinstance(data["log"].get("entries"), list):
        raise AuthError("HAR has an invalid log structure.")
    candidates = []
    for entry in data["log"]["entries"]:
        # Only successful first-party responses; never read or replay login request bodies.
        if not isinstance(entry, dict) or not isinstance(entry.get("request"), dict):
            continue
        source_url = entry["request"].get("url")
        if not isinstance(source_url, str):
            continue
        url = urlsplit(source_url)
        response = entry.get("response", {})
        if not isinstance(response, dict) or not isinstance(response.get("status"), int):
            continue
        if (url.scheme != "https" or url.hostname not in {"www.deezer.com", "deezer.com", "auth.deezer.com"}
                or url.username or url.password or not 200 <= response.get("status", 0) < 300):
            continue
        values = []
        content = response.get("content", {})
        if not isinstance(content, dict):
            content = {}
        body = content.get("text", "")
        if isinstance(body, str) and len(body) <= 3 * 1024 * 1024:
            try:
                if content.get("encoding") == "base64":
                    body = base64.b64decode(body, validate=True)
                payload = json.loads(body)
                if isinstance(payload, dict) and isinstance(payload.get("results"), dict):
                    values.append(payload["results"].get("arl"))
            except (ValueError, TypeError, UnicodeError):
                pass
        for cookie in response.get("cookies", []):
            if isinstance(cookie, dict) and cookie.get("name") == "arl":
                values.append(cookie.get("value"))
        for header in response.get("headers", []):
            if isinstance(header, dict) and str(header.get("name", "")).lower() == "set-cookie" and isinstance(header.get("value"), str):
                match = re.match(r"arl=([^;]+)", header.get("value", ""), re.I)
                if match:
                    values.append(match[1])
        for value in values:
            if isinstance(value, str) and TOKEN.fullmatch(value):
                if value in candidates:
                    candidates.remove(value)
                candidates.append(value)
    if not candidates:
        raise AuthError("No eligible ARL found in successful Deezer responses.")
    return list(reversed(candidates))[:3]


def import_har(repo, path, checker=probe):
    original, _ = read_env(repo / ".env")
    state = {"status": "invalid"}
    for candidate in candidates_from_har(path):
        state = checker(candidate)
        if state["status"] == "authenticated":
            replace_arl(repo / ".env", candidate, original)
            return {"deezer": state, "updated": True}, 0
        if state["status"] not in ("invalid", "missing"):
            break
    return {"deezer": state, "updated": False}, EXIT.get(state["status"], 14)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("check", "ensure", "import-har"))
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--spotify", action="store_true", help="Use GoFi's supported Spotify check; it can refresh stored tokens")
    parser.add_argument("--require-lossless", action="store_true")
    parser.add_argument("--har", type=Path, help="Explicitly selected HAR; never copied into the plugin")
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if args.action == "import-har":
            if not args.har:
                parser.error("import-har requires --har")
            report, code = import_har(args.repo.expanduser().resolve(), args.har)
        else:
            report, _, code = prepare(args.repo, refresh=args.action == "ensure", spotify=args.spotify,
                                     require_lossless=args.require_lossless)
        print(json.dumps(report, sort_keys=True))
        return code
    except (AuthError, OSError, ValueError, UnicodeError, TypeError, AttributeError):
        # Do not serialize exception text from credential parsing/network libraries.
        print(json.dumps({"status": "configuration_error", "reason": "Check repository, file permissions, literal credential syntax, and duplicate keys. No secret values logged."}))
        return 15


if __name__ == "__main__":
    sys.exit(main())
