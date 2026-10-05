"""`extension build` and the manifest and lint rules of `check extension` (0042-agora FR-032; 0043-if-console FR-027, FR-028)."""
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

import stat
import sys
from unittest import mock

from agora.core.resource import AgoraError
from agora.core.toolchain import Toolchain
from agora.lib import extension, vscode_tests
from agora.toolchain import vsce

from .helpers import HOME, run_json


class ExtensionRules(unittest.TestCase):
    def copy(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        dest = Path(tmp.name) / "tools" / "if-console"
        shutil.copytree(HOME / "tools" / "if-console", dest, ignore=shutil.ignore_patterns("node_modules"))
        return Path(tmp.name), dest

    def test_the_manifest_of_this_repository_is_valid(self):
        self.assertEqual([f.message for f in extension.manifest_findings(HOME)], [])

    def test_a_runtime_dependency_a_workspace_setting_and_an_untrusted_workspace_are_each_found(self):
        root, ext = self.copy()
        pkg = json.loads((ext / "package.json").read_text())
        pkg["dependencies"] = {"left-pad": "1.0.0"}
        pkg["contributes"]["configuration"]["properties"]["if-console.launchers"]["scope"] = "window"
        pkg["capabilities"]["untrustedWorkspaces"]["supported"] = True
        (ext / "package.json").write_text(json.dumps(pkg))
        found = " | ".join(f.message for f in extension.manifest_findings(root))
        self.assertIn("runtime dependencies", found)
        self.assertIn("scope application", found)
        self.assertIn("untrustedWorkspaces", found)

    def test_a_contributed_command_with_no_handler_is_found(self):
        root, ext = self.copy()
        pkg = json.loads((ext / "package.json").read_text())
        pkg["contributes"]["commands"].append({"command": "if-console.nothing", "title": "Nothing"})
        (ext / "package.json").write_text(json.dumps(pkg))
        self.assertTrue(any("if-console.nothing" in f.message for f in extension.manifest_findings(root)))

    def test_the_lock_pins_the_build_tool_with_integrity_hashes(self):
        self.assertEqual(vsce.lock_problems(), [])

    def test_build_dry_run_names_the_package_and_writes_nothing(self):
        done = subprocess.run([str(HOME / "agora"), "extension", "build", "--dry-run", "--json", "--no-log"], capture_output=True, text=True)
        doc = json.loads(done.stdout)  # a command of a group that pins packages runs in that group's own environment
        self.assertTrue(doc["data"]["dry_run"])
        self.assertEqual(doc["data"]["vsix"], f"build/{extension.vsix_name(HOME)}")
        self.assertEqual(doc["data"]["changes"][0]["path"], doc["data"]["vsix"])


class Runners(unittest.TestCase):
    """`check extension [--runner node|vscode]`: what could not run is skipped, never passed (0042 FR-013; 0043 FR-032)."""

    def check(self, *argv, use=None, vscode=None):
        patches = [mock.patch("agora.core.worker.needs_worker", return_value=False),
                   mock.patch.object(extension, "lint_findings", return_value=[]),
                   mock.patch.object(extension, "run_tests", return_value=([], ["node's test runner: 1 of 1 passed, 0 skipped"]))]
        if use is not None:
            patches.append(mock.patch.object(Toolchain, "use", use))
        if vscode is not None:
            patches.append(mock.patch.object(vscode_tests, "run", vscode))
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        code, doc = run_json(["check", "extension", *argv])
        return code, doc["data"]["sections"][0]

    def test_a_runner_of_the_design_systems_skips_this_section(self):
        code, sec = self.check("--runner", "browser")
        self.assertEqual((code, sec["status"]), (3, "skipped"))
        self.assertIn("design-systems", sec["reason"])

    def test_the_node_runner_never_touches_the_toolchain(self):
        def refuse(self, names):
            raise AssertionError("the node runner fetched " + ", ".join(names))
        code, sec = self.check("--runner", "node", use=refuse)
        self.assertEqual((code, sec["status"]), (0, "passed"))
        self.assertTrue(any("node's test runner" in n for n in sec["notes"]))

    def test_the_vscode_runner_skips_naming_the_cause_when_the_toolchain_cannot_be_had(self):
        def lacking(self, names):
            raise AgoraError("system-libraries", "vscode needs system libraries this host lacks (Xvfb); run `agora system add` once", exit=3)
        code, sec = self.check("--runner", "vscode", use=lacking)
        self.assertEqual((code, sec["status"]), (3, "skipped"))
        self.assertIn("agora system add", sec["reason"])

    def test_with_no_runner_a_part_that_could_not_run_makes_the_section_skipped_not_passed(self):
        def lacking(self, names):
            raise AgoraError("offline", "offline, and the toolchain cache lacks: vscode 1.140.0", exit=3)
        code, sec = self.check(use=lacking)
        self.assertEqual((code, sec["status"]), (3, "skipped"))
        self.assertTrue(any("node's test runner" in n for n in sec["notes"]), "what did run is still said")

    def test_no_display_server_is_a_skip_naming_the_setup_command(self):
        class Resolved:
            env = lambda self, extra=None: {}
            def path_of(self, name):
                return Path("/x") / name
        def display(*a, **kw):
            raise vscode_tests.DisplayError("Xvfb, the display server VS Code's tests start under, is not installed; run `agora system add` once")
        with mock.patch.object(extension, "package", return_value=mock.Mock(returncode=0)), \
                mock.patch("pathlib.Path.is_file", return_value=True):
            code, sec = self.check("--runner", "vscode", use=lambda self, names: Resolved(), vscode=display)
        self.assertEqual((code, sec["status"]), (3, "skipped"))
        self.assertIn("Xvfb", sec["reason"])

    def test_a_failing_vscode_test_fails_the_section_with_its_reason(self):
        class Resolved:
            env = lambda self, extra=None: {}
            def path_of(self, name):
                return Path("/x") / name
        from agora.core.checks import Finding
        failing = lambda *a, **kw: ([Finding("error", "tools/if-console/test/vscode", "fails in a real VS Code: trusted: a thing")], ["real VS Code: 0 of 1 tests passed"], [])
        with mock.patch.object(extension, "package", return_value=mock.Mock(returncode=0)), \
                mock.patch("pathlib.Path.is_file", return_value=True):
            code, sec = self.check("--runner", "vscode", use=lambda self, names: Resolved(), vscode=failing)
        self.assertEqual((code, sec["status"]), (1, "failed"))
        self.assertIn("fails in a real VS Code", sec["findings"][0]["message"])

    def test_the_design_systems_section_skips_the_extensions_runners(self):
        code, doc = run_json(["check", "design-systems", "--runner", "vscode"])
        sec = doc["data"]["sections"][0]
        self.assertEqual((code, sec["status"]), (3, "skipped"))


class VscodeRun(unittest.TestCase):
    """The runner starts a display server for the run, runs the tests on Node and reads the report (0043 FR-032)."""

    def fake_node(self, report):
        d = tempfile.TemporaryDirectory()
        self.addCleanup(d.cleanup)
        script = Path(d.name) / "node"
        script.write_text(f"#!{sys.executable}\nimport json, os\nopen(os.environ['IF_CONSOLE_VSCODE_REPORT'], 'w').write(json.dumps({report!r}))\n"
                          "assert os.environ['DISPLAY'] == ':77' and os.environ['IF_CONSOLE_VSIX'] == 'x.vsix' and os.environ['IF_CONSOLE_REAL_ROOT']\n")
        script.chmod(script.stat().st_mode | stat.S_IXUSR)
        return str(script)

    def run_with(self, report):
        class Display:
            name = ":77"
            def __enter__(self): return self
            def __exit__(self, *a): pass
        with mock.patch.object(vscode_tests, "Display", Display):
            return vscode_tests.run(HOME, self.fake_node(report), "/c/code", "/c/bin/code", "/c/test-electron", "x.vsix", {"PATH": "/usr/bin:/bin"})

    def test_a_report_of_passed_tests_is_notes_and_rows_and_no_findings(self):
        findings, notes, rows = self.run_with({"tests": [{"name": "trusted: a", "status": "passed", "seconds": 1.5}], "errors": []})
        self.assertEqual((findings, rows), ([], [{"name": "trusted: a", "status": "passed", "seconds": 1.5}]))
        self.assertIn("1 of 1 tests passed", notes[0])

    def test_a_failed_test_and_a_vscode_that_did_not_finish_are_findings(self):
        findings, notes, rows = self.run_with({"tests": [{"name": "trusted: a", "status": "failed", "seconds": 1, "reason": "AssertionError: no\n  at x"}],
                                               "errors": ["trusted: Test run failed with code 1"]})
        text = " | ".join(f.message for f in findings)
        self.assertIn("trusted: a: AssertionError: no", text)
        self.assertIn("VS Code did not finish: trusted: Test run failed with code 1", text)

    def test_a_run_that_ran_no_test_is_a_failure_not_a_pass(self):
        findings, notes, rows = self.run_with({"tests": [], "errors": []})
        self.assertTrue(any("ran no test" in f.message for f in findings))

    def test_without_xvfb_it_says_so_and_names_the_setup_command(self):
        with mock.patch("shutil.which", return_value=None):
            with self.assertRaises(vscode_tests.DisplayError) as e:
                with vscode_tests.Display():
                    pass
        self.assertIn("agora system add", str(e.exception))


class ExternalSuite(unittest.TestCase):
    """`extension test --suite DIR --workspace [NAME=]DIR` (0043 FR-034): another repository's suite, run in a workspace of this clone and its folders."""

    def setUp(self):
        d = tempfile.TemporaryDirectory()
        self.addCleanup(d.cleanup)
        self.tmp = Path(d.name)
        (self.tmp / "suite").mkdir()
        (self.tmp / "suite" / "index.js").write_text("exports.run = async () => {};\n")
        (self.tmp / "other").mkdir()

        class Resolved:
            env = lambda self, extra=None: {}
            def path_of(self, name):
                return Path("/x") / name
        self.resolved = Resolved()

    def go(self, *argv, vscode, use=None):
        patches = [mock.patch("agora.core.worker.needs_worker", return_value=False),
                   mock.patch.object(Toolchain, "use", use or (lambda _toolchain, names: self.resolved)),
                   mock.patch.object(Toolchain, "clean_env", lambda _toolchain: {}),
                   mock.patch("agora.groups.extension.commands._node", return_value="/n/node"),
                   mock.patch.object(vscode_tests, "run", vscode)]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        return run_json(["extension", "test", *argv, "--no-log"], env={"AGORA_PLAN_GROUP": "extension"})

    def test_the_suite_and_folders_are_passed_on_and_a_pass_is_a_resource(self):
        seen = {}

        def fake(home, node, code, cli, electron, vsix, env, folders=None, suite=None):
            seen.update(folders=folders, suite=suite, vsix=vsix)
            return [], ["real VS Code: 2 of 2 tests passed in 1.0s"], [{"name": "x: a", "status": "passed", "seconds": 1}, {"name": "x: b", "status": "passed", "seconds": 1}]
        report = self.tmp / "r.json"
        code, doc = self.go("--suite", str(self.tmp / "suite"), "--workspace", f"other={self.tmp / 'other'}", "--workspace", str(self.tmp / "suite"),
                            "--report", str(report), vscode=fake)
        self.assertEqual(code, 0, doc)
        self.assertEqual(seen["suite"], str((self.tmp / "suite").resolve()))
        self.assertEqual([n for n, _ in seen["folders"]], ["other", "suite"], "NAME=PATH names a folder; a bare path is named by its last part")
        self.assertEqual(doc["data"]["passed"], 2)
        self.assertEqual(json.loads(report.read_text())["tests"][0]["name"], "x: a")

    def test_a_failed_test_exits_1_naming_it(self):
        from agora.core.checks import Finding
        failing = lambda *a, **kw: ([Finding("error", "x", "fails in a real VS Code: x: a: nope")], [], [{"name": "x: a", "status": "failed", "seconds": 1}])
        code, doc = self.go("--suite", str(self.tmp / "suite"), vscode=failing)
        self.assertEqual(code, 1)
        self.assertIn("nope", json.dumps(doc))

    def test_no_display_server_exits_3_naming_the_setup_command(self):
        def display(*a, **kw):
            raise vscode_tests.DisplayError("Xvfb is not installed; run `agora system add` once")
        code, doc = self.go("--suite", str(self.tmp / "suite"), vscode=display)
        self.assertEqual(code, 3)
        self.assertIn("agora system add", json.dumps(doc))

    def test_a_suite_with_no_index_and_a_folder_that_is_not_one_are_usage_errors(self):
        code, _ = self.go("--suite", str(self.tmp), vscode=lambda *a, **k: ([], [], []))
        self.assertEqual(code, 2)
        code, _ = self.go("--suite", str(self.tmp / "suite"), "--workspace", str(self.tmp / "nope"), vscode=lambda *a, **k: ([], [], []))
        self.assertEqual(code, 2)


if __name__ == "__main__":
    unittest.main()
