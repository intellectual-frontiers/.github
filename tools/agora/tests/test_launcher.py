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
        self.assertNotIn("[[ ", LAUNCHER.read_text())  # a bashism; [[:space:]] in sed is POSIX

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


def _tools(dest: Path, *names: str) -> Path:
    """A PATH holding only these programs, so that a test says exactly what a computer has."""
    dest.mkdir(parents=True, exist_ok=True)
    for tool in names:
        (dest / tool).symlink_to(shutil.which(tool))
    return dest


class HandsOver(unittest.TestCase):
    """The launcher hands over to archon, and asks nothing of the computer but uv (0041 FR-001, 0025-tooling-environment FR-014, FR-033)."""

    TOOLS = ("sh", "dirname", "sed", "head", "env")

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.bin = _tools(self.tmp / "bin", *self.TOOLS)
        self.log = self.tmp / "calls.log"
        for name in ("uv", "uvx"):          # stand-ins that record how they were called
            f = self.bin / name
            f.write_text(f'#!/bin/sh\necho "{name} $*" >> {self.log}\nprintf "PYTHONPATH=%s\\n" "$PYTHONPATH" >> {self.log}\n')
            f.chmod(0o755)

    def run_agora(self, *argv, env=None, path=None):
        return subprocess.run(["/bin/sh", str(LAUNCHER), *argv], capture_output=True, text=True, cwd=self.tmp,
                              env={"PATH": path or str(self.bin), "HOME": str(self.tmp), **(env or {})})

    def calls(self) -> list[str]:
        return self.log.read_text().splitlines() if self.log.is_file() else []

    def revision(self) -> str:
        import tomllib

        return tomllib.loads((HOME / "pyproject.toml").read_text())["tool"]["archon"]["revision"]

    def test_it_runs_archon_at_the_pinned_revision_and_passes_every_word_after_the_dashes(self):
        self.assertEqual(self.run_agora("check", "--help", "x").returncode, 0)
        self.assertEqual(self.calls()[0], f"uvx --quiet --from git+https://github.com/intellectual-frontiers/workspaces-host@{self.revision()} archon run "
                                          f"--repo {HOME} --path tools -- agora check --help x")

    def test_without_uv_it_says_so_and_exits_3(self):
        p = self.run_agora("doctor", path=str(_tools(self.tmp / "nouv", "sh", "dirname")))
        self.assertEqual(p.returncode, 3)
        self.assertIn("uv is needed", p.stderr)
        self.assertIn("https://docs.astral.sh/uv", p.stderr)

    def test_offline_by_flag_and_by_environment_reaches_uv_and_archon(self):
        for argv, env in ((("lock", "--offline"), {}), (("lock",), {"AGORA_OFFLINE": "1"})):
            self.log.unlink(missing_ok=True)
            self.run_agora(*argv, env=env)
            self.assertIn("uvx --quiet --offline --from", self.calls()[0])
            self.assertIn(f"--path tools --offline -- agora lock", self.calls()[0])

    def test_a_clone_named_in_archon_from_is_run_in_place(self):
        clone = self.tmp / "workspaces-host"
        clone.mkdir()
        self.run_agora("doctor", env={"ARCHON_FROM": str(clone)})
        self.assertIn("uv run --no-project --quiet --python >=3.14 -- python -W ignore -m archon run", self.calls()[0])
        self.assertIn(f"PYTHONPATH={clone}", self.calls()[1])

    def test_it_never_looks_for_ws_host(self):
        marker = self.tmp / "ws-host-was-called"
        f = self.bin / "ws-host"
        f.write_text(f"#!/bin/sh\ntouch {marker}\nexit 9\n")
        f.chmod(0o755)
        self.assertEqual(self.run_agora("doctor").returncode, 0)
        self.assertFalse(marker.exists())
