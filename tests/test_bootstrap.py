"""The machine bootstrap (0136-machine-bootstrap): `bin/archon-setup.sh` (no administrator rights) and `bin/archon-bootstrap.sh` (the one that may use them), tested without root, apt or the network.

What runs here: the script's syntax in every POSIX shell on the machine, `--dry-run`, every switch that turns an installation off, the clone and its
fast-forward-only update against a local repository, the three `archon` commands against a stand-in launcher, the file editor
(`bin/bootstrap/managed.sh`) on text, the checksum and release-file rules on local fixtures. What does not: installing packages with apt, fetching
the pinned programs, signing in to GitHub, `chsh` (they need a Debian machine, a network and a person)."""
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

HOME = Path(__file__).resolve().parents[1]

BIN = HOME / "bin"
SCRIPT = BIN / "archon-setup.sh"
BOOT = BIN / "archon-bootstrap.sh"
SH = shutil.which("sh")

# every switch that stops an installation, so that a run changes nothing but the workspaces folder and the script's own directories
OFF_BUT_ARCHON = {"BOOTSTRAP_NO_DOWNLOAD": "1", "BOOTSTRAP_NO_AUTH": "1", "BOOTSTRAP_NO_RUNTIME": "1", "BOOTSTRAP_NO_EDITOR": "1"}
OFF = {"BOOTSTRAP_NO_APT": "1", "BOOTSTRAP_NO_DOWNLOAD": "1", "BOOTSTRAP_NO_DOTFILES": "1", "BOOTSTRAP_NO_AUTH": "1", "BOOTSTRAP_NO_CHSH": "1",
       "BOOTSTRAP_NO_CLONE": "1", "BOOTSTRAP_NO_ARCHON": "1", "BOOTSTRAP_NO_RUNTIME": "1", "BOOTSTRAP_NO_EDITOR": "1"}


def tree(root: Path) -> list[str]:
    return sorted(str(p.relative_to(root)) for p in root.rglob("*"))


