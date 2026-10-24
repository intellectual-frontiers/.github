"""A network that fails now and works in a minute (009-machine-bootstrap FR-032 to FR-037): downloads and network steps are tried again, the waits grow, each retry is said and kept,
and a refusal is not tried again. A fake curl that fails a set number of times, and a fake sleep that only records, stand in for the network and for time."""
from __future__ import annotations

import re
import shutil
import subprocess
import unittest
from pathlib import Path

from test_bootstrap import BOOT, SCRIPT, SH, Fixture

FAKE_CURL = r"""#!/bin/sh
# fails FAKE_FAILS times with status FAKE_RC (and HTTP code FAKE_CODE), then writes 'payload' to the -o file; every call is recorded
n=$(cat "$FAKE_DIR/count" 2>/dev/null || echo 0); n=$((n + 1)); echo $n >"$FAKE_DIR/count"
echo "$*" >>"$FAKE_DIR/calls"
out=""; prev=""
for a in "$@"; do [ "$prev" = -o ] && out=$a; prev=$a; done
if [ "$n" -le "${FAKE_FAILS:-0}" ]; then printf '%s' "${FAKE_CODE:-000}"; exit "${FAKE_RC:-6}"; fi
[ -n "$out" ] && [ "$out" != /dev/null ] && printf 'payload' >"$out"
printf '200'
exit 0
"""
FAKE_SLEEP = '#!/bin/sh\necho "$1" >>"$FAKE_DIR/sleeps"\n'


