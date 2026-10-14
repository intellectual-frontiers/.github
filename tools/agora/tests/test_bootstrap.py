"""The machine bootstrap (0053-machine-bootstrap): `bin/bootstrap-archon.sh` and the data beside it, tested without root, apt or the network.

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

from .helpers import HOME

BIN = HOME / "bin"
SCRIPT = BIN / "bootstrap-archon.sh"
MANAGED = BIN / "bootstrap" / "managed.sh"
THEMES = BIN / "bootstrap" / "themes"
SH = shutil.which("sh")

# every switch that stops an installation, so that a run changes nothing but the workspaces folder and the script's own directories
OFF = {"BOOTSTRAP_NO_APT": "1", "BOOTSTRAP_NO_DOWNLOAD": "1", "BOOTSTRAP_NO_DOTFILES": "1", "BOOTSTRAP_NO_AUTH": "1", "BOOTSTRAP_NO_CHSH": "1",
       "BOOTSTRAP_NO_CLONE": "1", "BOOTSTRAP_NO_ARCHON": "1", "BOOTSTRAP_NO_RUNTIME": "1"}


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
        env = {k: v for k, v in os.environ.items() if not k.startswith(("BOOTSTRAP_", "WS_HOST_", "XDG_")) and k not in ("NO_COLOR", "GH_TOKEN", "GITHUB_TOKEN")}
        env.update(HOME=str(self.home), TERM="dumb", LANG="C", TMPDIR=str(self.tmp))
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
    def test_the_files_exist_and_the_script_is_posix_sh(self):
        text = SCRIPT.read_text()
        self.assertEqual(text.splitlines()[0], "#!/bin/sh")
        self.assertTrue(os.access(SCRIPT, os.X_OK))
        bashism = re.compile(r"\[\[ | \]\]|<<<|\$\{!|\$\(\(.*\+\+|(^|[;&|(]\s*)(source|local|declare|typeset|function|mapfile|readarray|shopt)\s")
        for line in text.splitlines():
            if not line.lstrip().startswith("#"):
                self.assertIsNone(bashism.search(line), f"a bashism in: {line}")
        for t in ("ws-host-pretty", "ws-host-plain"):
            json.loads((THEMES / f"{t}.omp.json").read_text())

    def test_it_parses_in_every_posix_shell_here(self):
        for shell in ("sh", "dash", "bash", "ash"):
            exe = shutil.which(shell)
            if not exe:
                continue
            for f in (SCRIPT, MANAGED):
                with self.subTest(shell=shell, file=f.name):
                    p = subprocess.run([exe, "-n", str(f)], capture_output=True, text=True)
                    self.assertEqual(p.returncode, 0, p.stderr)

    @unittest.skipUnless(shutil.which("shellcheck"), "shellcheck is not installed")
    def test_shellcheck_passes(self):
        p = subprocess.run(["shellcheck", "-s", "sh", str(SCRIPT), str(MANAGED)], capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stdout)

    def test_the_pins_are_whole_and_follow_the_toolchain_this_repository_declares(self):
        text = SCRIPT.read_text()
        sums = re.findall(r"^([A-Z]+)_SHA256_(X86_64|AARCH64)=(\S+)$", text, re.M)
        self.assertEqual(sorted({n for n, _, _ in sums}), ["CHEZMOI", "FISH", "GLAB", "MISE", "POSH"])
        for name, arch, digest in sums:
            self.assertRegex(digest, r"^[0-9a-f]{64}$", f"{name} {arch}")
        self.assertEqual(len(sums), 10)
        for entry, var in (("uv", "UV_VERSION"), ("python", "PYTHON_VERSION")):
            declared = re.search(r'^version = "(.+)"$', (HOME / ".workspaces-host" / "toolchain.d" / f"{entry}.toml").read_text(), re.M).group(1)
            self.assertEqual(re.search(rf"^{var}=(\S+)$", text, re.M).group(1), declared, f"{var} follows toolchain.d/{entry}.toml")


@unittest.skipUnless(SH, "sh is not installed")
class Entry(Fixture):
    def test_help_and_a_bad_option(self):
        p = self.run_script("--help")
        self.assertEqual(p.returncode, 0)
        self.assertIn("curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/bootstrap-archon.sh | sh", p.stdout)
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
        for step in ("Installing Oh My Posh", "Installing chezmoi", "archon doctor", "archon toolchain ensure", "archon check", "intellectual-frontiers/archon",
                     "gh auth login --hostname github.com --web --skip-browser --git-protocol https", "login shell"):
            self.assertIn(step, p.stdout)
        self.assertNotIn("\x1b", p.stdout + p.stderr, "no colour away from a terminal")

    def test_dry_run_follows_the_switches(self):
        p = self.run_script("--dry-run", **OFF)
        self.assertEqual(p.returncode, 0, p.stderr)
        for gone in ("Installing Oh My Posh", "Installing chezmoi", "intellectual-frontiers/archon", "archon doctor", "login shell"):
            self.assertNotIn(gone, p.stdout, f"{gone} is switched off")

    def test_dry_run_lists_the_same_steps_from_a_pipe(self):
        piped = subprocess.run([SH, "-s", "--", "--dry-run"], input=SCRIPT.read_text(), capture_output=True, text=True, env=self.env(BOOTSTRAP_URL=f"file://{HOME}"))
        self.assertEqual(piped.returncode, 0, piped.stderr)
        self.assertEqual(piped.stdout, self.run_script("--dry-run").stdout.replace(str(SCRIPT), "sh"))

    def test_the_nerd_font_hint_comes_with_the_pretty_prompt_and_not_with_the_plain_one(self):
        base = {k: v for k, v in OFF.items() if k != "BOOTSTRAP_NO_DOTFILES"}
        pretty = self.run_script(**base, BOOTSTRAP_KIT="shell", WS_HOST_HOME=str(self.tmp / "w"))
        self.assertEqual(pretty.returncode, 0, pretty.stderr)
        for line in ("Nerd Font", "CaskaydiaCove Nerd Font", "Install for all users", "Windows Terminal", "BOOTSTRAP_PROMPT=plain"):
            self.assertIn(line, pretty.stdout)
        plain = self.run_script(**base, BOOTSTRAP_KIT="shell", BOOTSTRAP_PROMPT="plain", WS_HOST_HOME=str(self.tmp / "w"))
        self.assertNotIn("Nerd Font", plain.stdout)

    def test_the_prompt_and_kit_choices_change_the_plan(self):
        p = self.run_script("--dry-run", BOOTSTRAP_KIT="shell", BOOTSTRAP_PROMPT="no", WS_HOST_MODERN="no")
        self.assertNotIn("Everyday tools", p.stdout)
        self.assertNotIn("Embedded SQL", p.stdout)
        self.assertIn("Your prompt and commands stay yours", p.stdout)


@unittest.skipUnless(SH, "sh is not installed")
class Colour(Fixture):
    """0053-machine-bootstrap FR-026: an environment variable name in a message is bright yellow where there is colour."""

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
        self.assertEqual([m for m in made if (self.home / m).is_file() and not m.startswith(".archon-bootstrap/log/")], [], "folders only: no file of the person's changes, but the log")
        self.assertTrue(any(m.startswith(".archon-bootstrap/log/bootstrap-") for m in made), "everything is logged to ~/.archon-bootstrap/log/")
        again = self.run_script(**OFF, BOOTSTRAP_KIT="")
        self.assertEqual(again.returncode, 0)
        without_logs = lambda names: [m for m in names if not m.startswith(".archon-bootstrap/log/")]
        self.assertEqual(without_logs(tree(self.home)), without_logs(made), "a second run changes nothing (but writes its own log)")

    def test_the_workspaces_folder_can_be_named(self):
        p = self.run_script(**OFF, BOOTSTRAP_KIT="", WS_HOST_HOME=str(self.tmp / "elsewhere"))
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertTrue((self.tmp / "elsewhere" / "github.com" / "intellectual-frontiers").is_dir())
        self.assertFalse((self.home / "workspaces").exists())

    def test_the_workspaces_folder_can_be_named_in_the_ws_host_file(self):
        cfg = self.home / ".config" / "workspaces-host"
        cfg.mkdir(parents=True)
        (cfg / "ws-host.env").write_text(f'WS_HOST_WORKSPACES="{self.tmp / "named"}"\n')
        self.assertEqual(self.run_script(**OFF, BOOTSTRAP_KIT="").returncode, 0)
        self.assertTrue((self.tmp / "named" / "github.com" / "intellectual-frontiers").is_dir())


@unittest.skipUnless(SH and shutil.which("git") and shutil.which("jq"), "sh, git and jq are needed")
class Clone(Fixture):
    """The clone, its fast-forward-only update and the three archon commands, against a local repository with a stand-in launcher."""

    LAUNCHER = """#!/bin/sh
