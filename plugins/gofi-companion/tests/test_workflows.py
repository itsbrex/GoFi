"""Offline regressions at provider/file/process boundaries. No real credentials."""
import base64
import importlib.util
import json
import os
import stat
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, Mock
from urllib.error import HTTPError, URLError

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


auth = load("test_auth_module", "skills/gofi-auth/scripts/gofi_auth.py")
audio = load("test_audio_module", "skills/gofi-verify-library/scripts/verify_audio.py")
download = load("test_run_module", "skills/gofi-track/scripts/gofi_run.py")
OLD, NEW = "a" * 185, "b" * 192


def payload(user_id=123, lossless=True):
    return {"error": [], "results": {"USER": {"USER_ID": user_id,
            "OPTIONS": {"license_token": "fixture", "web_lossless": lossless, "web_hq": True}}}}


def valid(token):
    return auth.classify_payload(payload()) if token == NEW else {"status": "invalid"}


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        (self.repo / "gofi").write_text("#!/bin/sh\nexit 0\n")
        (self.repo / "gofi").chmod(0o700)
        self.env = self.repo / ".env"
        self.env.write_text("# preserved\nDEEZER_ARL=" + OLD + "\nGOFI_QUALITY=9\n")

    def tearDown(self):
        self.tmp.cleanup()

    def test_authenticated_boolean_shapes(self):
        data = payload()
        data["results"]["USER"]["OPTIONS"].update(web_lossless=None, mobile_loseless="1", web_hq="0")
        state = auth.classify_payload(data)
        self.assertEqual(state["status"], "authenticated")
        self.assertTrue(state["lossless"])
        self.assertFalse(state["hq"])

    def test_anonymous_is_invalid(self):
        self.assertEqual(auth.classify_payload(payload(0))["status"], "invalid")

    def test_missing_license_is_not_expired(self):
        data = payload()
        data["results"]["USER"]["OPTIONS"].pop("license_token")
        self.assertEqual(auth.classify_payload(data)["status"], "provider_error")

    def test_unknown_capability_is_not_assumed(self):
        data = payload()
        data["results"]["USER"]["OPTIONS"].pop("web_lossless")
        self.assertIsNone(auth.classify_payload(data)["lossless"])

    def test_authentication_error_code(self):
        self.assertEqual(auth.classify_payload({"results": {}, "error": {"NEED_API_AUTH_REQUIRED": "fixture"}})["status"], "invalid")

    def test_payload_not_exposed(self):
        state = auth.classify_payload({"results": {}, "error": {"OTHER": NEW}})
        self.assertNotIn(NEW, json.dumps(state))

    def test_network_and_403_do_not_mean_invalid(self):
        for error, expected in [(URLError("network"), "transport_error"),
                                (HTTPError(auth.ENDPOINT, 403, "forbidden", {}, None), "provider_error"),
                                (HTTPError(auth.ENDPOINT, 429, "busy", {}, None), "rate_limited")]:
            with self.subTest(expected=expected):
                opener = Mock()
                opener.open.side_effect = error
                self.assertEqual(auth.probe(NEW, opener)["status"], expected)

    def test_redirect_cannot_forward_cookie(self):
        self.assertIsNone(auth.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.org"))

    def test_credential_only_goes_to_deezer_https(self):
        opener = MagicMock()
        response = opener.open.return_value.__enter__.return_value
        response.read.return_value = json.dumps(payload()).encode()
        self.assertEqual(auth.probe(NEW, opener)["status"], "authenticated")
        request = opener.open.call_args.args[0]
        self.assertTrue(request.full_url.startswith(auth.ENDPOINT + "?"))
        self.assertNotIn(NEW, request.full_url)
        self.assertEqual(request.headers["Cookie"], "arl=" + NEW)

    def test_curl_secret_uses_stdin_and_secure_flags(self):
        runner = Mock(return_value=SimpleNamespace(returncode=0, stdout=json.dumps(payload()) + "\n200"))
        result = auth.curl_probe(NEW, runner=runner, curl="/usr/bin/curl")
        self.assertEqual(result["status"], "authenticated")
        args = runner.call_args.args[0]
        self.assertEqual(args[1], "--disable")
        self.assertNotIn(NEW, " ".join(args))
        self.assertNotIn("--location", args)
        self.assertNotIn("--insecure", args)
        self.assertIn("--max-time", args)
        self.assertIn(NEW, runner.call_args.kwargs["input"])

    def test_curl_redirect_and_timeout_do_not_trigger_invalid_auth(self):
        for output, code, state in [("\n302", 0, "provider_error"), ("", 28, "transport_error")]:
            runner = Mock(return_value=SimpleNamespace(returncode=code, stdout=output))
            self.assertEqual(auth.curl_probe(NEW, runner=runner, curl="curl")["status"], state)

    def test_curl_rejects_config_injection(self):
        runner = Mock(side_effect=AssertionError("Unsafe token must not reach curl"))
        self.assertEqual(auth.curl_probe(NEW + '\"\nurl = https://example.org', runner=runner)["status"], "invalid")
        runner.assert_not_called()

    def test_auth_error_without_results(self):
        self.assertEqual(auth.classify_payload({"error": {"NEED_API_AUTH_REQUIRED": "fixture"}})["status"], "invalid")

    def test_literal_parser_never_executes_shell(self):
        for value in ("$(touch nope)", '"${TOKEN}"', "`whoami`"):
            with self.assertRaises(auth.AuthError):
                auth.literal_value(value)
        self.assertEqual(auth.literal_value("'abc' # comment"), "abc")

    def test_duplicate_assignments_rejected(self):
        self.env.write_text("DEEZER_ARL=" + OLD + "\nexport DEEZER_ARL='" + NEW + "'\n")
        with self.assertRaises(auth.AuthError):
            auth.read_env(self.env)

    def test_atomic_update_preserves_unrelated_and_private_mode(self):
        original = self.env.read_bytes()
        auth.replace_arl(self.env, NEW, original)
        self.assertEqual(self.env.read_text(), "# preserved\nDEEZER_ARL=" + NEW + "\nGOFI_QUALITY=9\n")
        self.assertEqual(stat.S_IMODE(self.env.stat().st_mode), 0o600)
        self.assertFalse((self.repo / ".gofi-companion-auth.lock").exists())

    def test_concurrent_edit_preserved(self):
        original = self.env.read_bytes()
        self.env.write_bytes(original + b"# other writer\n")
        with self.assertRaises(auth.AuthError):
            auth.replace_arl(self.env, NEW, original)
        self.assertIn(b"# other writer", self.env.read_bytes())

    def test_symlink_credentials_rejected(self):
        target = self.repo / "target"
        self.env.rename(target)
        self.env.symlink_to(target)
        with self.assertRaises(auth.AuthError):
            auth.read_env(self.env)

    def test_check_does_not_refresh(self):
        browser = Mock(side_effect=AssertionError("No refresh permitted"))
        original = self.env.read_bytes()
        report, _, code = auth.prepare(self.repo, environ={}, checker=valid, browser=browser)
        self.assertEqual(code, 10)
        self.assertEqual(self.env.read_bytes(), original)
        browser.assert_not_called()

    def test_expired_token_recovers_once(self):
        browser = Mock(return_value=(NEW, {"status": "authenticated"}))
        report, env, code = auth.prepare(self.repo, refresh=True, environ={}, checker=valid, browser=browser)
        self.assertEqual(code, 0)
        self.assertEqual(env["DEEZER_ARL"], NEW)
        self.assertEqual(report["deezer"]["recovery"], "browser_session")
        browser.assert_called_once()
        self.assertNotIn(NEW, json.dumps(report))

    def test_invalid_replacement_does_not_overwrite(self):
        original = self.env.read_bytes()
        browser = Mock(return_value=("c" * 192, {"status": "authenticated"}))
        _, _, code = auth.prepare(self.repo, refresh=True, environ={}, checker=valid, browser=browser)
        self.assertEqual(code, 10)
        self.assertEqual(original, self.env.read_bytes())

    def test_network_block_does_not_refresh(self):
        browser = Mock(side_effect=AssertionError("Not an auth failure"))
        _, _, code = auth.prepare(self.repo, refresh=True, environ={}, checker=lambda _: {"status": "transport_error"}, browser=browser)
        self.assertEqual(code, 12)
        browser.assert_not_called()

    def test_license_failure_does_not_refresh(self):
        browser = Mock(side_effect=AssertionError("Valid login"))
        checker = lambda _: auth.classify_payload(payload(lossless=False))
        report, _, code = auth.prepare(self.repo, refresh=True, require_lossless=True, environ={}, checker=checker, browser=browser)
        self.assertEqual(code, 11)
        self.assertEqual(report["deezer"]["status"], "authenticated")
        browser.assert_not_called()

    def test_stale_environment_recovers_from_valid_file(self):
        self.env.write_text("DEEZER_ARL=" + NEW + "\n")
        browser = Mock(side_effect=AssertionError("Saved value is valid"))
        report, env, code = auth.prepare(self.repo, refresh=True, environ={"DEEZER_ARL": OLD}, checker=valid, browser=browser)
        self.assertEqual(code, 0)
        self.assertEqual(env["DEEZER_ARL"], NEW)
        self.assertTrue(report["deezer"]["environment_overrides_env_file"])
        browser.assert_not_called()

    def test_browser_refresh_isolated_from_repo_env(self):
        original = self.env.read_bytes()
        def runner(command, *, cwd, env, **kwargs):
            self.assertEqual(command[-3:], ["auth", "deezer", "--force"])
            self.assertNotEqual(Path(cwd), self.repo)
            self.assertNotIn("DEEZER_ARL", env)
            (Path(cwd) / ".env").write_text("DEEZER_ARL=" + NEW)
            return SimpleNamespace(returncode=0, stdout="private provider output")
        token, state = auth.browser_candidate(self.repo / "gofi", {"DEEZER_ARL": OLD}, runner)
        self.assertEqual(token, NEW)
        self.assertEqual(state["status"], "authenticated")
        self.assertEqual(self.env.read_bytes(), original)

    def test_spotify_uses_supported_check(self):
        self.env.write_text("DEEZER_ARL=" + NEW)
        runner = Mock(return_value=SimpleNamespace(returncode=0, stdout="private identity"))
        report, _, code = auth.prepare(self.repo, refresh=True, spotify=True, environ={}, checker=valid, runner=runner)
        self.assertEqual(code, 0)
        self.assertEqual(runner.call_args.args[0][-3:], ["auth", "spotify", "--check"])
        self.assertNotIn("private identity", json.dumps(report))

    def har_entry(self, token=NEW, url="https://www.deezer.com/ajax/gw-light.php", status=200):
        body = json.dumps({"results": {"arl": token}}).encode()
        return {"request": {"url": url, "postData": {"text": "DO_NOT_REPLAY_PASSWORD"}},
                "response": {"status": status, "content": {"encoding": "base64", "text": base64.b64encode(body).decode()}}}

    def test_har_exact_token_validated_before_save(self):
        har = self.repo / "fixture.har"
        har.write_text(json.dumps({"log": {"entries": [self.har_entry()]}}))
        report, code = auth.import_har(self.repo, har, checker=valid)
        self.assertEqual(code, 0)
        self.assertTrue(report["updated"])
        self.assertEqual(auth.read_env(self.env)[1]["DEEZER_ARL"], NEW)
        self.assertNotIn(NEW, json.dumps(report))

    def test_har_wrong_origin_and_failed_response_ignored(self):
        har = self.repo / "fixture.har"
        har.write_text(json.dumps({"log": {"entries": [self.har_entry(url="https://deezer.com.example.org/x"), self.har_entry(status=401)]}}))
        with self.assertRaises(auth.AuthError):
            auth.candidates_from_har(har)

    def test_truncated_har_token_not_saved(self):
        original = self.env.read_bytes()
        har = self.repo / "fixture.har"
        har.write_text(json.dumps({"log": {"entries": [self.har_entry(token=OLD)]}}))
        report, code = auth.import_har(self.repo, har, checker=valid)
        self.assertEqual(code, 10)
        self.assertFalse(report["updated"])
        self.assertEqual(self.env.read_bytes(), original)


class DownloadTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.out = self.root / "output"
        self.preflight = lambda *args, **kwargs: ({"deezer": {"status": "authenticated"}}, {}, 0)

    def tearDown(self):
        self.tmp.cleanup()

    def test_url_validation(self):
        self.assertEqual(download.parse_url("https://open.spotify.com/track/abc?si=ignored")[2], "https://open.spotify.com/track/abc")
        for url in ("https://open.spotify.com.evil/track/a", "http://deezer.com/track/1", "https://name:password@deezer.com/track/1"):
            with self.assertRaises(ValueError):
                download.parse_url(url)

    def test_preflight_block_stops_download(self):
        runner = Mock(side_effect=AssertionError("Must not download"))
        report, code = download.run_download(self.root, "https://deezer.com/track/1", self.out,
            prepare=lambda *a, **k: ({"deezer": {"status": "transport_error"}}, {}, 12), runner=runner)
        self.assertEqual(code, 12)
        runner.assert_not_called()
        self.assertFalse(self.out.exists())

    def test_zero_exit_without_file_is_not_success(self):
        report, code = download.run_download(self.root, "https://deezer.com/track/1", self.out, prepare=self.preflight,
            runner=lambda *a, **k: SimpleNamespace(returncode=0, stdout="skipped"))
        self.assertEqual(code, 21)
        self.assertEqual(report["files"], [])

    def test_mp3_fallback_not_claimed_as_flac(self):
        def runner(*args, **kwargs):
            (self.out / "track.mp3").write_bytes(b"ID3fixture")
            return SimpleNamespace(returncode=0, stdout="fallback")
        report, code = download.run_download(self.root, "https://deezer.com/track/1", self.out, prepare=self.preflight, runner=runner)
        self.assertEqual(code, 21)
        self.assertEqual(report["files"][0]["codec"], "MP3")

    def test_playlist_requires_count_reconciliation(self):
        def runner(*args, **kwargs):
            (self.out / "track.flac").write_bytes(b"fLaCfixture")
            return SimpleNamespace(returncode=0, stdout="done")
        report, code = download.run_download(self.root, "https://deezer.com/playlist/1", self.out, prepare=self.preflight,
            runner=runner, verifier=lambda p: {"path": str(p), "status": "verified"})
        self.assertEqual(code, 21)
        self.assertFalse(report["collection_complete"])
        self.assertEqual(report["status"], "needs_collection_reconciliation")


class VerifyTests(unittest.TestCase):
    def test_streaminfo_and_tags(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "track.flac"
            packed = (44100 << 44) | (1 << 41) | (15 << 36) | 441000
            stream = b"\0" * 10 + packed.to_bytes(8, "big") + b"\0" * 16
            comment = b"TITLE=Fixture"
            comments = struct.pack("<I", 0) + struct.pack("<I", 1) + struct.pack("<I", len(comment)) + comment
            path.write_bytes(b"fLaC" + b"\x00\x00\x00\x22" + stream + b"\x84" + len(comments).to_bytes(3, "big") + comments)
            result = audio.verify(path, decode=False)
            self.assertEqual(result["duration_seconds"], 10)
            self.assertEqual(result["tags"]["TITLE"], ["Fixture"])
            self.assertEqual(result["status"], "metadata_verified")

    def test_fake_extension_and_broken_link(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "fake.flac"
            path.write_bytes(b"ID3not_flac")
            self.assertEqual(audio.verify(path)["status"], "not_flac")
            link = Path(folder) / "broken.flac"
            link.symlink_to(Path(folder) / "missing")
            self.assertEqual(audio.verify(link)["status"], "verification_failed")


if __name__ == "__main__":
    unittest.main()
