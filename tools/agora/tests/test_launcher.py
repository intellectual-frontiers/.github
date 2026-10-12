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
    """A PATH holding only these programs, so that a test says exactly what a host has."""
    dest.mkdir(parents=True, exist_ok=True)
    for tool in names:
        (dest / tool).symlink_to(shutil.which(tool))
    return dest


@unittest.skipUnless(shutil.which("uv"), "uv is not installed")
class BareLauncher(unittest.TestCase):
    """The launcher on a host with uv and no ws-host, and with a ws-host that cannot start the command (0041 FR-001, FR-082)."""

    TOOLS = ("sh", "dirname", "sed", "head", "mktemp", "rm", "uv", "env", "cksum", "cut", "mkdir", "printf")

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.bin = _tools(self.tmp / "bin", *self.TOOLS)
        self.work = self.tmp / "work"
        self.work.mkdir()

    def stub(self, body: str) -> None:
        f = self.bin / "ws-host"
        f.write_text("#!/bin/sh\n" + body)
        f.chmod(0o755)

    def run_agora(self, *argv, path=None, env=None):
        return subprocess.run(["/bin/sh", str(LAUNCHER), *argv], capture_output=True, text=True, cwd=self.work,
                              env={"PATH": path or str(self.bin), "HOME": str(self.tmp), "XDG_CACHE_HOME": str(self.tmp / "cache"), "UV_CACHE_DIR": os.environ.get("UV_CACHE_DIR", str(Path.home() / ".cache" / "uv")),
                                   "UV_PYTHON_INSTALL_DIR": os.environ.get("UV_PYTHON_INSTALL_DIR", str(Path.home() / ".local" / "share" / "uv" / "python")),
                                   **(env or {})})

    def profile(self, p):
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        return json.loads(p.stdout)["data"]["profile"]

    def test_it_needs_only_uv(self):
        self.assertEqual(self.profile(self.run_agora("doctor", "--json"))["provisioning"], "bare")

    def test_without_uv_it_says_so_and_exits_3(self):
        p = self.run_agora("doctor", path=str(_tools(self.tmp / "nouv", "sh", "dirname")))
        self.assertEqual(p.returncode, 3)
        self.assertIn("uv is needed", p.stderr)
        self.assertIn("https://docs.astral.sh/uv", p.stderr)

    STARTS = 'case "$1 $2" in "provider show") exit 0;; esac\nwhile [ "$1" != "--" ]; do shift; done\nshift\nexec "$@"\n'

    def test_a_ws_host_that_does_not_know_the_clone_leaves_it_to_uv_alone_and_says_nothing(self):
        self.stub('echo "No enabled provider is called agora." >&2\nexit 3\n')
        p = self.run_agora("doctor", "--json")
        self.assertEqual(self.profile(p)["provisioning"], "bare")
        self.assertNotIn("No enabled provider", p.stdout + p.stderr)  # ws-host's refusal never reaches the output, which may be JSON
        self.assertEqual(list(Path(tempfile.gettempdir()).glob("agora-started.*")), [])

    def test_a_ws_host_that_starts_it_is_hosted_and_a_failure_of_the_command_is_not_retried(self):
        self.stub(self.STARTS)
        self.assertEqual(self.profile(self.run_agora("doctor", "--json"))["provisioning"], "hosted")
        p = self.run_agora("nonsense")
        self.assertEqual(p.returncode, 2)
        self.assertEqual(len(list((self.tmp / "cache" / "agora").glob("hosted-*"))), 1)  # asked once, remembered

    def test_a_remembered_answer_that_has_gone_stale_is_dropped_and_the_command_still_runs(self):
        self.stub(self.STARTS)
        self.run_agora("doctor", "--json")
        self.stub('exit 3\n')  # the clone is no longer enabled; the stamp says it is
        self.assertEqual(self.profile(self.run_agora("doctor", "--json"))["provisioning"], "bare")
        self.assertEqual(list((self.tmp / "cache" / "agora").glob("hosted-*")), [])

    def test_a_command_that_names_a_toolchain_entry_exits_3_naming_ws_host_and_the_rest_run(self):
        p = self.run_agora("docs", "build", "--json")
        self.assertEqual(p.returncode, 3, p.stdout + p.stderr)
        self.assertIn("ws-host", p.stdout + p.stderr)
        self.assertEqual(self.run_agora("spec", "list", "--json").returncode, 0)

    def test_offline_still_applies(self):
        self.assertEqual(self.run_agora("lock", "--offline", "--json").returncode, 3)