[ "$1 $2" = "toolchain list" ] || echo "ARCHON $* assume_yes=${ARCHON_ASSUME_YES:-}" >>"${CALLS:?}"
case "$1 $2" in
  "toolchain list") echo '{"data":{"entries":[{"name":"node","ready":true,"summary":"Node.js"},{"name":"python","ready":false,"summary":"Python"},{"name":"docker","ready":false,"summary":"Docker (optional: only an image needs it)"},{"name":"jre","ready":false,"summary":"A Java runtime"}]}}' ;;
esac
[ "$1" = check ] && [ -n "${FAKE_FAIL:-}" ] && exit 4
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
        off = {k: v for k, v in OFF.items() if k not in ("BOOTSTRAP_NO_CLONE", "BOOTSTRAP_NO_ARCHON")}
        self.calls = self.tmp / "archon-calls.txt"
        self.calls.write_text("")
        return self.run_script(**off, BOOTSTRAP_KIT="", ARCHON_URL=str(self.upstream), CALLS=str(self.calls), PATH=f"{self.bin}:{os.environ['PATH']}", **extra)

    def push(self, name, text="x\n"):
        (self.upstream / name).write_text(text)
        git("add", name, cwd=self.upstream)
        git("commit", "-qm", name, cwd=self.upstream)

    def test_it_copies_archon_runs_its_three_commands_and_says_what_is_next(self):
        p = self.go()
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertTrue((self.clone / "archon").is_file())
        out = p.stdout
        calls = self.calls.read_text()
        order = [calls.index(c) for c in ("toolchain ensure python jre", "doctor", "check")]
        self.assertEqual(order, sorted(order), "toolchain ensure, then doctor, then check")
        self.assertNotIn("ensure python docker", calls, "what is not ready and not optional")
        self.assertEqual(calls.count("assume_yes=1"), 3, "every question archon could ask is answered yes")
        self.assertIn("archon orch status", out)
        self.assertIn("archon orch dev", out)
        wrapper = self.home / ".local" / "bin" / "archon"
        self.assertIn(str(self.clone / "archon"), wrapper.read_text())
        self.assertTrue(os.access(wrapper, os.X_OK))

    def test_the_toolchain_can_be_named_or_skipped(self):
        self.go(BOOTSTRAP_TOOLCHAIN="node")
        self.assertIn("ARCHON toolchain ensure node", self.calls.read_text())
        self.go(BOOTSTRAP_TOOLCHAIN="none")
        self.assertNotIn("ARCHON toolchain ensure", self.calls.read_text())

    def test_all_three_commands_run_when_one_fails_and_the_status_says_so(self):
        p = self.go(FAKE_FAIL="1")
        self.assertEqual(p.returncode, 1)
        calls = self.calls.read_text()
        for name in ("doctor", "toolchain ensure", "check"):
            self.assertIn(f"ARCHON {name}", calls)
        self.assertRegex(p.stdout, r"(x|❌).*\./archon check \(exit status 4\)")

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
        self.assertIn("gh auth login --hostname github.com --web --skip-browser --git-protocol https", p.stdout)
        self.assertIn(".archon-bootstrap/log/", p.stdout)
        self.assertFalse(self.clone.exists())

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