@unittest.skipUnless(SH, "sh is not installed")
class Retries(Fixture):
    def setUp(self):
        super().setUp()
        self.fake = self.tmp / "fake"
        self.fake.mkdir()
        self.stub("curl", FAKE_CURL.split("\n", 1)[1])
        self.stub("sleep", FAKE_SLEEP.split("\n", 1)[1])

    def sh(self, code: str, **extra):
        env = self.env(BOOTSTRAP_SOURCE_ONLY="1", PATH=f"{self.bin}:/usr/bin:/bin", FAKE_DIR=str(self.fake), **extra)
        return subprocess.run([SH, "-c", f'. "{SCRIPT}"; {code}'], capture_output=True, text=True, env=env, stdin=subprocess.DEVNULL)

    def calls(self):
        f = self.fake / "calls"
        return f.read_text().splitlines() if f.exists() else []

    def sleeps(self):
        f = self.fake / "sleeps"
        return [int(x) for x in f.read_text().split()] if f.exists() else []

    # ---- what is tried again
    def test_a_name_that_will_not_resolve_is_tried_again_said_and_then_works(self):
        """FR-032, FR-033"""
        out = self.tmp / "out"
        p = self.sh(f'fetch_to https://example.org/x.json "{out}" && cat "{out}"', FAKE_FAILS="2", FAKE_RC="6", ERGA_RETRY_DELAY="1")
        self.assertEqual((p.returncode, p.stdout), (0, "payload"), p.stderr)
        self.assertEqual(len(self.calls()), 3)
        self.assertEqual(len(self.sleeps()), 2)
        self.assertIn("example.org: the name could not be looked up (DNS); trying again in", p.stderr)
        self.assertIn("(attempt 2 of 8)", p.stderr)
        self.assertIn("(attempt 3 of 8)", p.stderr)

    def test_a_busy_server_is_tried_again_and_a_refusal_is_not(self):
        """FR-032"""
        for code in ("503", "429", "408"):
            (self.fake / "count").unlink(missing_ok=True)
            p = self.sh(f'fetch_to https://example.org/x "{self.tmp / "o"}"', FAKE_FAILS="1", FAKE_RC="22", FAKE_CODE=code, ERGA_RETRY_DELAY="1")
            self.assertEqual(p.returncode, 0, code)
        for code in ("404", "403", "401"):
            (self.fake / "count").unlink(missing_ok=True)
            (self.fake / "calls").unlink(missing_ok=True)
            p = self.sh(f'fetch_to https://example.org/x "{self.tmp / "o"}"', FAKE_FAILS="9", FAKE_RC="22", FAKE_CODE=code, ERGA_RETRY_DELAY="1")
            self.assertEqual(p.returncode, 1, code)
            self.assertEqual(len(self.calls()), 1, f"{code} was tried again")
            self.assertIn(f"the server answered {code}", p.stderr)

    def test_a_certificate_the_computer_does_not_accept_is_not_tried_again(self):
        """FR-032"""
        p = self.sh(f'fetch_to https://example.org/x "{self.tmp / "o"}"', FAKE_FAILS="9", FAKE_RC="60")
        self.assertEqual(p.returncode, 1)
        self.assertEqual(len(self.calls()), 1)
        self.assertIn("certificate was not accepted", p.stderr)

    def test_it_gives_up_after_the_tries_it_was_given_and_says_how_many(self):
        """FR-032, FR-034"""
        p = self.sh(f'fetch_to https://example.org/x "{self.tmp / "o"}"', FAKE_FAILS="99", FAKE_RC="28", ERGA_RETRIES="3", ERGA_RETRY_DELAY="1")
        self.assertEqual(p.returncode, 1)
        self.assertEqual(len(self.calls()), 3)
        self.assertIn("after 3 of 3 attempts", p.stderr)

    # ---- the waits and the knobs
    def test_the_wait_doubles_to_the_cap_with_a_little_jitter(self):
        """FR-033"""
        p = self.sh("for i in 1 2 3 4 5 6; do retry_wait $i; echo; done", ERGA_RETRY_DELAY="4", ERGA_RETRY_MAX_DELAY="20")
        got = [int(x) for x in p.stdout.split()]
        for have, base in zip(got, (4, 8, 16, 20, 20, 20)):
            self.assertTrue(base <= have <= base + 2, (have, base))

    def test_the_knobs_and_patient_and_nonsense_values(self):
        """FR-034"""
        show = 'echo "$retry_tries $retry_base $retry_cap"'
        self.assertEqual(self.sh(show).stdout.split(), ["8", "3", "60"])
        self.assertEqual(self.sh(show, BOOTSTRAP_PATIENT="1").stdout.split(), ["15", "5", "120"])
        self.assertEqual(self.sh(show, ERGA_RETRIES="20", ERGA_RETRY_DELAY="7", ERGA_RETRY_MAX_DELAY="90").stdout.split(), ["20", "7", "90"])
        self.assertEqual(self.sh(show, ERGA_RETRIES="lots", ERGA_RETRY_DELAY="0", ERGA_RETRY_MAX_DELAY="-1").stdout.split(), ["8", "3", "60"])
        self.assertEqual(self.sh(show, BOOTSTRAP_PATIENT="1", ERGA_RETRIES="4").stdout.split(), ["4", "5", "120"])

    def test_the_patient_switch_is_an_option_of_both_scripts(self):
        """FR-034"""
        for script in (SCRIPT, BOOT):
            p = subprocess.run([SH, str(script), "--patient", "--dry-run"], capture_output=True, text=True, env=self.env(BOOTSTRAP_NO_APT="1"), stdin=subprocess.DEVNULL)
            self.assertNotEqual(p.returncode, 2, p.stderr)
            self.assertIn("--patient", subprocess.run([SH, str(script), "--help"], capture_output=True, text=True, env=self.env()).stdout)

    # ---- resuming
    def test_a_part_file_is_resumed_and_any_other_is_not(self):
        """FR-035"""
        self.sh(f'fetch_to https://example.org/x "{self.tmp}/big.part"')
        self.sh(f'fetch_to https://example.org/x "{self.tmp}/small.json"')
        a, b = self.calls()
        self.assertIn("-C -", a)
        self.assertNotIn("-C -", b)

    def test_a_download_that_cannot_be_resumed_starts_again(self):
        """FR-035"""
        part = self.tmp / "big.part"
        part.write_text("old")
        p = self.sh(f'fetch_to https://example.org/x "{part}"', FAKE_FAILS="1", FAKE_RC="33", ERGA_RETRY_DELAY="1")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(part.read_text(), "payload")
        self.assertIn("starts again", p.stderr)

    def test_a_verified_download_keeps_its_part_between_runs_and_drops_a_wrong_one(self):
        """FR-035"""
        good = "2a6c9b5ef1f9a6a2c1f1f5fe1fc1d6a0d0a0e1c9b6bc30cdc6bb06cc2b4a5a5e"
        p = self.sh(f'download_verified https://example.org/x {good}', FAKE_FAILS="99", FAKE_RC="28", ERGA_RETRIES="2", ERGA_RETRY_DELAY="1")
        self.assertEqual(p.returncode, 1)
        p = self.sh(f'download_verified https://example.org/x {good}')
        self.assertEqual(p.returncode, 1)
        self.assertIn("is not the one expected", p.stderr)
        self.assertEqual(list((self.home / ".cache").rglob("*.part")), [], "a file that is not the expected one is not kept")

    # ---- steps that run other programs
    def test_a_command_whose_words_say_the_network_failed_is_run_again(self):
        """FR-032"""
        self.stub("flaky", 'n=$(cat "$FAKE_DIR/n" 2>/dev/null || echo 0); n=$((n+1)); echo $n >"$FAKE_DIR/n"\n'
                           '[ "$n" -ge 3 ] && { echo fine; exit 0; }\necho "fatal: unable to access x: Could not resolve host: github.com" >&2; exit 128')
        p = self.sh("retry_cmd 'copying' flaky", ERGA_RETRY_DELAY="1")
        self.assertEqual((p.returncode, p.stdout), (0, "fine\n"), p.stderr)
        self.assertEqual(len(self.sleeps()), 2)
        self.assertIn("copying: fatal: unable to access x: Could not resolve host", p.stderr)

    def test_a_command_that_was_refused_is_not_run_again(self):
        """FR-032"""
        for words in ("remote: Repository not found.", "fatal: Authentication failed for x", "SSL certificate problem: unable to get local issuer certificate", "error: something else"):
            (self.fake / "sleeps").unlink(missing_ok=True)
            self.stub("refused", f'echo "{words}" >&2; exit 128')
            p = self.sh("retry_cmd 'copying' refused", ERGA_RETRY_DELAY="1")
            self.assertEqual(p.returncode, 128, words)
            self.assertEqual(self.sleeps(), [], words)
            self.assertIn(words, p.stderr)

    def test_a_command_that_keeps_failing_stops_after_the_tries_and_shows_what_it_said(self):
        """FR-032"""
        self.stub("down", 'echo "Temporary failure resolving deb.debian.org" >&2; exit 100')
        p = self.sh("retry_cmd 'packages' down", ERGA_RETRIES="3", ERGA_RETRY_DELAY="1")
        self.assertEqual(p.returncode, 100)
        self.assertEqual(len(self.sleeps()), 2)
        self.assertIn("Temporary failure resolving", p.stderr)

    # ---- saying so
    def test_the_summary_counts_retries_and_names_where_they_were_most(self):
        """FR-033"""
        p = self.sh("say() { printf '%s\\n' \"$*\"; }; e_retry=''; d=''; z=''; b=''; retry_summary; "
                    "retry_note a.example 'it took too long' 3 2; retry_note a.example 'it took too long' 3 3; retry_note b.example 'x' 3 2; retry_summary", ERGA_RETRIES="8")
        self.assertIn("The network needed 3 retries in this run, most for: a.example (2), b.example (1).", p.stdout)
        self.assertIn("--patient", p.stdout)
        self.assertEqual(p.stdout.count("The network needed"), 1, "nothing is said when nothing was retried")

    def test_net_words_tell_a_failed_network_from_a_refusal(self):
        """FR-032"""
        for words, expect in (("Could not resolve host: github.com", True), ("Connection reset by peer", True), ("RPC failed; curl 56", True), ("HTTP 503", True),
                              ("Temporary failure resolving 'deb.debian.org'", True), ("remote: Repository not found.", False), ("certificate problem: self signed", False),
                              ("permission denied", False), ("syntax error", False)):
            f = self.tmp / "w"
            f.write_text(words)
            self.assertEqual(self.sh(f'net_words "{f}"').returncode == 0, expect, words)

    # ---- before the long installs
    def test_an_unreachable_github_stops_early_with_what_to_try_and_changes_nothing(self):
        """FR-037"""
        p = subprocess.run([SH, str(SCRIPT)], capture_output=True, text=True, stdin=subprocess.DEVNULL,
                           env=self.env(PATH=f"{self.bin}:/usr/bin:/bin", FAKE_DIR=str(self.fake), FAKE_FAILS="999", FAKE_RC="6", ERGA_RETRIES="2", ERGA_RETRY_DELAY="1",
                                        BOOTSTRAP_NO_NETCHECK="", BOOTSTRAP_NO_AUTH="1"))
        self.assertEqual(p.returncode, 3, p.stdout + p.stderr)
        self.assertIn("cannot reach", p.stdout)
        self.assertIn("github.com", p.stdout)
        self.assertIn("DNS", p.stdout)
        self.assertIn("--patient", p.stdout)
        self.assertIn("BOOTSTRAP_NO_NETCHECK=1", p.stdout)
        self.assertFalse((self.home / ".local" / "bin").exists() and any((self.home / ".local" / "bin").iterdir()), "nothing was installed")

    def test_a_reachable_network_passes_the_look_and_the_look_can_be_skipped(self):
        """FR-037"""
        p = self.sh("dry=0; check_network; echo passed", BOOTSTRAP_NO_NETCHECK="")
        self.assertIn("passed", p.stdout, p.stderr)
        self.assertEqual(len(self.calls()), 7, "seven hosts are looked at: GitHub's four, Rust's and the crates' (009-machine-bootstrap FR-037)")
        (self.fake / "calls").unlink()
        self.assertIn("passed", self.sh("dry=0; check_network; echo passed", BOOTSTRAP_NO_NETCHECK="1").stdout)
        self.assertEqual(self.calls(), [])

    # ---- the bootstrap's own first download
    def test_the_bootstrap_tries_its_first_download_again(self):
        """FR-036"""
        self.stub("curl", FAKE_CURL.split("\n", 1)[1].replace("printf 'payload' >\"$out\"", f'cat "{SCRIPT}" >"$out"'))
        p = subprocess.run([SH, "-s", "--", "--dry-run"], input=BOOT.read_text(), capture_output=True, text=True,
                           env=self.env(PATH=f"{self.bin}:/usr/bin:/bin", FAKE_DIR=str(self.fake), FAKE_FAILS="2", FAKE_RC="6", ERGA_RETRY_DELAY="1", BOOTSTRAP_NO_APT="1"))
        self.assertIn("could not fetch the setup; trying again in", p.stderr)
        self.assertIn("(attempt 3 of 8)", p.stderr)
        self.assertEqual(len(self.calls()), 3)
        self.assertNotIn("could not fetch", p.stdout)
        (self.fake / "count").unlink()
        p = subprocess.run([SH, "-s", "--", "--dry-run"], input=BOOT.read_text(), capture_output=True, text=True,
                           env=self.env(PATH=f"{self.bin}:/usr/bin:/bin", FAKE_DIR=str(self.fake), FAKE_FAILS="99", FAKE_RC="6", ERGA_RETRIES="2", ERGA_RETRY_DELAY="1"))
        self.assertEqual(p.returncode, 3)
        self.assertIn("after 2 tries; the network or DNS is the likely cause", p.stderr)

    def test_the_support_file_and_the_stop_message_say_what_the_network_did(self):
        """FR-033"""
        text = SCRIPT.read_text()
        self.assertIn("Retries:     %s", text)
        self.assertIn("This looks like the network", text)
        self.assertRegex(text, r"if \[ -f \"\$2\" \] && net_words \"\$2\"")


if __name__ == "__main__":
    unittest.main()
