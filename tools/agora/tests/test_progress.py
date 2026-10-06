"""0025-tooling-environment FR-017: a slow step says it is working; the answer a program reads is not disturbed."""
import io
import os
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest import mock

from agora.core import progress, toolchain as tc

from .toolchain_fixture import FakeHost


class Progress(unittest.TestCase):
    def test_without_a_terminal_a_step_prints_one_plain_line_and_a_nested_one_adds_none(self):
        err = io.StringIO()
        with redirect_stderr(err), progress.step("📦 Preparing x"):
            with progress.step("📦 Inner"):
                pass
        self.assertEqual(err.getvalue(), "📦 Preparing x...\n")

    def test_it_can_be_switched_off(self):
        err = io.StringIO()
        with mock.patch.dict(os.environ, {"WS_HOST_PROGRESS": "never"}), redirect_stderr(err), progress.step("📦 Preparing x"):
            pass
        self.assertEqual(err.getvalue(), "")

    def test_at_a_terminal_a_slow_step_leaves_a_check_mark_line_and_a_failed_one_a_cross(self):
        class Tty(io.StringIO):
            def isatty(self):
                return True
        watched = tempfile.mkdtemp()
        self.addCleanup(os.rmdir, watched)
        for fail, mark in ((False, "✅ 📦 Slow"), (True, "❌ 📦 Slow")):
            err = Tty()
            with mock.patch.dict(os.environ, {"TERM": "xterm", "LANG": "C.UTF-8"}), mock.patch("time.monotonic", side_effect=iter([0.0, 0.0] + [3.0] * 50)), redirect_stderr(err):
                try:
                    with progress.step("📦 Slow", watch=Path(watched)):
                        import time as _t
                        _t.sleep(0.25)
                        if fail:
                            raise RuntimeError("x")
                except RuntimeError:
                    pass
            self.assertIn(mark, err.getvalue())

    def test_ws_hosts_progress_shows_beside_its_answer_and_the_answer_stays_clean(self):
        with tempfile.TemporaryDirectory() as tmp:
            host = FakeHost(Path(tmp))
            env = {**os.environ, "WS_HOST": str(host.script)}
            seen = {}
            real = tc.subprocess.run

            def spy(cmd, **kw):
                seen["stderr"], seen["env"] = kw.get("stderr", "missing"), kw.get("env", {})
                return real(cmd, **kw)
            with mock.patch.object(tc.subprocess, "run", spy):
                doc = tc.ask(["provider", "show", "agora"], env, show_progress=True)
            self.assertEqual(doc["kind"], "provider")
            self.assertIsNone(seen["stderr"])
            self.assertEqual(seen["env"]["WS_HOST_PROGRESS"], "always")
            with mock.patch.object(tc.subprocess, "run", spy):
                tc.ask(["provider", "show", "agora"], env)
            self.assertEqual(seen["env"].get("WS_HOST_PROGRESS"), env.get("WS_HOST_PROGRESS"))
