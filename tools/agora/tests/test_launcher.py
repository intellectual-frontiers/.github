import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from .helpers import HOME

LAUNCHER = HOME / "agora"


@unittest.skipUnless(shutil.which("uv"), "uv is not installed")
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

    def test_without_uv_it_says_so_and_exits_3(self):
        p = subprocess.run(["/bin/sh", str(LAUNCHER), "doctor"], capture_output=True, text=True, env={"PATH": "/nonexistent"})
        self.assertEqual(p.returncode, 3)
        self.assertIn("uv is needed", p.stderr)
