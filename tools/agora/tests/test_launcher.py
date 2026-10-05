import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from .helpers import HOME

LAUNCHER = HOME / "agora"


def _enabled() -> bool:
    """ws-host is here and has this clone enabled as a provider (0025 FR-006)."""
    if not shutil.which("ws-host"):
        return False
    p = subprocess.run(["ws-host", "provider", "show", "agora", "--json"], capture_output=True, text=True)
    return p.returncode == 0


@unittest.skipUnless(_enabled(), "ws-host is not installed or has not enabled this clone")
class Launcher(unittest.TestCase):
    def run_agora(self, *argv, cwd=HOME, env=None):
        return subprocess.run([str(LAUNCHER), *argv], capture_output=True, text=True, cwd=cwd,
                              env={**os.environ, **(env or {})})

    def test_it_is_an_executable_posix_sh_script(self):
        self.assertTrue(os.access(LAUNCHER, os.X_OK))
        self.assertEqual(LAUNCHER.read_text().splitlines()[0], "#!/bin/sh")
        self.assertNotIn("[[", LAUNCHER.read_text())

    def test_it_runs_from_any_directory_inside_the_clone(self):
        for cwd in (HOME, HOME / "spec-kit" / "specs", Path(tempfile.gettempdir())):
            with self.subTest(cwd=cwd):
                p = self.run_agora("command", "show", "check", "--json", cwd=cwd)
                self.assertEqual(p.returncode, 0, p.stderr)
                self.assertEqual(json.loads(p.stdout)["id"], "check")

    def test_exit_status_for_usage(self):
        self.assertEqual(self.run_agora("nonsense").returncode, 2)

    def test_offline_by_flag_and_by_environment(self):
        self.assertEqual(self.run_agora("lock", "--offline", "--json").returncode, 3)
        self.assertEqual(self.run_agora("lock", "--json", env={"AGORA_OFFLINE": "1"}).returncode, 3)

    def test_it_runs_the_standard_library_interpreter_for_the_spec_suite(self):
        p = self.run_agora("check", "--suite", "spec", "--json")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(json.loads(p.stdout)["data"]["status"], "passed")

    def test_without_ws_host_it_says_so_and_exits_3(self):
        bare = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, bare, True)
        for tool in ("dirname", "sh"):
            (bare / tool).symlink_to(shutil.which(tool))
        p = subprocess.run(["/bin/sh", str(LAUNCHER), "doctor"], capture_output=True, text=True, env={"PATH": str(bare)})
        self.assertEqual(p.returncode, 3)
        self.assertIn("ws-host is needed", p.stderr)
        self.assertIn("ws-host provider add", p.stderr)

    def test_a_clone_that_is_not_enabled_exits_3_naming_the_command(self):
        home = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, home, True)
        p = self.run_agora("doctor", env={"XDG_CONFIG_HOME": str(home), "XDG_DATA_HOME": str(home / "d"), "XDG_STATE_HOME": str(home / "s")})
        self.assertEqual(p.returncode, 3, p.stdout + p.stderr)
        self.assertIn("ws-host provider add", p.stdout + p.stderr)