def git(*argv, cwd=None):
    env = {**os.environ, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"}
    return subprocess.run(["git", *argv], cwd=cwd, capture_output=True, text=True, env=env, check=True).stdout


class Fixture(unittest.TestCase):
    """A temporary home folder and the environment a run needs."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.home = self.tmp / "home"
        self.home.mkdir()
        self.bin = self.tmp / "stubs"
        self.bin.mkdir()

    def env(self, **extra):
        env = {k: v for k, v in os.environ.items() if not k.startswith(("BOOTSTRAP_", "ARCHON_WORKSPACES", "XDG_")) and k not in ("NO_COLOR", "GH_TOKEN", "GITHUB_TOKEN")}
        env.update(HOME=str(self.home), TERM="dumb", LANG="C", TMPDIR=str(self.tmp), BOOTSTRAP_NO_NETCHECK="1")
        env.update(extra)
        return env

    def run_script(self, *argv, stdin=None, **extra):
        return subprocess.run([SH, str(SCRIPT), *argv], capture_output=True, text=True, env=self.env(**extra), input=stdin, stdin=None if stdin else subprocess.DEVNULL)

    def stub(self, name, body="exit 0"):
        f = self.bin / name
        f.write_text(f"#!/bin/sh\n{body}\n")
        f.chmod(0o755)
        return f


@unittest.skipUnless(SH, "sh is not installed")
class Shape(unittest.TestCase):
    def test_the_files_exist_and_the_scripts_are_posix_sh(self):
        bashism = re.compile(r"\[\[ | \]\]|<<<|\$\{!|\$\(\(.*\+\+|(^|[;&|(]\s*)(source|local|declare|typeset|function|mapfile|readarray|shopt)\s")
        for f in (SCRIPT, BOOT):
            text = f.read_text()
            self.assertEqual(text.splitlines()[0], "#!/bin/sh", f.name)
            self.assertTrue(os.access(f, os.X_OK), f.name)
            for line in text.splitlines():
                if not line.lstrip().startswith("#"):
                    self.assertIsNone(bashism.search(line), f"a bashism in {f.name}: {line}")

    def test_no_file_of_the_earlier_name_or_its_data_is_kept(self):
        """0136-machine-bootstrap FR-051: the names are archon-bootstrap.sh and archon-setup.sh, and the templates and themes live in archon."""
        self.assertFalse((BIN / "bootstrap-archon.sh").exists())
        self.assertFalse((BIN / "bootstrap").exists())

    def test_the_sign_in_says_what_it_waits_for_while_gh_is_quiet(self):
        """gh prints the code and then nothing; the script says on the terminal, every so often, the address to open and that nothing else is to be pressed."""
        text = SCRIPT.read_text()
        self.assertIn("Waiting for you:", text)
        self.assertIn("rem_pid", text)
        self.assertNotIn("your browser opens", text)
        self.assertNotIn("ABCD-1234", text)

    def test_it_parses_in_every_posix_shell_here(self):
        for shell in ("sh", "dash", "bash", "ash"):
            exe = shutil.which(shell)
            if not exe:
                continue
            for f in (SCRIPT, BOOT):
                with self.subTest(shell=shell, file=f.name):
                    p = subprocess.run([exe, "-n", str(f)], capture_output=True, text=True)
                    self.assertEqual(p.returncode, 0, p.stderr)

    @unittest.skipUnless(shutil.which("shellcheck"), "shellcheck is not installed")
    def test_shellcheck_passes(self):
        p = subprocess.run(["shellcheck", "-s", "sh", "-S", "warning", str(SCRIPT), str(BOOT)], capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stdout)

    def test_the_pins_are_whole(self):
        text = SCRIPT.read_text()
        sums = re.findall(r"^([A-Z]+)_SHA256_(X86_64|AARCH64|MACOS_ARM64)=(\S+)$", text, re.M)
        self.assertEqual(sorted({n for n, _, _ in sums}), ["FISH", "GH", "GLAB", "JQ", "MISE"], "chezmoi and Oh My Posh are pinned by archon, in toolchain/")
        for name, arch, digest in sums:
            self.assertRegex(digest, r"^[0-9a-f]{64}$", f"{name} {arch}")
        self.assertEqual(len(sums), 10, "fish has no Mac build; gh and jq are pinned for a Mac alone (0136-machine-bootstrap FR-057)")
        for var in ("UV_VERSION", "PYTHON_VERSION", "GH_VERSION", "JQ_VERSION"):
            self.assertRegex(re.search(rf"^{var}=(\S+)$", text, re.M).group(1), r"^\d+\.\d+(\.\d+)?$", var)
        self.assertRegex(re.search(r"^MS_KEY_SHA256=(\S+)$", BOOT.read_text(), re.M).group(1), r"^[0-9a-f]{64}$", "Microsoft's key, pinned by the bootstrap")


@unittest.skipUnless(SH, "sh is not installed")
class Entry(Fixture):
    def test_help_and_a_bad_option(self):
        p = self.run_script("--help")
        self.assertEqual(p.returncode, 0)
        self.assertIn("curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/archon-setup.sh | sh", p.stdout)
        self.assertEqual(self.run_script("--nonsense").returncode, 2)

    def test_it_refuses_a_home_that_is_not_a_folder(self):
        p = self.run_script("--dry-run", HOME="")
        self.assertEqual(p.returncode, 3)
        self.assertIn("HOME", p.stderr)

    def test_it_refuses_a_machine_that_is_not_debian_family(self):
        osr = self.tmp / "os-release"
        osr.write_text('ID=fedora\nPRETTY_NAME="Fedora Linux 40"\nVERSION_ID=40\n')
        p = self.run_script("--dry-run", BOOTSTRAP_OS_RELEASE=str(osr))
        self.assertEqual(p.returncode, 3)
        self.assertIn("Fedora Linux 40", p.stderr)
        self.assertIn("Fix:", p.stderr)

    def test_dry_run_lists_the_steps_and_writes_nothing(self):
        before = tree(self.home)
        p = self.run_script("--dry-run")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(tree(self.home), before, "a dry run writes nothing")
        for step in ("archon shell ensure", "archon doctor", "archon toolchain ensure", "archon check", "intellectual-frontiers/archon",
                     "GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https"):
            self.assertIn(step, p.stdout)
        for gone in ("Oh My Posh", "Installing chezmoi", "login shell", "apt install", "administrator rights"):
            self.assertNotIn(gone, p.stdout, f"the setup has no {gone} step")
        self.assertNotIn("\x1b", p.stdout + p.stderr, "no colour away from a terminal")

    def test_dry_run_lists_the_ai_assistants_and_the_comfort_kits_only_when_asked(self):
        """0136-machine-bootstrap FR-042, FR-047: the assistants are in the setup; the comfort kits are in only with --comfort."""
        p = self.run_script("--dry-run")
        for tool in ("claude", "codex", "opencode", "aider"):
            self.assertIn(f"Installing {tool} (the newest version)", p.stdout)
        self.assertIn("Installing the AI assistants", p.stdout)
        self.assertNotIn("Installing glab", p.stdout, "the comfort kits are off without --comfort")
        self.assertNotIn("Installing eza", p.stdout)
        comfy = self.run_script("--dry-run", "--comfort")
        self.assertIn("Installing glab", comfy.stdout)
        self.assertIn("Installing eza", comfy.stdout)
        self.assertIn("Installing fish", comfy.stdout)
        self.assertIn("Installing claude", comfy.stdout)
        off = self.run_script("--dry-run", "--comfort", BOOTSTRAP_NO_AGENTS="1")
        self.assertNotIn("AI assistants", off.stdout)
        self.assertIn("Installing glab", off.stdout, "the other kits stay")
        never = self.run_script("--dry-run", "--comfort", BOOTSTRAP_NO_COMFORT="1")
        self.assertNotIn("Installing eza", never.stdout, "BOOTSTRAP_NO_COMFORT=1 beats --comfort")
        only = self.run_script("--dry-run", "--comfort", BOOTSTRAP_KIT="agents")
        self.assertIn("Installing claude", only.stdout)
        self.assertNotIn("Installing eza", only.stdout)

    def test_the_summary_says_how_to_start_remote_control_where_claude_is_installed(self):
        """0136-machine-bootstrap FR-088: the summary names `claude remote-control` with Claude Code, starts nothing and asks for no key."""
        claude = self.home / ".local" / "bin" / "claude"
        claude.parent.mkdir(parents=True)
        claude.write_text(f'#!/bin/sh\necho ran >>"{self.tmp}/claude-ran"\n')
        claude.chmod(0o755)
        p = self.run_script(**OFF, ARCHON_WORKSPACES=str(self.tmp / "w"))
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("claude remote-control", p.stdout)
        self.assertIn("not an API key", p.stdout)
        self.assertFalse((self.tmp / "claude-ran").exists(), "the setup does not start Remote Control")
        off = self.run_script(**OFF, BOOTSTRAP_NO_AGENTS="1", ARCHON_WORKSPACES=str(self.tmp / "w"))
        self.assertNotIn("remote-control", off.stdout, "without the agents kit it is not named")

    def test_dry_run_follows_the_switches(self):
        p = self.run_script("--dry-run", **OFF)
        self.assertEqual(p.returncode, 0, p.stderr)
        for gone in ("intellectual-frontiers/archon", "archon doctor", "archon shell ensure"):
            self.assertNotIn(gone, p.stdout, f"{gone} is switched off")

    def test_dry_run_lists_the_same_steps_from_a_pipe(self):
        piped = subprocess.run([SH, "-s", "--", "--dry-run"], input=SCRIPT.read_text(), capture_output=True, text=True, env=self.env())
        self.assertEqual(piped.returncode, 0, piped.stderr)
        self.assertEqual(piped.stdout, self.run_script("--dry-run").stdout.replace(str(SCRIPT), "sh"))

    def test_the_prompt_choice_is_handed_to_archon_shell(self):
        """0138-shell FR-009: the setup tells `archon shell set prompt` what was asked for; without a choice archon's default stands."""
        none = self.run_script("--dry-run", BOOTSTRAP_PROMPT="no")
        self.assertIn("archon shell set prompt none", none.stdout)
        plain = self.run_script("--dry-run", BOOTSTRAP_PROMPT="plain", **OFF_BUT_ARCHON)
        self.assertIn("archon shell set prompt plain", plain.stdout)
        self.assertNotIn("shell set prompt", self.run_script("--dry-run").stdout)

    def test_the_setup_has_no_dedicated_option_and_asks_archon_for_the_default_shell_mode(self):
        """0136-machine-bootstrap FR-051: the account can have any name; the mode is `archon shell`'s own choice"""
        self.assertEqual(self.run_script("--dedicated").returncode, 2)
        self.assertNotIn("--mode", self.run_script("--dry-run").stdout)


@unittest.skipUnless(SH, "sh is not installed")
class Colour(Fixture):
    """0136-machine-bootstrap FR-026: an environment variable name in a message is bright yellow where there is colour."""

    def test_an_environment_variable_name_is_bright_yellow_and_other_words_are_not(self):
        script = f". {SCRIPT}; yb=$(printf '\\033[1;93m'); z=$(printf '\\033[0m'); say 'set BOOTSTRAP_PROMPT=plain, not FR-001 or git'"
        p = subprocess.run([SH, "-c", script], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1"))
        self.assertIn("\033[1;93mBOOTSTRAP_PROMPT\033[0m", p.stdout, p.stderr)
        self.assertNotIn("\033[1;93mFR", p.stdout)


@unittest.skipUnless(SH and shutil.which("git"), "sh and git are needed")
class Switches(Fixture):
    def test_with_every_installation_off_only_the_workspaces_folder_appears(self):
        p = self.run_script(**OFF, BOOTSTRAP_KIT="")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        made = tree(self.home)
        self.assertIn("workspaces/github.com/intellectual-frontiers", made)
        self.assertEqual([m for m in made if (self.home / m).is_file() and not m.startswith((".archon-bootstrap/log/", ".local/state/gh/")) and m != ".config/archon/install.toml"], [], "folders only: no file of the person's changes, but the log, what gh itself keeps and the record of how it was set up")
        self.assertTrue(any(m.startswith(".archon-bootstrap/log/bootstrap-") for m in made), "everything is logged to ~/.archon-bootstrap/log/")
        again = self.run_script(**OFF, BOOTSTRAP_KIT="")
        self.assertEqual(again.returncode, 0)
        without_logs = lambda names: [m for m in names if not m.startswith(".archon-bootstrap/log/")]
        self.assertEqual(without_logs(tree(self.home)), without_logs(made), "a second run changes nothing (but writes its own log)")

    def test_the_workspaces_folder_can_be_named(self):
        p = self.run_script(**OFF, BOOTSTRAP_KIT="", ARCHON_WORKSPACES=str(self.tmp / "elsewhere"))
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertTrue((self.tmp / "elsewhere" / "github.com" / "intellectual-frontiers").is_dir())
        self.assertFalse((self.home / "workspaces").exists())

    def test_the_workspaces_folder_can_be_named_in_the_settings_file(self):
        cfg = self.home / ".config" / "archon"
        cfg.mkdir(parents=True)
        (cfg / "setup.env").write_text(f'ARCHON_WORKSPACES="{self.tmp / "named"}"\n')
        self.assertEqual(self.run_script(**OFF, BOOTSTRAP_KIT="").returncode, 0)
        self.assertTrue((self.tmp / "named" / "github.com" / "intellectual-frontiers").is_dir())


@unittest.skipUnless(SH and shutil.which("git") and shutil.which("jq"), "sh, git and jq are needed")
class Clone(Fixture):
    """The clone, its fast-forward-only update and the three archon commands, against a local repository with a stand-in launcher."""

    LAUNCHER = """#!/bin/sh
[ "$1 $2" = "toolchain list" ] || echo "ARCHON $* assume_yes=${ARCHON_ASSUME_YES:-} no_admin=${ARCHON_NO_ADMIN:-}" >>"${CALLS:?}"
case "$1 $2" in
  "toolchain list") libs='[]'; cmd=''
    [ -n "${FAKE_LIBS:-}" ] && { libs='["build-essential","cmake"]'; cmd='apt-get install -y build-essential cmake'; }
    echo '{"data":{"entries":[{"name":"node","ready":true,"summary":"Node.js"},{"name":"python","ready":false,"summary":"Python"},{"name":"docker","ready":false,"summary":"Docker (optional: only an image needs it)"},{"name":"jre","ready":false,"summary":"A Java runtime"}],"system_packages":'"$libs"',"system_command":"'"$cmd"'"}}' ;;
esac
[ "$1" = check ] && [ -n "${FAKE_FAIL:-}" ] && exit 4
[ "$1 $2" = "shell ensure" ] && [ -n "${FAKE_FAIL_SHELL:-}" ] && exit 3
exit 0
"""

    def setUp(self):
        super().setUp()
        self.upstream = self.tmp / "upstream"
        self.upstream.mkdir()
        git("init", "-q", "-b", "main", cwd=self.upstream)
        (self.upstream / "archon").write_text(self.LAUNCHER)
        (self.upstream / "archon").chmod(0o755)
        git("add", ".", cwd=self.upstream)
        git("commit", "-qm", "one", cwd=self.upstream)
        self.stub("uv")      # archon's launcher needs only uv; the stand-in does not run it, the script only checks it is there
        self.clone = self.home / "workspaces" / "github.com" / "intellectual-frontiers" / "archon"

    def go(self, **extra):
        off = {k: v for k, v in OFF.items() if k not in ("BOOTSTRAP_NO_CLONE", "BOOTSTRAP_NO_ARCHON", "BOOTSTRAP_NO_DOTFILES")}
        self.calls = self.tmp / "archon-calls.txt"
        self.calls.write_text("")
        argv = extra.pop("argv", ())
        # a token stands for the GitHub sign-in: without one the setup leaves everything that downloads from GitHub, archon's programs included, until there is one
        return self.run_script(*argv, **off, BOOTSTRAP_KIT="", ARCHON_URL=str(self.upstream), CALLS=str(self.calls), PATH=f"{self.bin}:{os.environ['PATH']}", **{"GH_TOKEN": "test-token", **extra})

    def push(self, name, text="x\n"):
        (self.upstream / name).write_text(text)
        git("add", name, cwd=self.upstream)
        git("commit", "-qm", name, cwd=self.upstream)

    def test_the_setup_alone_names_the_one_command_for_system_libraries_archon_says_it_lacks(self):
        """0136-machine-bootstrap FR-063: archon holds the list; the setup has no copy, and installs nothing itself"""
        p = self.go(FAKE_LIBS="1")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("sudo apt-get install -y build-essential cmake", p.stdout + p.stderr)
        self.assertIn("system libraries are missing: build-essential cmake", p.stdout)
        self.assertIn("ARCHON toolchain ensure", self.calls.read_text(), "the programs are still installed")
        self.assertNotIn("system libraries", self.go().stdout + self.go().stderr, "nothing is said where nothing is lacking")
        self.assertNotIn("build-essential", SCRIPT.read_text().split("system_libraries()")[0].split("MODERN_TOOLS")[0], "no second list of packages in the setup")

    def test_the_bootstrap_installs_those_libraries_with_the_rights_it_has_and_only_when_packages_are_on(self):
        """0136-machine-bootstrap FR-063"""
        log = self.tmp / "pm.log"
        log.write_text("")
        self.stub("sudo", f'case "$1" in -v | -n) exit 0 ;; esac\nexec "$@"')
        self.stub("apt-get", f'echo "apt-get $*" >>{log}')
        call = lambda **env: subprocess.run([SH, "-c", f'. "{BOOT}"; family=debian; sudo_ready=0; has_tty=0; dry=0; if bootstrap_install_libraries "build-essential cmake"; then echo rc=0; else echo rc=1; fi'], capture_output=True, text=True,   # noqa: E731
                                            env=self.env(BOOTSTRAP_SOURCE_ONLY="1", BOOTSTRAP_SETUP=str(SCRIPT), PATH=f"{self.bin}:{os.environ['PATH']}", **env))
        ok = call()
        self.assertIn("rc=0", ok.stdout, ok.stdout + ok.stderr)
        self.assertRegex(log.read_text(), r"apt-get install -y -qq .*build-essential cmake")
        log.write_text("")
        off = call(BOOTSTRAP_NO_APT="1")
        self.assertIn("rc=1", off.stdout)
        self.assertEqual(log.read_text(), "")

    def test_it_copies_archon_runs_its_three_commands_and_says_what_is_next(self):
        p = self.go()
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertTrue((self.clone / "archon").is_file())
        out = p.stdout
        calls = self.calls.read_text()
        order = [calls.index(c) for c in ("toolchain ensure python jre", "shell ensure", "doctor", "check")]
        self.assertEqual(order, sorted(order), "toolchain ensure, then the shells, then doctor, then check")
        self.assertNotIn("ensure python docker", calls, "what is not ready and not optional")
        self.assertEqual(calls.count("assume_yes=1"), 4, "every question archon could ask is answered yes")
        self.assertEqual(calls.count("no_admin=1"), 4, "0136-machine-bootstrap FR-046: no archon command the setup runs may use administrator rights")
        self.assertIn("archon orch status", out)
        self.assertIn("archon orch dev", out)
        wrapper = self.home / ".local" / "bin" / "archon"
        self.assertIn(str(self.clone / "archon"), wrapper.read_text())
        self.assertTrue(os.access(wrapper, os.X_OK))

    def test_the_shells_are_archons_to_set_up(self):
        """0136-machine-bootstrap FR-049, FR-051; 0138-shell FR-008: the setup writes no startup file, it runs `archon shell ensure`."""
        self.go()
        shell = [l for l in self.calls.read_text().splitlines() if "shell ensure" in l]
        self.assertEqual(len(shell), 1)
        self.assertNotIn("--mode", shell[0])
        for name in (".bashrc", ".profile", ".zshrc", ".zshenv", ".zprofile", ".config/fish"):
            self.assertFalse((self.home / name).exists(), f"the setup wrote {name}")

    def test_the_prompt_choice_is_handed_to_archon_shell_and_the_font_hint_comes_with_the_pretty_prompt(self):
        """0136-machine-bootstrap FR-010; 0138-shell FR-009"""
        pretty = self.go()
        for line in ("Nerd Font", "CaskaydiaCove Nerd Font", "~/.local/share/fonts", "fc-cache", "archon shell set prompt plain"):
            self.assertIn(line, pretty.stdout)
        for line in ("Windows Terminal", "Install for all users", "not inside Debian"):
            self.assertNotIn(line, pretty.stdout, "the steps for Windows are for WSL alone")
        wsl = self.go(WSL_DISTRO_NAME="Debian")
        for line in ("Install for all users", "Windows Terminal"):
            self.assertIn(line, wsl.stdout)
        self.assertNotIn("shell set prompt", self.calls.read_text(), "without a choice archon's default stands")
        plain = self.go(BOOTSTRAP_PROMPT="plain")
        self.assertIn("ARCHON shell set prompt plain", self.calls.read_text())
        self.assertNotIn("Nerd Font", plain.stdout)

    def test_the_shells_are_left_alone_with_the_switch_and_without_a_sign_in_and_a_failure_is_a_problem_not_a_stop(self):
        self.go(BOOTSTRAP_NO_DOTFILES="1")
        self.assertNotIn("shell ensure", self.calls.read_text())
        p = self.go(FAKE_FAIL_SHELL="1")
        self.assertEqual(p.returncode, 1, p.stdout + p.stderr)
        self.assertIn("archon shell ensure did not finish", p.stdout)
        self.assertIn("ARCHON doctor", self.calls.read_text(), "the rest goes on")
        self.assertRegex(p.stdout, r"(x|❌).*\./archon shell ensure \(exit status 3\)")

    def test_the_toolchain_can_be_named_or_skipped(self):
        self.go(BOOTSTRAP_TOOLCHAIN="node")
        self.assertIn("ARCHON toolchain ensure node", self.calls.read_text())
        self.go(BOOTSTRAP_TOOLCHAIN="none")
        self.assertNotIn("ARCHON toolchain ensure", self.calls.read_text())

    def test_all_three_commands_run_when_one_fails_and_the_status_says_so(self):
        p = self.go(FAKE_FAIL="1")
        self.assertEqual(p.returncode, 1)
        calls = self.calls.read_text()
        for name in ("doctor", "toolchain ensure", "shell ensure", "check"):
            self.assertIn(f"ARCHON {name}", calls)
        self.assertRegex(p.stdout, r"(x|❌).*\./archon check --quick \(exit status 4\)")

    def test_an_existing_clone_is_updated_by_fast_forward_alone(self):
        self.assertEqual(self.go(BOOTSTRAP_NO_ARCHON="1").returncode, 0)
        self.push("two")
        self.assertEqual(self.go(BOOTSTRAP_NO_ARCHON="1").returncode, 0)
        self.assertTrue((self.clone / "two").is_file(), "fast-forwarded")

    def test_a_clone_with_work_in_it_is_left_exactly_as_it_was(self):
        self.assertEqual(self.go(BOOTSTRAP_NO_ARCHON="1").returncode, 0)
        # uncommitted work in a file upstream changes
        self.push("shared", "upstream 1\n")
        self.assertEqual(self.go(BOOTSTRAP_NO_ARCHON="1").returncode, 0)
        (self.clone / "shared").write_text("mine\n")
        self.push("shared", "upstream 2\n")
        p = self.go(BOOTSTRAP_NO_ARCHON="1")
        self.assertEqual(p.returncode, 0)
        self.assertEqual((self.clone / "shared").read_text(), "mine\n")
        self.assertIn("your work is safe", p.stdout)
        git("checkout", "-q", "--", "shared", cwd=self.clone)
        # a commit of its own: diverged
        (self.clone / "local").write_text("z\n")
        git("add", "local", cwd=self.clone)
        git("commit", "-qm", "local", cwd=self.clone)
        head = git("rev-parse", "HEAD", cwd=self.clone)
        self.push("three")
        p = self.go(BOOTSTRAP_NO_ARCHON="1")
        self.assertEqual(p.returncode, 0)
        self.assertEqual(git("rev-parse", "HEAD", cwd=self.clone), head)
        self.assertIn("your work is safe", p.stdout)

    def test_without_a_sign_in_and_without_a_terminal_it_stops_before_the_clone_with_the_command(self):
        self.stub("gh", 'case "$1 $2" in "auth status") exit 1 ;; esac\nexit 0')
        p = self.run_script(**{k: v for k, v in OFF.items() if k not in ("BOOTSTRAP_NO_CLONE", "BOOTSTRAP_NO_ARCHON", "BOOTSTRAP_NO_AUTH")},
                            BOOTSTRAP_KIT="", ARCHON_URL=str(self.upstream), PATH=f"{self.bin}:{os.environ['PATH']}")
        self.assertEqual(p.returncode, 5, p.stderr)
        self.assertIn("GH_BROWSER=true gh auth login --hostname github.com --web --git-protocol https", p.stdout)
        self.assertIn(".archon-bootstrap/log/", p.stdout)
        self.assertFalse(self.clone.exists())

    def test_a_token_in_the_environment_means_no_sign_in_is_asked_for(self):
        self.stub("gh", 'case "$1 $2" in "auth status") [ -n "$GH_TOKEN" ] && exit 0 || exit 1 ;; "auth login") echo LOGIN_CALLED; exit 9 ;; esac\nexit 0')
        run = lambda **more: self.run_script(**{k: v for k, v in OFF.items() if k != "BOOTSTRAP_NO_AUTH"}, BOOTSTRAP_KIT="", PATH=f"{self.bin}:{os.environ['PATH']}", **more)
        p = run(GH_TOKEN="ghp_example")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("GH_TOKEN", p.stdout)
        self.assertNotIn("LOGIN_CALLED", p.stdout + p.stderr)
        self.stub("gh", 'case "$1 $2" in "auth status") exit 1 ;; esac\nexit 0')
        bad = run(GITHUB_TOKEN="ghp_bad")
        self.assertEqual(bad.returncode, 5, bad.stdout)
        self.assertIn("did not accept the token in", bad.stdout)

    def test_the_sign_in_shows_the_code_gh_printed_and_asks_nothing(self):
        flag = self.tmp / "signed"
        self.stub("gh", f'case "$1 $2" in\n"auth status") [ -f {flag} ] ;;\n"auth login") [ -t 0 ] && echo TERMINAL_ASKED; echo "! First copy your one-time code: WXYZ-5678"; sleep 2; touch {flag} ;;\n"auth setup-git") ;;\nesac')
        script = f". {SCRIPT}; has_tty=1; log_ok=1; mkdir -p \"$log_dir\"; : >\"$logfile\"; sign_in; echo SIGNED_IN"
        p = subprocess.run([SH, "-c", script], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1", PATH=f"{self.bin}:{os.environ['PATH']}"), timeout=60)
        self.assertIn("SIGNED_IN", p.stdout, p.stdout + p.stderr)
        self.assertIn("type this code: WXYZ-5678", p.stdout)
        self.assertIn("https://github.com/login/device", p.stdout)
        self.assertNotIn("TERMINAL_ASKED", p.stdout)
        self.assertNotIn("ABCD-1234", p.stdout)

    def test_git_identity_comes_from_the_account_only_where_git_has_none(self):
        self.stub("gh", 'case "$1 $2" in "auth status") exit 0 ;; "api user") echo \'{"login":"ada","id":42,"name":"Ada Lovelace"}\' ;; esac\nexit 0')
        extra = dict(PATH=f"{self.bin}:{os.environ['PATH']}", GIT_CONFIG_GLOBAL=str(self.home / ".gitconfig"))
        run = lambda **more: self.run_script(**{k: v for k, v in OFF.items() if k != "BOOTSTRAP_NO_AUTH"}, BOOTSTRAP_KIT="", **extra, **more)
        cfg = lambda k: subprocess.run(["git", "config", "--file", str(self.home / ".gitconfig"), k], capture_output=True, text=True).stdout.strip()
        self.assertEqual(run().returncode, 0)
        self.assertEqual(cfg("user.name"), "Ada Lovelace")
        self.assertEqual(cfg("user.email"), "42+ada@users.noreply.github.com")
        subprocess.run(["git", "config", "--file", str(self.home / ".gitconfig"), "user.name", "Mine"], check=True)
        run()
        self.assertEqual(cfg("user.name"), "Mine", "what a person set is never changed")
        run(BOOTSTRAP_GIT_NAME="Asked", BOOTSTRAP_GIT_EMAIL="a@example.com")
        self.assertEqual((cfg("user.name"), cfg("user.email")), ("Asked", "a@example.com"), "what was asked for is set")


@unittest.skipUnless(SH and shutil.which("jq") and shutil.which("curl"), "sh, jq and curl are needed")
class Rules(Fixture):
    """The checksum rule and the release-file rule, with the script's functions loaded and local files in place of the network."""

    def call(self, code, **env):
        return subprocess.run([SH, "-c", f'. "{SCRIPT}"; arch=x86_64; goarch=amd64\n{code}'], capture_output=True, text=True,
                              env=self.env(BOOTSTRAP_SOURCE_ONLY="1", **env))

    def test_a_download_is_kept_only_if_its_checksum_is_the_one_given(self):
        f = self.tmp / "tool.tar.gz"
        f.write_bytes(b"a program")
        good = hashlib.sha256(b"a program").hexdigest()
        ok = self.call(f'download_verified "file://{f}" {good}')
        self.assertEqual(ok.returncode, 0, ok.stderr)
        self.assertTrue(Path(ok.stdout.strip()).is_file())
        bad = self.call(f'download_verified "file://{f}" {"0" * 64}')
        self.assertNotEqual(bad.returncode, 0)
        self.assertIn("nothing was installed", bad.stderr)
        self.assertFalse((self.home / ".cache" / "archon-setup" / "downloads" / ("0" * 64)).exists())

    def registry(self, package_ok=True):
        """A registry on disk with one tool, `demo`, whose per-platform package holds a program that answers --version."""
        import base64
        import io
        import tarfile

        reg = self.tmp / "registry"
        (reg / "demo-linux-x64").mkdir(parents=True)
        (reg / "demo-meta").mkdir()
        buf = io.BytesIO()
        with tarfile.open(fileobj=buf, mode="w:gz") as t:
            body = b"#!/bin/sh\necho demo 1.0.0\n"
            info = tarfile.TarInfo("package/bin/demo")
            info.size, info.mode = len(body), 0o755
            t.addfile(info, io.BytesIO(body))
        data = buf.getvalue()
        (reg / "demo.tgz").write_bytes(data)
        digest = hashlib.sha512(data if package_ok else b"something else").digest()
        (reg / "demo-meta" / "latest").write_text(json.dumps({"version": "1.0.0"}))
        (reg / "demo-linux-x64" / "1.0.0").write_text(json.dumps({"dist": {"tarball": f"file://{reg / 'demo.tgz'}", "integrity": "sha512-" + base64.b64encode(digest).decode()}}))
        return f"file://{reg}"

    def test_an_ai_assistant_is_installed_only_with_the_checksum_npm_lists_for_it(self):
        """0136-machine-bootstrap FR-043: the program is verified, run once, linked, and a second run changes nothing."""
        setup = 'mkdir -p "$work" "$tools" "$bin"; '
        call = "install_npm_native demo demo-meta demo-linux-{arch}@{ver} demo"
        reg = self.registry()
        ok = self.call(setup + call + '; echo "rc=$?"; "$bin/demo" --version', BOOTSTRAP_NPM=reg)
        self.assertIn("rc=0", ok.stdout, ok.stderr)
        self.assertIn("demo 1.0.0", ok.stdout)
        self.assertTrue((self.home / ".local" / "bin" / "demo").is_symlink())
        again = self.call(setup + call + '; echo "rc=$?"', BOOTSTRAP_NPM=reg)
        self.assertIn("rc=0", again.stdout, again.stderr)

    def test_an_ai_assistant_whose_checksum_differs_is_refused_and_nothing_is_installed(self):
        setup = 'mkdir -p "$work" "$tools" "$bin"; '
        bad = self.call(setup + 'install_npm_native demo demo-meta demo-linux-{arch}@{ver} demo; echo "rc=$?"', BOOTSTRAP_NPM=self.registry(package_ok=False))
        self.assertNotIn("rc=0", bad.stdout)
        self.assertIn("nothing was installed", bad.stderr)
        self.assertFalse((self.home / ".local" / "bin" / "demo").exists())

    def release(self, tag, assets, name="rel.json"):
        f = self.tmp / name
        f.write_text(json.dumps({"tag_name": tag, "assets": assets}))
        return f

    def test_the_release_file_is_chosen_by_its_name(self):
        digest = "sha256:" + "a" * 64
        rel = self.release("v1.2.3", [
            {"name": "tool-1.2.3-x86_64-apple-darwin.tar.gz", "browser_download_url": "u/darwin", "digest": "sha256:" + "0" * 64},
            {"name": "tool_1.2.3_amd64.deb", "browser_download_url": "u/deb", "digest": "sha256:" + "1" * 64},
            {"name": "tool-1.2.3-aarch64-unknown-linux-gnu.tar.gz", "browser_download_url": "u/arm", "digest": "sha256:" + "2" * 64},
            {"name": "tool-1.2.3-x86_64-unknown-linux-gnu.tar.gz", "browser_download_url": "u/gnu", "digest": "sha256:" + "3" * 64},
            {"name": "tool-1.2.3-x86_64-unknown-linux-musl.tar.gz", "browser_download_url": "u/musl", "digest": digest}])
        p = self.call(f'candidate "{rel}" ""')
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(p.stdout.rstrip("\n").split("\t"), ["tool-1.2.3-x86_64-unknown-linux-musl.tar.gz", "u/musl", "a" * 64, "v1.2.3"])
        arm = self.call(f'arch=aarch64; candidate "{rel}" ""')
        self.assertEqual(arm.stdout.split("\t")[1], "u/arm")

    def test_a_pattern_names_the_file_exactly(self):
        rel = self.release("v1.1.3", [{"name": "duckdb_cli-linux-arm64.zip", "browser_download_url": "u/arm", "digest": "sha256:" + "5" * 64},
                                      {"name": "duckdb_cli-linux-amd64.zip", "browser_download_url": "u/amd", "digest": "sha256:" + "6" * 64}])
        p = self.call(f'candidate "{rel}" \'^duckdb_cli-linux-amd64\\.zip$\'')
        self.assertEqual(p.stdout.split("\t")[1:3], ["u/amd", "6" * 64])

    def test_a_release_with_no_checksum_from_its_publisher_is_refused(self):
        rel = self.release("v9", [{"name": "tool-linux-amd64.tar.gz", "browser_download_url": "u/tool"}])
        p = self.call(f'rc=0; candidate "{rel}" "" || rc=$?; cat "$work/why" >&2; exit $rc')
        self.assertNotEqual(p.returncode, 0)
        self.assertEqual(p.stdout, "")
        self.assertIn("no checksum", p.stderr)

    def test_a_checksum_file_beside_the_release_is_used(self):
        sums = self.tmp / "tool.sha256"
        sums.write_text(f"{'7' * 64}  tool-linux-amd64.tar.gz\n{'8' * 64}  tool-linux-arm64.tar.gz\n")
        rel = self.release("v9", [{"name": "tool-linux-amd64.tar.gz", "browser_download_url": "u/tool"},
                                  {"name": "checksums.txt", "browser_download_url": f"file://{sums}"}])
        p = self.call(f'candidate "{rel}" ""')
        self.assertEqual(p.stdout.split("\t")[2], "7" * 64, p.stderr)

    def test_a_program_is_found_wherever_the_archive_put_it(self):
        d = self.tmp / "unpacked"
        (d / "deep" / "er").mkdir(parents=True)
        for rel in ("deep/er/tool", "tool-docs", "deep/tool_static"):
            f = d / rel
            f.write_text("x")
            f.chmod(0o755)
        p = self.call(f'locate "{d}" "tool_static|tool"')
        self.assertEqual(p.stdout.strip(), "deep/tool_static")
        self.assertEqual(self.call(f'locate "{d}" "tool"').stdout.strip(), "deep/er/tool")
        self.assertEqual(self.call(f'locate "{d}" "missing"').stdout.strip(), "")


class Readme(unittest.TestCase):
    def test_the_public_readme_carries_no_setup_instructions(self):
        """0136-machine-bootstrap FR-022: the instructions live in archon's README, which the people who may run the script can read."""
        text = (HOME / "README.md").read_text()
        self.assertNotIn("## Set up a new computer", text)
        self.assertNotIn("bootstrap-archon", text)


class Packages(unittest.TestCase):
    def test_no_package_duplicates_a_program_archon_pins(self):
        """0136-machine-bootstrap FR-007: Node.js and the browser come from `archon toolchain ensure`, at the pinned version, not from apt."""
        text = BOOT.read_text()
        start = text.index("wanted_packages() {")
        body = text[start:text.index("\n}\n", start)]
        for pkg in ("nodejs", "npm", "chromium"):
            self.assertNotRegex(body, rf"\b{pkg}\b", pkg)
        setup = SCRIPT.read_text()
        verify = setup[setup.index("verify_install() {"):]
        self.assertNotRegex(verify.split("kit_on shell", 1)[0], r"\bnode\b|chromium")


class Slim(unittest.TestCase):
    def test_the_repository_holds_only_the_bootstrap_commons_its_tests_and_the_organizations_profile(self):
        """The rest of the harness lives in the private archon repository; this one stays small and public."""
        tracked = subprocess.run(["git", "ls-files"], cwd=HOME, capture_output=True, text=True, check=True).stdout.split()
        top = {t.split("/")[0] for t in tracked}
        self.assertLessEqual(top, {".github", "bin", "commons", "profile", "tests", "README.md", "AGENTS.md", "CLAUDE.md", ".gitignore"}, top)




@unittest.skipUnless(SH, "sh is not installed")
class Stops(Fixture):
    """0136-machine-bootstrap FR-028 to FR-030: a failed step stops the setup, is logged, and says where to look and how to ask for help."""

    def test_a_failed_step_stops_with_the_log_the_support_file_and_how_to_ask_for_help(self):
        script = f". {SCRIPT}; log_ok=1; mkdir -p \"$log_dir\"; : >\"$logfile\"; arch=x86_64; step 'Installing everything' sh -c 'echo broke the thing; exit 7'; echo SHOULD_NOT_GET_HERE"
        p = subprocess.run([SH, "-c", script], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1", BOOTSTRAP_SUPPORT="the help desk"))
        self.assertEqual(p.returncode, 4, p.stdout + p.stderr)
        self.assertNotIn("SHOULD_NOT_GET_HERE", p.stdout)
        out = p.stdout
        for need in ("Setup stopped", "Installing everything", "broke the thing", "~/.archon-bootstrap/log/bootstrap-", "support-", "the help desk"):
            self.assertIn(need, out, need)
        logs = sorted((self.home / ".archon-bootstrap" / "log").glob("*"))
        self.assertEqual([f.name.split("-")[0] for f in logs], ["bootstrap", "support"])
        self.assertIn("==== STEP 1: Installing everything (exit 7)", logs[0].read_text())
        self.assertIn("broke the thing", logs[1].read_text())

    def test_a_secret_in_the_output_is_removed_from_the_support_file(self):
        script = f". {SCRIPT}; log_ok=1; mkdir -p \"$log_dir\"; : >\"$logfile\"; step 'x' sh -c 'echo token=abc123 ghp_ABCDEFGHIJKLMNOP1234; exit 1'"
        subprocess.run([SH, "-c", script], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1"))
        support = next((self.home / ".archon-bootstrap" / "log").glob("support-*")).read_text()
        self.assertNotIn("abc123", support)
        self.assertNotIn("ghp_ABCDEFGHIJKLMNOP1234", support)


@unittest.skipUnless(SH, "sh is not installed")
class Telemetry(Fixture):
    """0136-machine-bootstrap FR-038: with a PostHog key the setup reports its steps, timings and failures (environment bootstrap); without one, nothing."""

    def serve(self):
        import http.server
        import threading
        got: list[dict] = []

        class H(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                got.append(json.loads(self.rfile.read(int(self.headers["Content-Length"]))))
                self.send_response(200)
                self.end_headers()

            def log_message(self, *a):
                pass

        srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.shutdown)
        return srv, got

    def run_failing(self, **extra):
        script = f". {SCRIPT}; log_ok=1; mkdir -p \"$log_dir\"; : >\"$logfile\"; arch=x86_64; step 'Installing one' true; step 'Installing two' sh -c 'echo broke at /home/x/y; exit 7'"
        return subprocess.run([SH, "-c", script], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1", **extra), timeout=60)

    def events(self, got):
        return [e for b in got for e in b["batch"]]

    def test_steps_a_failure_and_the_end_are_sent_with_the_environment_and_a_stable_device_id(self):
        srv, got = self.serve()
        p = self.run_failing(ARCHON_POSTHOG_KEY="phc_test", ARCHON_POSTHOG_HOST=f"http://127.0.0.1:{srv.server_port}")
        self.assertEqual(p.returncode, 4, p.stdout + p.stderr)
        ev = self.events(got)
        self.assertEqual([e["event"] for e in ev if e["event"] == "bootstrap_step"], ["bootstrap_step", "bootstrap_step"])
        names = {e["event"] for e in ev}
        self.assertTrue({"bootstrap_failed", "bootstrap_finished"} <= names, names)
        for e in ev:
            self.assertEqual(e["properties"]["environment"], "bootstrap")
            self.assertTrue(e["distinct_id"].startswith("dev-"))
            self.assertEqual(e["distinct_id"], e["properties"]["device_id"])
            for k in ("host_kind", "os_id", "arch", "cpus", "bootstrap_run", "hostname", "os_user"):
                self.assertIn(k, e["properties"])
        failed = next(e for e in ev if e["event"] == "bootstrap_failed")["properties"]
        self.assertIn("~/.archon-bootstrap/log/bootstrap-", failed["log_file"])
        self.assertIn("broke at", failed["error_tail"])
        self.assertEqual(next(e for e in ev if e["event"] == "bootstrap_finished")["properties"]["outcome"], "stopped")
        self.assertNotIn(str(self.home), json.dumps(ev))
        journal = (self.home / ".archon" / "telemetry" / "sent.jsonl").read_text()
        lines = [json.loads(l) for l in journal.splitlines()]
        self.assertEqual([l["event"] for l in lines], [e["event"] for e in ev] or [l["event"] for l in lines])
        self.assertTrue(all(l["source"] == "bootstrap" and l["status"] == 200 for l in lines))
        self.assertNotIn("phc_test", journal)
        first = ev[0]["distinct_id"]
        srv2, got2 = self.serve()
        self.run_failing(ARCHON_POSTHOG_KEY="phc_test", ARCHON_POSTHOG_HOST=f"http://127.0.0.1:{srv2.server_port}")
        self.assertEqual(self.events(got2)[0]["distinct_id"], first)

    def test_nothing_is_sent_without_a_key_or_when_told_not_to(self):
        srv, got = self.serve()
        host = f"http://127.0.0.1:{srv.server_port}"
        self.run_failing(ARCHON_POSTHOG_HOST=host)
        self.run_failing(ARCHON_POSTHOG_KEY="phc_test", ARCHON_POSTHOG_HOST=host, DO_NOT_TRACK="1")
        self.run_failing(ARCHON_POSTHOG_KEY="phc_test", ARCHON_POSTHOG_HOST=host, ARCHON_OBSERVE="off")
        self.assertEqual(got, [])

    def test_an_unreachable_host_changes_nothing_but_the_log(self):
        p = self.run_failing(ARCHON_POSTHOG_KEY="phc_test", ARCHON_POSTHOG_HOST="http://127.0.0.1:9")
        self.assertEqual(p.returncode, 4, p.stdout + p.stderr)


@unittest.skipUnless(SH, "sh is not installed")
class Settings(Fixture):
    """0136-machine-bootstrap FR-041, FR-050: the PostHog settings the setup was given are kept for every new terminal, in the file `archon secrets` uses; the lines that make a shell read it are `archon shell ensure`'s."""

    def keep(self, **extra):
        return self.run_script(**OFF, BOOTSTRAP_KIT="", **extra)

    def test_the_key_is_kept_privately_and_the_setup_writes_no_startup_file(self):
        p = self.keep(ARCHON_POSTHOG_KEY="phc_abcdefghijklmnopqrstuvwxyz1234", ARCHON_PERSON="ifcore:A B")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        f = self.home / ".config" / "archon" / "secrets.env"
        self.assertEqual(oct(f.stat().st_mode & 0o777), "0o600")
        self.assertEqual(oct(f.parent.stat().st_mode & 0o777), "0o700")
        self.assertIn("ARCHON_POSTHOG_KEY='phc_abcdefghijklmnopqrstuvwxyz1234'", f.read_text())
        self.assertIn("ARCHON_PERSON='ifcore:A B'", f.read_text())
        self.assertNotIn("phc_abcdefghijklmnopqrstuvwxyz1234", p.stdout + p.stderr, "the value is never shown")
        for name in (".profile", ".bashrc", ".zshenv", ".config/fish"):
            self.assertFalse((self.home / name).exists(), f"0136-machine-bootstrap FR-049: the setup wrote {name}")
        before = f.read_text()
        self.keep(ARCHON_POSTHOG_KEY="phc_abcdefghijklmnopqrstuvwxyz1234", ARCHON_PERSON="ifcore:A B")
        self.assertEqual(before, f.read_text(), "a second run changes nothing")

    def test_a_changed_key_replaces_the_old_one(self):
        self.keep(ARCHON_POSTHOG_KEY="phc_oldoldoldoldoldoldold")
        self.keep(ARCHON_POSTHOG_KEY="phc_newnewnewnewnewnewnew")
        text = (self.home / ".config" / "archon" / "secrets.env").read_text()
        self.assertEqual(text.count("ARCHON_POSTHOG_KEY="), 1)
        out = subprocess.run(["sh", "-c", 'set -a; . "$HOME/.config/archon/secrets.env"; set +a; printf %s "$ARCHON_POSTHOG_KEY"'], capture_output=True, text=True, env={**self.env(), "HOME": str(self.home)}).stdout
        self.assertEqual(out, "phc_newnewnewnewnewnewnew")

    def test_a_shell_file_of_the_persons_is_never_touched_by_the_setup(self):
        (self.home / ".bashrc").write_text("alias mine=1")
        self.keep(ARCHON_POSTHOG_KEY="phc_abcdefghijklmnopqrstuvwxyz1234")
        self.assertEqual((self.home / ".bashrc").read_text(), "alias mine=1")
        self.assertFalse((self.home / ".bashrc.before-archon").exists(), "archon shell ensure keeps that copy, when it first changes the file")

    def test_nothing_is_kept_without_a_setting_a_github_token_is_not_kept_and_a_quote_is_refused(self):
        p = self.keep(GH_TOKEN="ghp_" + "x" * 30)
        self.assertFalse((self.home / ".config" / "archon" / "secrets.env").exists())
        self.assertIn("not saved", p.stdout + p.stderr)
        self.assertIn("archon secrets set GH_TOKEN", p.stdout + p.stderr)
        q = self.keep(ARCHON_POSTHOG_KEY="phc_it's")
        self.assertIn("not saved", q.stdout + q.stderr)
        self.assertNotIn("phc_it", (self.home / ".config" / "archon" / "secrets.env").read_text() if (self.home / ".config" / "archon" / "secrets.env").exists() else "")

    def test_a_sign_in_made_with_gh_is_said_to_be_kept_on_this_computer_and_a_token_of_the_environment_is_not(self):
        env = self.env(BOOTSTRAP_SOURCE_ONLY="1", GH_TOKEN="ghp_" + "x" * 30)
        said = lambda how: subprocess.run([SH, "-c", f". {SCRIPT}; signin_how={how}; dry=0; secrets_file=/nonexistent/x; keep_settings"], capture_output=True, text=True, env=env).stdout
        kept = said("gh")
        self.assertIn("Your GitHub sign-in is kept on this computer", kept)
        self.assertIn("gh auth logout", kept)
        self.assertNotIn("not saved", kept)
        self.assertNotIn("archon secrets set GH_TOKEN", kept)
        token = said("env")
        self.assertIn("not saved", token)
        self.assertIn("archon secrets set GH_TOKEN", token)
        self.assertIn("gh auth login", token)
        self.assertIn("The GitHub token in GH_TOKEN was used", token)
        for output in (kept, token):
            self.assertNotIn("ghp_xxxx", output, "the token is never shown")

    def test_a_dry_run_writes_nothing_and_a_kept_key_counts_for_telemetry_where_the_terminal_has_none(self):
        p = self.run_script("--dry-run", **OFF, BOOTSTRAP_KIT="", ARCHON_POSTHOG_KEY="phc_abcdefghijklmnopqrstuvwxyz1234")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("would keep ARCHON_POSTHOG_KEY", p.stdout)
        self.assertFalse((self.home / ".config" / "archon").exists())
        f = self.home / ".config" / "archon"
        f.mkdir(parents=True)
        (f / "secrets.env").write_text("ARCHON_POSTHOG_KEY='phc_fromthefile'\n")
        q = subprocess.run([SH, "-c", f". {SCRIPT}; printf %s \"$ph_key\""], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1"))
        self.assertEqual(q.stdout, "phc_fromthefile")


@unittest.skipUnless(SH, "sh is not installed")
class Pool(Fixture):
    """0136-machine-bootstrap FR-032: tools that do not touch each other are fetched at the same time, each in a work folder of its own; a failure stops the setup."""

    def run_pool(self, body, **extra):
        script = f". {SCRIPT}; log_ok=1; mkdir -p \"$log_dir\"; : >\"$logfile\"; arch=x86_64; {body}"
        return subprocess.run([SH, "-c", script], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1", **extra))

    def test_six_one_second_jobs_run_at_the_same_time_and_each_has_its_own_work_folder(self):
        import time

        started = time.time()
        p = self.run_pool("f() { sleep 1; echo \"$work\" >>\"$HOME/folders\"; }; pool_begin T; for i in 1 2 3 4 5 6; do pstep \"job $i\" f; done; pool_end; echo DONE", BOOTSTRAP_JOBS="6")
        self.assertIn("DONE", p.stdout, p.stdout + p.stderr)
        self.assertLess(time.time() - started, 4.5, "six one-second jobs in parallel take about one second, not six")
        folders = (self.home / "folders").read_text().split()
        self.assertEqual(len(set(folders)), 6, "no two jobs share a temporary folder")

    def test_the_pool_does_not_wait_for_a_job_of_its_own_shell_that_is_not_in_it(self):
        """The hang of a real run: a bare `wait` after the jobs also waited for a background job that was not theirs, with nothing on the screen."""
        import time

        started = time.time()
        p = self.run_pool("sleep 20 >/dev/null 2>&1 & pool_begin T; pstep \"job\" sleep 1; pool_end; echo DONE; kill $!")
        self.assertIn("DONE", p.stdout, p.stdout + p.stderr)
        self.assertLess(time.time() - started, 8, "the pool waits for its own jobs only")

    def test_the_number_of_jobs_at_once_is_capped(self):
        import time

        started = time.time()
        p = self.run_pool("pool_begin T; for i in 1 2 3 4; do pstep \"job $i\" sleep 1; done; pool_end; echo DONE", BOOTSTRAP_JOBS="2")
        self.assertIn("DONE", p.stdout)
        self.assertGreaterEqual(time.time() - started, 1.9, "four one-second jobs two at a time take two seconds")

    def test_a_failed_job_stops_the_setup_after_the_others_finish_and_names_it(self):
        p = self.run_pool("pool_begin T; pstep 'good one' true; pstep 'bad one' sh -c 'echo nope; exit 9'; pstep 'good two' true; pool_end; echo SHOULD_NOT_GET_HERE")
        self.assertEqual(p.returncode, 4, p.stdout + p.stderr)
        self.assertNotIn("SHOULD_NOT_GET_HERE", p.stdout)
        self.assertIn("bad one", p.stdout)
        self.assertIn("nope", p.stdout)
        log = next((self.home / ".archon-bootstrap" / "log").glob("bootstrap-*")).read_text()
        self.assertIn("(exit 9)", log)
        self.assertEqual(log.count("==== STEP"), 3, "every job is in the log, whether it worked or not")


@unittest.skipUnless(SH, "sh is not installed")
class Editor(Fixture):
    """0136-machine-bootstrap FR-044: `code` opens VS Code; under WSL it is VS Code on Windows, installed with winget where it is missing."""

    def windows(self, with_code=True, with_winget=False):
        root = self.tmp / "c"
        user = root / "Users" / "me" / "AppData" / "Local"
        code = user / "Programs" / "Microsoft VS Code" / "bin" / "code"
        if with_code:
            code.parent.mkdir(parents=True)
            code.write_text('#!/bin/sh\necho "vs code on windows: $*"\n')
            code.chmod(0o755)
        if with_winget:
            w = user / "Microsoft" / "WindowsApps" / "winget.exe"
            w.parent.mkdir(parents=True)
            w.write_text(f'#!/bin/sh\necho "$*" > "{self.tmp}/winget-args"\nmkdir -p "{code.parent}"\nprintf \'#!/bin/sh\\necho installed: "$*"\\n\' > "{code}"\nchmod 755 "{code}"\n')
            w.chmod(0o755)
        return root

    def run_wsl(self, root, **more):
        off = {k: v for k, v in OFF.items() if k != "BOOTSTRAP_NO_EDITOR"}
        off.update(more)
        return self.run_script(**off, BOOTSTRAP_KIT="", WSL_DISTRO_NAME="Debian", BOOTSTRAP_WINDOWS_ROOT=str(root), ARCHON_WORKSPACES=str(self.tmp / "w"))

    def test_under_wsl_code_runs_vs_code_on_windows_and_a_second_run_changes_nothing(self):
        root = self.windows()
        p = self.run_wsl(root)
        self.assertEqual(p.returncode, 0, p.stderr)
        code = self.home / ".local" / "bin" / "code"
        out = subprocess.run([str(code), "."], capture_output=True, text=True)
        self.assertEqual(out.stdout.strip(), "vs code on windows: .")
        self.assertIn("code .", p.stdout, "the summary says how to open it")
        before = code.read_text()
        self.assertEqual(self.run_wsl(root).returncode, 0)
        self.assertEqual(code.read_text(), before)

    def test_a_code_command_of_the_persons_own_is_left_alone(self):
        code = self.home / ".local" / "bin" / "code"
        code.parent.mkdir(parents=True)
        code.write_text("#!/bin/sh\necho mine\n")
        p = self.run_wsl(self.windows())
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(code.read_text(), "#!/bin/sh\necho mine\n")
        self.assertIn("not this setup's", p.stdout)

    def test_under_wsl_without_vs_code_winget_installs_it_for_this_windows_user(self):
        root = self.windows(with_code=False, with_winget=True)
        p = self.run_wsl(root, BOOTSTRAP_NO_DOWNLOAD="")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        args = (self.tmp / "winget-args").read_text()
        for a in ("install", "--id Microsoft.VisualStudioCode", "--exact", "--scope user", "--accept-package-agreements"):
            self.assertIn(a, args)
        out = subprocess.run([str(self.home / ".local" / "bin" / "code"), "x"], capture_output=True, text=True)
        self.assertEqual(out.stdout.strip(), "installed: x")

    def test_under_wsl_without_vs_code_or_winget_it_says_how_and_goes_on(self):
        p = self.run_wsl(self.windows(with_code=False), BOOTSTRAP_NO_DOWNLOAD="")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertIn("winget install -e --id Microsoft.VisualStudioCode", p.stdout)
        self.assertFalse((self.home / ".local" / "bin" / "code").exists())

    def test_the_dry_run_names_the_step_and_the_switch_leaves_it_out(self):
        p = self.run_script("--dry-run", WSL_DISTRO_NAME="Debian", BOOTSTRAP_WINDOWS_ROOT=str(self.tmp / "c"))
        self.assertIn("VS Code on Windows", p.stdout)
        off = self.run_script("--dry-run", WSL_DISTRO_NAME="Debian", BOOTSTRAP_NO_EDITOR="1")
        self.assertNotIn("VS Code", off.stdout)


@unittest.skipUnless(SH, "sh is not installed")
class Setup(Fixture):
    """0136-machine-bootstrap FR-046: the setup never uses administrator rights, and says what it needs of the computer."""

    def test_the_setup_never_invokes_sudo_a_package_manager_or_chsh(self):
        text = SCRIPT.read_text()
        code = [l for l in text.splitlines() if not l.lstrip().startswith("#")]
        command = re.compile(r"(^|[;&|(]\s*|\$\()\s*(sudo|\$sudo_cmd|apt-get|apt|dpkg|chsh|useradd|adduser|runuser)\b")
        for line in code:
            self.assertIsNone(command.search(line), f"the setup runs an administrator's command: {line}")
        for name in ("sudo_for", "apt_install", "apt_update", "install_packages", "offer_fish", "/etc/shells"):
            self.assertNotIn(name, text, name)

    def test_without_git_or_curl_it_stops_before_changing_anything_with_the_one_command_to_run(self):
        names = [n for n in os.listdir("/usr/bin") if n not in ("git", "curl")]
        for n in names:
            try:
                os.symlink(f"/usr/bin/{n}", self.bin / n)
            except OSError:
                pass
        p = self.run_script(**OFF, PATH=str(self.bin))
        self.assertEqual(p.returncode, 3, p.stdout + p.stderr)
        self.assertIn("no git", p.stderr)
        self.assertIn("sudo apt-get install -y git", p.stderr)
        self.assertIn("archon-bootstrap.sh", p.stderr)
        self.assertFalse((self.home / "workspaces").exists())

    def test_a_missing_program_that_only_some_steps_need_is_named_and_the_setup_goes_on(self):
        p = self.run_script(**OFF, BOOTSTRAP_KIT="")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        if shutil.which("gh") and shutil.which("jq") and shutil.which("xz") and shutil.which("unzip"):
            self.skipTest("this computer has every program, so nothing is missing")
        self.assertIn("sudo apt-get install -y", p.stdout + p.stderr)


@unittest.skipUnless(SH, "sh is not installed")
class Bootstrap(Fixture):
    """0136-machine-bootstrap FR-046 to FR-048: the bootstrap installs packages and runs the setup for the account that runs it; it makes no account."""

    def run_boot(self, *argv, stdin=None, **extra):
        return subprocess.run([SH, str(BOOT), *argv], capture_output=True, text=True, env=self.env(**extra), input=stdin, stdin=None if stdin else subprocess.DEVNULL)

    def test_help_a_bad_option_and_no_option_makes_an_account(self):
        p = self.run_boot("--help")
        self.assertEqual(p.returncode, 0)
        for text in ("archon-bootstrap.sh | sh", "--dry-run"):
            self.assertIn(text, p.stdout)
        for text in ("--user", "--dedicated", "adduser"):
            self.assertNotIn(text, p.stdout)
        self.assertEqual(self.run_boot("--nonsense").returncode, 2)
        for gone in (("--user", "bob"), ("--dedicated",)):
            self.assertEqual(self.run_boot("--dry-run", *gone).returncode, 2, gone)

    def test_it_refuses_a_machine_that_is_not_debian_family(self):
        osr = self.tmp / "os-release"
        osr.write_text('ID=fedora\nPRETTY_NAME="Fedora Linux 40"\nVERSION_ID=40\n')
        p = self.run_boot("--dry-run", BOOTSTRAP_OS_RELEASE=str(osr))
        self.assertEqual(p.returncode, 3)
        self.assertIn("Fedora Linux 40", p.stderr)

    def test_dry_run_for_this_account_lists_the_packages_and_the_setup_in_one_plan_and_writes_nothing(self):
        before = tree(self.home)
        p = self.run_boot("--dry-run")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(tree(self.home), before)
        for step in ("install with apt", "Setting up archon in this account", "archon shell ensure", "archon doctor", "Installing claude", "Installing eza", "Installing fish", "login shell"):
            self.assertIn(step, p.stdout)
        for text in ("create the Linux account", "adduser", "useradd"):
            self.assertNotIn(text, p.stdout)

    def test_the_bootstrap_is_opinionated_the_comfort_kits_are_on_unless_it_is_told_not(self):
        """0136-machine-bootstrap FR-047"""
        def wanted(**env):
            p = subprocess.run([SH, "-c", f'. "{BOOT}"; detect_platform; load_config; wanted_packages; echo "kits=$kits"'], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1", BOOTSTRAP_SETUP=str(SCRIPT), **env))
            return p.stdout
        self.assertIn("ripgrep", wanted())
        self.assertIn("base", wanted().split("kits=")[1])
        off = wanted(BOOTSTRAP_NO_COMFORT="1")
        self.assertNotIn("ripgrep", off)
        self.assertIn("git ca-certificates curl wget tar xz-utils unzip jq gh", off, "what the setup needs is still installed")
        self.assertNotIn("Installing eza", self.run_boot("--dry-run", BOOTSTRAP_NO_COMFORT="1").stdout)
        self.assertIn("Installing eza", self.run_boot("--dry-run").stdout)

    @unittest.skipUnless(shutil.which("curl"), "curl is needed")
    def test_run_from_a_pipe_it_fetches_the_setup_and_plans_the_same(self):
        piped = subprocess.run([SH, "-s", "--", "--dry-run"], input=BOOT.read_text(), capture_output=True, text=True, env=self.env(BOOTSTRAP_URL=f"file://{HOME}"))
        self.assertEqual(piped.returncode, 0, piped.stderr)
        self.assertEqual(piped.stdout, self.run_boot("--dry-run").stdout)

    def test_it_makes_no_account_and_runs_the_setup_in_this_one_whatever_it_is_called(self):
        """0136-machine-bootstrap FR-046: the account is the user that runs the bootstrap (snshah, archon, or any name)"""
        log = self.tmp / "calls.log"
        log.write_text("")
        for name in ("adduser", "useradd", "runuser", "sysadminctl", "sudo"):
            self.stub(name, f'echo "{name} $*" >>{log}')
        env = {**OFF, "PATH": f"{self.bin}:{os.environ['PATH']}", "USER": "snshah"}
        p = self.run_boot(**env)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertNotRegex(log.read_text(), r"adduser|useradd|runuser|sysadminctl|sudo -")
        self.assertIn("Setting up archon in this account", p.stdout)
        for gone in ("sudo -iu", "deluser", "userdel", "the account archon"):
            self.assertNotIn(gone, p.stdout)


ARCH = 'ID=arch\nPRETTY_NAME="Arch Linux"\n'
OMARCHY = 'ID=omarchy\nID_LIKE=arch\nPRETTY_NAME="Omarchy"\n'   # an Arch-based distribution, named by ID_LIKE (0136-machine-bootstrap OQ-6)
FEDORA = 'ID=fedora\nPRETTY_NAME="Fedora Linux 40"\nVERSION_ID=40\n'


@unittest.skipUnless(SH, "sh is not installed")
class ArchFamily(Fixture):
    """0136-machine-bootstrap FR-052 to FR-056: the Arch family (Arch Linux, Omarchy), with `pacman`, beside the Debian family."""

    def osr(self, text):
        f = self.tmp / "os-release"
        f.write_text(text)
        return str(f)

    def run_boot(self, *argv, **extra):
        return subprocess.run([SH, str(BOOT), *argv], capture_output=True, text=True, env=self.env(**extra), stdin=subprocess.DEVNULL)

    def test_both_scripts_know_the_arch_family_by_id_or_id_like_and_refuse_another(self):
        """0136-machine-bootstrap FR-052"""
        for text in (ARCH, OMARCHY):
            for script in (SCRIPT, BOOT):
                p = subprocess.run([SH, str(script), "--dry-run"], capture_output=True, text=True, env=self.env(BOOTSTRAP_OS_RELEASE=self.osr(text)), stdin=subprocess.DEVNULL)
                self.assertEqual(p.returncode, 0, f"{script.name} on {text!r}: {p.stdout}{p.stderr}")
                self.assertNotIn("The bootstrap is made for Debian", p.stdout + p.stderr, "Arch is a tested family: no warning")
        for script in (SCRIPT, BOOT):
            p = subprocess.run([SH, str(script), "--dry-run"], capture_output=True, text=True, env=self.env(BOOTSTRAP_OS_RELEASE=self.osr(FEDORA)), stdin=subprocess.DEVNULL)
            self.assertEqual(p.returncode, 3, script.name)
            self.assertIn("Fedora Linux 40", p.stderr)
            self.assertIn("Arch family", p.stderr)
            self.assertIn("Fix:", p.stderr)

    def test_the_command_for_a_person_with_administrator_rights_is_the_computers_own(self):
        """0136-machine-bootstrap FR-055"""
        def hint(family):
            p = subprocess.run([SH, "-c", f'. "{SCRIPT}"; family={family}; admin_install_cmd git xz gh'], capture_output=True, text=True, env=self.env(BOOTSTRAP_SOURCE_ONLY="1"))
            return p.stdout
        self.assertEqual(hint("debian"), "sudo apt-get install -y git xz-utils gh")
        self.assertEqual(hint("arch"), "sudo pacman -S --needed git xz github-cli")

    def test_without_git_or_curl_the_setup_on_arch_names_the_pacman_command(self):
        """0136-machine-bootstrap FR-055"""
        for n in os.listdir("/usr/bin"):
            if n not in ("git", "curl"):
                try:
                    os.symlink(f"/usr/bin/{n}", self.bin / n)
                except OSError:
                    pass
        p = self.run_script(**OFF, PATH=str(self.bin), BOOTSTRAP_OS_RELEASE=self.osr(ARCH))
        self.assertEqual(p.returncode, 3, p.stdout + p.stderr)
        self.assertIn("sudo pacman -S --needed git", p.stderr)
        self.assertNotIn("apt", p.stderr.replace("archon-bootstrap", ""))

    def test_the_bootstraps_packages_are_arch_names_and_the_comfort_ones_only_when_asked(self):
        """0136-machine-bootstrap FR-053"""
        def wanted(**env):
            p = subprocess.run([SH, "-c", f'. "{BOOT}"; detect_platform; load_config; wanted_packages'], capture_output=True, text=True,
                               env=self.env(BOOTSTRAP_SOURCE_ONLY="1", BOOTSTRAP_SETUP=str(SCRIPT), BOOTSTRAP_OS_RELEASE=self.osr(ARCH), **env))
            return p.stdout
        full = wanted()
        for name in ("github-cli", "xz ", "ripgrep", "fd ", "python", "sqlite"):
            self.assertIn(name, full)
        for debian_only in ("xz-utils", "fd-find", "python3", "debianutils", "libmagickcore"):
            self.assertNotIn(debian_only, full)
        lean = wanted(BOOTSTRAP_NO_COMFORT="1")
        self.assertIn("git ca-certificates curl wget tar xz unzip jq github-cli", lean)
        self.assertNotIn("ripgrep", lean)

    def test_dry_run_on_arch_says_pacman_never_refreshes_the_list_and_makes_no_account(self):
        """0136-machine-bootstrap FR-053"""
        self.stub("pacman", "exit 1")   # an Arch computer has one; nothing is installed
        arch = self.run_boot("--dry-run", BOOTSTRAP_OS_RELEASE=self.osr(ARCH), PATH=f"{self.bin}:{os.environ['PATH']}")
        self.assertEqual(arch.returncode, 0, arch.stderr)
        self.assertIn("(arch family)", arch.stdout)
        self.assertIn("install with pacman (--needed, never refreshing the package list alone)", arch.stdout)
        self.assertNotIn("useradd", arch.stdout)
        self.assertNotIn("apt", arch.stdout)
        self.assertNotIn("Installing VS Code", arch.stdout, "Arch has no Microsoft repository to add")
        debian = self.run_boot("--dry-run")
        self.assertIn("refresh the package list, then install with apt", debian.stdout)
        self.assertNotIn("adduser", debian.stdout)

    def stubs(self, pacman_body):
        log = self.tmp / "calls.log"
        log.write_text("")
        self.stub("pacman", f'echo "pacman $*" >>{log}\n{pacman_body}')
        self.stub("sudo", f'case "$1" in -v) exit 0 ;; -n) exit 0 ;; esac\necho "sudo $*" >>{log}\nexec "$@"')
        return log

    def go(self, *argv, **extra):
        off = {k: "1" for k in ("BOOTSTRAP_NO_DOWNLOAD", "BOOTSTRAP_NO_DOTFILES", "BOOTSTRAP_NO_AUTH", "BOOTSTRAP_NO_CLONE", "BOOTSTRAP_NO_ARCHON", "BOOTSTRAP_NO_RUNTIME")}
        return self.run_boot(*argv, BOOTSTRAP_NO_CHSH="1", BOOTSTRAP_NO_EDITOR="1", BOOTSTRAP_OS_RELEASE=self.osr(ARCH), PATH=f"{self.bin}:{os.environ['PATH']}", **off, **extra)

    def test_it_installs_with_needed_and_makes_no_account(self):
        """0136-machine-bootstrap FR-053"""
        log = self.stubs('case "$1" in -Qi) exit 1 ;; esac\nexit 0')
        p = self.go()
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        calls = log.read_text()
        self.assertIn("pacman -S --needed --noconfirm", calls)
        for refresh in ("pacman -Sy", "pacman -Syu", "pacman -y"):
            self.assertNotIn(refresh, calls)
        for gone in ("useradd", "adduser", "userdel", "sudo -iu"):
            self.assertNotIn(gone, calls + p.stdout)

    def test_a_package_pacman_cannot_find_stops_with_the_full_upgrade_to_run_first(self):
        """0136-machine-bootstrap FR-053"""
        log = self.stubs('case "$1" in -Qi) exit 1 ;; -S) echo "error: target not found: github-cli" >&2; exit 1 ;; esac\nexit 0')
        p = self.go()
        self.assertEqual(p.returncode, 3, p.stdout + p.stderr)
        self.assertIn("sudo pacman -Syu", p.stdout + p.stderr)
        self.assertNotIn("Setting up archon in this account", p.stdout, "nothing else is done after the stop")
        self.assertNotIn("pacman -Sy ", log.read_text())


MAC_OFF = {**OFF_BUT_ARCHON, "BOOTSTRAP_NO_CLONE": "1", "BOOTSTRAP_NO_ARCHON": "1", "BOOTSTRAP_NO_DOTFILES": "1"}


def has_terminal():
    try:
        with open("/dev/tty"):
            return True
    except OSError:
        return False


@unittest.skipUnless(SH, "sh is not installed")
class MacOS(Fixture):
    """0136-machine-bootstrap FR-057 to FR-059: a Mac with Apple silicon, faked here with stand-ins for `uname`, `sw_vers`, `sysctl`, `xcode-select` and
    `dscl`; no CI runs on a Mac, so what only a Mac shows (Gatekeeper, `sysadminctl`, the Command Line Tools window) is tested by hand (OQ-7)."""

    def setUp(self):
        super().setUp()
        self.path = f"{self.bin}:{os.environ['PATH']}"

    def mac(self, machine="arm64", version="15.1", arm_hardware="1", clt=True):
        self.stub("uname", f'case "$1" in -s) echo Darwin ;; -m) echo {machine} ;; -r) echo 24.1.0 ;; *) echo Darwin ;; esac')
        self.stub("sw_vers", f'case "$1" in -productVersion) echo {version} ;; *) echo "ProductName: macOS" ;; esac')
        self.stub("sysctl", f'case "$2" in hw.optional.arm64) echo {arm_hardware} ;; hw.memsize) echo 17179869184 ;; kern.hv_vmm_present) echo 0 ;; *) exit 1 ;; esac')
        self.stub("xcode-select", "exit 0" if clt else "exit 2")
        self.path = f"{self.bin}:{os.environ['PATH']}"

    def setup(self, *argv, **extra):
        return subprocess.run([SH, str(SCRIPT), *argv], capture_output=True, text=True, env=self.env(PATH=self.path, **extra), stdin=subprocess.DEVNULL)

    def boot(self, *argv, **extra):
        return subprocess.run([SH, str(BOOT), *argv], capture_output=True, text=True, env=self.env(PATH=self.path, **extra), stdin=subprocess.DEVNULL)

    def call(self, code, **env):
        return subprocess.run([SH, "-c", f'. "{SCRIPT}"; arch=aarch64; goarch=arm64; goos=darwin; miseOs=macos; miseArch=arm64\n{code}'], capture_output=True, text=True,
                              env=self.env(BOOTSTRAP_SOURCE_ONLY="1", PATH=self.path, **env))

    def test_an_apple_silicon_mac_is_a_family_of_its_own_and_the_dry_run_names_what_differs(self):
        """FR-057, FR-059"""
        self.mac()
        before = tree(self.home)
        p = self.setup("--dry-run", "--comfort")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertEqual(tree(self.home), before)
        for text in ("macOS 15.1, aarch64", "xcode-select --install", f"jq {re.search(r'^JQ_VERSION=(.*)$', SCRIPT.read_text(), re.M).group(1)}", "Installing claude", "Skipped on a Mac"):
            self.assertIn(text, p.stdout, text)
        self.assertNotIn("sudo apt", p.stdout + p.stderr)
        self.assertNotIn("Installing fish 4", p.stdout, "fish has no build the setup can check on a Mac")
        self.assertNotIn("Installing btop", p.stdout, "btop publishes no build for a Mac")
        self.assertIn("Installing eza", p.stdout)

    def test_an_intel_mac_an_old_macos_and_a_missing_command_line_tools_each_stop_with_the_fix(self):
        """FR-057, 0003-runtime FR-027"""
        self.mac(machine="x86_64", arm_hardware="0")
        p = self.setup("--dry-run")
        self.assertEqual(p.returncode, 3)
        self.assertIn("Intel", p.stderr + p.stdout)
        self.assertIn("Linux virtual machine", p.stdout + p.stderr)
        self.mac(version="12.7")
        old = self.setup("--dry-run")
        self.assertEqual(old.returncode, 3)
        self.assertIn("macOS 13", old.stdout + old.stderr)
        self.mac(clt=False)
        none = self.setup(**{k: "1" for k in MAC_OFF})
        self.assertEqual(none.returncode, 3, none.stdout + none.stderr)
        self.assertIn("xcode-select --install", none.stdout + none.stderr)
        self.assertFalse((self.home / ".local" / "share" / "archon-setup" / "tools").exists(), "nothing was fetched")

    def test_a_terminal_under_rosetta_is_still_apple_silicon(self):
        self.mac(machine="x86_64", arm_hardware="1")
        p = self.setup("--dry-run")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("aarch64", p.stdout)

    def test_with_the_tools_here_the_setup_runs_on_a_mac_and_ends_with_zsh_to_start(self):
        """FR-057"""
        self.mac()
        self.stub("jq", "exit 0")
        self.stub("gh", "exit 0")
        p = self.setup(**{k: "1" for k in MAC_OFF})
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("macOS 15.1", p.stdout)
        self.assertIn("exec zsh -l", p.stdout)
        self.assertNotIn("exec fish", p.stdout)

    def test_the_scripts_use_no_option_only_gnu_tools_have_outside_the_branch_for_linux(self):
        """FR-057: bash 3.2 in POSIX mode and BSD sed, find, date, stat and tar"""
        import importlib.util
        spec = importlib.util.spec_from_file_location("shell_portability_check", HOME / "commons" / "tools" / "shell-portability-check.py")
        tool = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(tool)   # the rules are commons' (0004-rules), not a list kept in this test
        allowed = ('[ "$goos" = linux ]; then mv -Tf', "command -v sha256sum", "sha256sum()", "sha512sum \"$1\"", "sha256sum; }", "sha256sum \"$1\"", "base64 -d 2>/dev/null || base64 -D")
        for f in (SCRIPT, BOOT):
            self.assertEqual(tool.scan(f, allowed), [])

    def test_the_checksum_programs_are_shasum_where_sha256sum_is_absent(self):
        lean = self.tmp / "lean"
        lean.mkdir()
        for tool in ("cat", "cut", "tr", "sed", "awk", "grep", "date", "mktemp", "dirname", "id", "head", "tail", "mkdir", "rm", "wc", "env", "sh", "printf", "uname"):
            real = shutil.which(tool)
            if real:
                (lean / tool).symlink_to(real)
        real = shutil.which("sha256sum")
        (lean / "shasum").write_text(f'#!/bin/sh\n[ "$1" = -a ] && shift 2\nexec {real} "$@"\n')
        (lean / "shasum").chmod(0o755)
        f = self.tmp / "x"
        f.write_bytes(b"abc")
        p = subprocess.run([SH, "-c", f'. "{SCRIPT}"; sha_of "{f}"; command -v sha256sum >/dev/null 2>&1 && echo HAS'], capture_output=True, text=True,
                           env=self.env(BOOTSTRAP_SOURCE_ONLY="1", PATH=str(lean)))
        self.assertEqual(p.stdout.split()[0], hashlib.sha256(b"abc").hexdigest(), p.stderr)
        self.assertNotIn("HAS", p.stdout)

    def test_a_release_file_is_chosen_for_darwin_and_arm64_and_a_linux_one_never(self):
        """FR-059"""
        digest = lambda c: "sha256:" + c * 64   # noqa: E731
        rel = self.tmp / "rel.json"
        rel.write_text(json.dumps({"tag_name": "v1", "assets": [
            {"name": "tool-x86_64-unknown-linux-musl.tar.gz", "browser_download_url": "u/linux", "digest": digest("1")},
            {"name": "tool-x86_64-apple-darwin.tar.gz", "browser_download_url": "u/intel", "digest": digest("2")},
            {"name": "tool-aarch64-apple-darwin.tar.gz", "browser_download_url": "u/mac", "digest": digest("3")},
            {"name": "tool-aarch64-unknown-linux-musl.tar.gz", "browser_download_url": "u/armlinux", "digest": digest("4")}]}))
        p = self.call(f'candidate "{rel}" ""')
        self.assertEqual(p.stdout.split("\t")[1], "u/mac", p.stderr)
        only_linux = self.tmp / "linux.json"
        only_linux.write_text(json.dumps({"tag_name": "v1", "assets": [{"name": "tool-aarch64-unknown-linux-musl.tar.gz", "browser_download_url": "u/armlinux", "digest": digest("4")}]}))
        none = self.call(f'rc=0; candidate "{only_linux}" "" || rc=$?; cat "$work/why" >&2; exit $rc')
        self.assertNotEqual(none.returncode, 0)
        self.assertIn("no darwin file", none.stderr)

    def test_an_assistant_comes_from_the_darwin_arm64_package_of_npm(self):
        """FR-059"""
        asked = self.tmp / "asked"
        reg = self.tmp / "registry"
        (reg / "demo-meta").mkdir(parents=True)
        (reg / "demo-meta" / "latest").write_text(json.dumps({"version": "1.0.0"}))
        p = self.call(f'mkdir -p "$work" "$tools" "$bin"; fetch_to() {{ case $1 in */demo-meta/latest) cp "${{1#file://}}" "$2" ;; *) echo "$1" >>"{asked}"; return 1 ;; esac; }}; install_npm_native demo demo-meta "demo-{{os}}-{{arch}}@{{ver}}" demo; echo rc=$?',
                      BOOTSTRAP_NPM=f"file://{reg}")
        self.assertIn("demo-darwin-arm64/1.0.0", asked.read_text(), p.stdout + p.stderr)
        text = SCRIPT.read_text()
        for name in ("claude-code-{os}-{arch}", "@openai/codex@{ver}-{os}-{arch}", "opencode-{os}-{arch}"):
            self.assertIn(name, text)

    def test_a_pinned_zip_and_a_raw_program_are_installed_and_linked_where_mv_has_no_dash_t(self):
        """FR-057: gh is a zip with a folder in it, jq is the program alone; a second run with a new version replaces the link"""
        import zipfile

        z = self.tmp / "gh.zip"
        with zipfile.ZipFile(z, "w") as zf:
            info = zipfile.ZipInfo("gh_9.9.9_macOS_arm64/bin/gh")
            info.external_attr = 0o755 << 16
            zf.writestr(info, "#!/bin/sh\necho gh 9.9.9\n")
        raw = self.tmp / "jq-macos-arm64"
        raw.write_text("#!/bin/sh\necho jq 1\n")
        zsha, rsha = hashlib.sha256(z.read_bytes()).hexdigest(), hashlib.sha256(raw.read_bytes()).hexdigest()
        code = (f'mkdir -p "$tools" "$bin"; install_pinned gh 9.9.9 "file://{z}" {zsha} zip 0 gh=gh_9.9.9_macOS_arm64/bin/gh && '
                f'install_pinned jq 1 "file://{raw}" {rsha} raw 0 jq=jq && install_pinned jq 1 "file://{raw}" {rsha} raw 0 jq=jq && "$bin/gh" && "$bin/jq"')
        p = self.call(code)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn("gh 9.9.9", p.stdout)
        self.assertIn("jq 1", p.stdout)
        self.assertTrue((self.home / ".local" / "bin" / "gh").is_symlink())

    def test_only_the_newest_two_versions_of_a_tool_are_kept_without_find_printf(self):
        root = self.tmp / "tool"
        for i, v in enumerate(("1", "2", "3", "4")):
            (root / v).mkdir(parents=True)
            os.utime(root / v, (1000 + i, 1000 + i))
        (root / "current").symlink_to("4")
        (root / "5.partial").mkdir()
        p = self.call(f'prune_old "{root}" 4')
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(sorted(os.listdir(root)), ["3", "4", "5.partial", "current"])

    def test_the_bootstrap_installs_nothing_makes_no_account_and_runs_the_setup_in_this_one(self):
        """FR-058"""
        self.mac()
        p = self.boot("--dry-run")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        for text in ("xcode-select --install", "install no package", "Setting up archon in this account"):
            self.assertIn(text, p.stdout, text)
        for text in ("apt", "pacman", "chsh", "sysadminctl", "createhomedir", "account archon"):
            self.assertNotIn(text, p.stdout, text)
        self.stub("jq", "exit 0")
        self.stub("gh", "exit 0")
        run = self.boot(**{k: "1" for k in MAC_OFF})
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        self.assertIn("exec zsh -l", run.stdout)
        self.assertNotIn("login shell", run.stdout, "fish is not set up on a Mac")


DEBIAN13 = 'ID=debian\nPRETTY_NAME="Debian GNU/Linux 13 (trixie)"\nVERSION_ID=13\nVERSION_CODENAME=trixie\n'


@unittest.skipUnless(SH, "sh is not installed")
class Installation(Fixture):
    """0136-machine-bootstrap FR-060, FR-061: the record of how this account was set up, the checks before the long installs, and no drift between the two ways in."""

    def record(self):
        f = self.home / ".config" / "archon" / "install.toml"
        return f.read_text() if f.exists() else ""

    def osr(self):
        f = self.tmp / "os-release"
        f.write_text(DEBIAN13)
        return str(f)

    def test_the_setup_records_how_the_account_was_set_up_and_a_later_run_keeps_the_first_method(self):
        p = self.run_script(**OFF, BOOTSTRAP_OS_RELEASE=self.osr(), BOOTSTRAP_KIT="")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        text = self.record()
        for line in ('method = "setup"', 'family = "debian"', 'arch = "', 'comfort = false', 'distro = "Debian GNU/Linux 13 (trixie)"'):
            self.assertIn(line, text)
        self.assertRegex(text, r'installed = "\d{4}-\d\d-\d\d"')
        self.assertEqual((self.home / ".config" / "archon" / "install.toml").stat().st_mode & 0o777, 0o644)
        (self.home / ".config" / "archon" / "install.toml").write_text(text.replace('method = "setup"', 'method = "bootstrap"').replace('installed = "', 'installed = "2020-01-01" #').replace("comfort = false", "comfort = true"))
        self.run_script("--comfort", **OFF, BOOTSTRAP_OS_RELEASE=self.osr(), BOOTSTRAP_KIT="")
        again = self.record()
        self.assertIn('method = "bootstrap"', again, "the first method stays")
        self.assertIn("comfort = true", again, "a comfort kit once asked for is remembered")

    def test_the_bootstrap_records_itself_as_the_method(self):
        p = self.run_boot_with_stubs()
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertIn('method = "bootstrap"', self.record())
        self.assertIn("comfort = true", self.record(), "the bootstrap is opinionated")

    def run_boot_with_stubs(self):
        for name in ("sudo", "apt-get"):
            self.stub(name, "exit 0")
        return subprocess.run([SH, str(BOOT)], capture_output=True, text=True, stdin=subprocess.DEVNULL,
                              env=self.env(**OFF, BOOTSTRAP_OS_RELEASE=self.osr(), PATH=f"{self.bin}:{os.environ['PATH']}"))

    def test_a_dry_run_names_the_record_and_the_access_check_and_writes_none(self):
        p = self.run_script("--dry-run", BOOTSTRAP_OS_RELEASE=self.osr())
        self.assertIn("install.toml (setup)", p.stdout)
        self.assertIn("can open the private archon repository", p.stdout)
        self.assertEqual(self.record(), "")
        self.assertIn("install.toml (bootstrap)", subprocess.run([SH, str(BOOT), "--dry-run"], capture_output=True, text=True, env=self.env(BOOTSTRAP_OS_RELEASE=self.osr()), stdin=subprocess.DEVNULL).stdout)

    def test_an_account_that_cannot_open_archon_is_told_before_anything_is_installed(self):
        self.stub("git", 'echo "remote: Repository not found." >&2; echo "fatal: repository not found" >&2; exit 128')
        self.stub("gh", 'case "$1" in auth) exit 0 ;; api) echo someone ;; esac')
        p = self.run_script(BOOTSTRAP_NO_DOWNLOAD="1", BOOTSTRAP_NO_EDITOR="1", GH_TOKEN="ghp_example", PATH=f"{self.bin}:{os.environ['PATH']}", BOOTSTRAP_OS_RELEASE=self.osr())
        self.assertEqual(p.returncode, 5, p.stdout + p.stderr)
        self.assertIn("does not let this account open archon", p.stdout)
        self.assertIn("Nothing has been installed", p.stdout)
        self.assertEqual(self.record(), "", "stopped before the record, and before any installation")

    def test_a_network_failure_in_the_access_check_does_not_stop_the_setup(self):
        self.stub("git", 'echo "fatal: unable to access: Could not resolve host" >&2; exit 128')
        self.stub("gh", 'case "$1" in auth) exit 0 ;; esac')
        p = self.run_script(**OFF_BUT_ARCHON, BOOTSTRAP_NO_CLONE="1", GH_TOKEN="ghp_example", PATH=f"{self.bin}:{os.environ['PATH']}", BOOTSTRAP_OS_RELEASE=self.osr())
        self.assertNotIn("does not let this account open archon", p.stdout)

    def test_a_computer_with_too_little_room_or_run_as_root_is_warned_first(self):
        self.stub("df", 'echo "Filesystem 1K-blocks Used Available Use% Mounted"; echo "x 100 90 2097152 5% /"')
        p = self.run_script(**OFF, PATH=f"{self.bin}:{os.environ['PATH']}", BOOTSTRAP_OS_RELEASE=self.osr())
        self.assertIn("Only 2 GB are free", p.stdout + p.stderr)
        if os.geteuid() == 0:
            self.assertIn("This runs as root", p.stdout + p.stderr)


    def test_the_record_holds_only_what_the_setup_wrote_even_where_archon_is_on_the_path(self):
        """a backtick in a double-quoted header once ran `archon doctor` inside the setup and put its output in the file, so the record could not be read"""
        import tomllib

        marker = self.tmp / "ran"
        self.stub("archon", f'echo "ran $*" >>{marker}; echo "JUNK from archon $*"')
        p = self.run_script(**OFF, BOOTSTRAP_OS_RELEASE=self.osr(), BOOTSTRAP_KIT="", PATH=f"{self.bin}:{os.environ['PATH']}")
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertFalse(marker.exists(), "the setup ran archon while writing the record")
        parsed = tomllib.loads(self.record())
        self.assertEqual(parsed["method"], "setup")
        self.assertNotIn("JUNK", self.record())

    def test_no_script_line_runs_a_command_by_accident_with_an_unescaped_backtick(self):
        for f in (SCRIPT, BOOT):
            for n, line in enumerate(f.read_text().splitlines(), 1):
                code = re.sub(r"\s#\s.*$", "", line)
                if not line.lstrip().startswith("#"):
                    self.assertIsNone(re.search(r"(?<!\\)`", code), f"{f.name}:{n} has a backtick, which the shell runs as a command: {line.strip()}")

    def test_the_two_ways_in_run_the_same_steps_so_they_cannot_drift(self):
        """the bootstrap runs the setup's own code, in the same process: every step the setup lists with --comfort is a step of the bootstrap's plan, in the same order"""
        steps = lambda text: [l for l in text.splitlines() if l.startswith("  - ") or l.startswith("  would ")]   # noqa: E731
        setup = steps(self.run_script("--dry-run", "--comfort", BOOTSTRAP_OS_RELEASE=self.osr()).stdout)
        boot = steps(subprocess.run([SH, str(BOOT), "--dry-run"], capture_output=True, text=True, env=self.env(BOOTSTRAP_OS_RELEASE=self.osr()), stdin=subprocess.DEVNULL).stdout)
        self.assertGreater(len(setup), 20)
        it = iter(boot)
        for step in setup:
            if "install.toml (setup)" in step:
                step = step.replace("(setup)", "(bootstrap)")
            self.assertIn(step, it, f"the bootstrap's plan lacks, or reorders, a step of the setup's: {step}")
        extra = [b for b in boot if b not in setup]
        for b in extra:
            self.assertRegex(b, r"apt|package|administrator|login shell|chsh|fish|install.toml", f"a step only the bootstrap takes must be about packages or the login shell: {b}")


if __name__ == "__main__":
    unittest.main()