@unittest.skipUnless(SH, "sh is not installed")
class Managed(Fixture):
    """bin/bootstrap/managed.sh: the marked blocks, as a filter from a file's text to its new text."""

    def filter(self, text, *argv, **env):
        return subprocess.run([SH, str(MANAGED), *argv], input=text, capture_output=True, text=True, env=self.env(**env))

    def test_a_block_is_added_after_what_is_there_and_a_second_run_changes_nothing(self):
        first = self.filter("export A=1\n", "bash", "$HOME/t.json", "modern-bash", "icons").stdout
        self.assertTrue(first.startswith("export A=1\n\n# >>> workspaces-host: prompt (ws-host shell add bash) >>>\n"))
        self.assertIn('eval "$(oh-my-posh init bash --config "$HOME/t.json")"', first)
        self.assertIn("alias ll='eza -l --group-directories-first --git --icons=auto'", first)
        self.assertEqual(first.count("# <<< workspaces-host <<<"), 2)
        self.assertEqual(self.filter(first, "bash", "$HOME/t.json", "modern-bash", "icons").stdout, first)

    def test_plain_leaves_the_icons_out_and_fish_gets_its_own_syntax(self):
        out = self.filter("", "fish", "$HOME/p.json", "modern-fish", "plain").stdout
        self.assertIn('oh-my-posh init fish --config "$HOME/p.json" | source', out)
        self.assertIn("alias ll 'eza -l --group-directories-first --git'", out)
        self.assertNotIn("icons", out.replace("Icons need", ""))

    def test_git_gets_its_block_first_so_that_the_persons_own_settings_win(self):
        out = self.filter("[user]\n\tname = X\n", "modern-git", "icons").stdout
        self.assertTrue(out.startswith("# >>> workspaces-host: modern-cli"))
        self.assertTrue(out.endswith("[user]\n\tname = X\n"))
        self.assertIn("pager = delta", out)

    def test_an_existing_prompt_block_is_replaced_or_kept_as_asked(self):
        have = self.filter("", "bash", "$HOME/mine.json").stdout
        self.assertIn("$HOME/new.json", self.filter(have, "bash", "$HOME/new.json").stdout)
        kept = self.filter(have, "bash", "$HOME/new.json", BOOTSTRAP_KEEP_BLOCK="1").stdout
        self.assertEqual(kept, have)

    def test_a_block_that_lost_its_end_line_is_left_alone(self):
        cut = "export A=1\n# >>> workspaces-host: prompt (ws-host shell add bash) >>>\nmine\n"
        self.assertEqual(self.filter(cut, "bash", "$HOME/t.json").stdout, cut)

    def test_text_outside_the_markers_is_never_touched(self):
        have = self.filter("a\nb\n", "bash", "$HOME/t.json").stdout
        edited = "top\n" + have + "bottom\n"
        out = self.filter(edited, "bash", "$HOME/other.json").stdout
        self.assertTrue(out.startswith("top\na\nb\n") and out.endswith("bottom\n"))

    def test_an_unknown_kind_fails(self):
        self.assertNotEqual(self.filter("", "nonsense", "x").returncode, 0)


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
        self.assertFalse((self.home / ".cache" / "workspaces-host" / "downloads" / ("0" * 64)).exists())

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


@unittest.skipUnless(SH and shutil.which("curl"), "sh and curl are needed")
class Data(Fixture):
    """The data files come from beside the script in a checkout and from BOOTSTRAP_URL in a pipe."""

    def fetch(self, as_file, dest):
        """Source the script as $0 = as_file (a path ending in bootstrap-archon.sh is a checkout; `sh` is a pipe) and ask for one data file."""
        code = f'. "{SCRIPT}"; data_file themes/ws-host-pretty.omp.json "{dest}"'
        return subprocess.run([SH, "-c", code, as_file], capture_output=True, text=True,
                              env=self.env(BOOTSTRAP_SOURCE_ONLY="1", BOOTSTRAP_URL=f"file://{self.tmp / 'remote'}"))

    def test_a_checkout_uses_the_copies_beside_the_script_and_a_pipe_fetches_them(self):
        pretty = (THEMES / "ws-host-pretty.omp.json").read_text()
        remote = self.tmp / "remote" / "bin" / "bootstrap" / "themes"
        remote.mkdir(parents=True)
        (remote / "ws-host-pretty.omp.json").write_text('{"from": "remote"}')
        # a checkout: the folder beside the script is used, whatever BOOTSTRAP_URL says
        p = self.fetch(str(SCRIPT), self.tmp / "checkout.json")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual((self.tmp / "checkout.json").read_text(), pretty)
        # a pipe: $0 is the shell, so the files come from BOOTSTRAP_URL
        p = self.fetch("sh", self.tmp / "piped.json")
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual((self.tmp / "piped.json").read_text(), '{"from": "remote"}')


class Readme(unittest.TestCase):
    def test_the_readme_has_the_section_with_the_command_and_the_terms_defined(self):
        text = (HOME / "README.md").read_text()
        self.assertIn("## Set up a new computer", text)
        section = text.split("## Set up a new computer", 1)[1].split("\n## ", 1)[0]
        self.assertIn("curl -fsSL https://raw.githubusercontent.com/intellectual-frontiers/.github/main/bin/bootstrap-archon.sh | sh", section)
        for term in ("WSL", "chezmoi", "Oh My Posh", "Nerd Font", "fish", "login shell", "workspace"):
            self.assertIn(term, section, term)
        self.assertIn("archon orch status", section)
        self.assertIn("archon orch dev", section)
        for need in ("internet", "GitHub", "Debian"):
            self.assertIn(need, section)


class Optional(unittest.TestCase):
    def test_nothing_in_this_repository_calls_or_needs_the_bootstrap(self):
        """0053-machine-bootstrap FR-023: no workflow, hook or agora command refers to it (the layout check names it only to allow it)."""
        places = [*(HOME / ".github" / "workflows").glob("*.y*ml"), *(HOME / ".claude").rglob("*.json"), *(HOME / ".claude" / "hooks").glob("*"),
                  *(p for p in (HOME / "tools" / "agora").rglob("*") if p.is_file() and p.suffix in (".py", ".toml") and "tests" not in p.parts and p.name != "layout.py")]
        self.assertTrue(places)
        for f in places:
            with self.subTest(file=str(f.relative_to(HOME))):
                self.assertNotIn("bootstrap-archon", f.read_text(errors="replace"))


if __name__ == "__main__":
    unittest.main()


@unittest.skipUnless(SH, "sh is not installed")
class Stops(Fixture):
    """0053-machine-bootstrap FR-028 to FR-030: a failed step stops the setup, is logged, and says where to look and how to ask for help."""

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
class Pool(Fixture):
    """0053-machine-bootstrap FR-032: tools that do not touch each other are fetched at the same time, each in a work folder of its own; a failure stops the setup."""

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
