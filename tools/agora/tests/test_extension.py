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
from agora.toolchain import extension_build

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

    def mutated(self, change):
        root, ext = self.copy()
        pkg = json.loads((ext / "package.json").read_text())
        change(pkg)
        (ext / "package.json").write_text(json.dumps(pkg))
        return " | ".join(f.message for f in extension.manifest_findings(root))

    def test_the_redesigned_consoles_manifest_rules_each_find_what_they_name(self):
        """0043 FR-036 to FR-039, FR-024, FR-040: the views, the welcome content, the commands, the keys, the menus' groups and the settings."""
        def views(p):
            p["contributes"]["views"]["if-console"].reverse()
        self.assertIn("the views are", self.mutated(views))

        def shown(p):
            p["contributes"]["views"]["if-console"][-1].pop("when")
        self.assertIn("All commands must be hidden by default", self.mutated(shown))

        def key(p):
            p["contributes"]["keybindings"].append({"command": "if-console.runCommand", "key": "ctrl+alt+i r"})
        self.assertIn("a key may run only", self.mutated(key))

        def setting(p):
            p["contributes"]["configuration"]["properties"]["if-console.rowLimit"].pop("markdownDescription")
        self.assertIn("must have a markdownDescription", self.mutated(setting))

        def command(p):
            c = p["contributes"]["commands"][1]
            c["category"], c["icon"], c["title"] = "Other", "", "Stuff"
            p["contributes"]["menus"]["commandPalette"] = [m for m in p["contributes"]["menus"]["commandPalette"] if m["command"] != c["command"]]
            c.pop("enablement", None)
        found = self.mutated(command)
        for want in ("must have the category IF Console", "must have an icon", "must be a verb and an object", "must have an enablement or a palette `when`"):
            self.assertIn(want, found)

        def welcome(p):
            p["contributes"]["viewsWelcome"] = [w for w in p["contributes"]["viewsWelcome"] if "untrusted" not in w["when"] or "!" in w["when"]]
        self.assertIn("welcome content for an untrusted workspace", self.mutated(welcome))

        def group(p):
            p["contributes"]["menus"]["view/item/context"][0]["group"] = "somewhere@1"
        self.assertIn("a row's menus use", self.mutated(group))

    def test_the_activity_bar_icon_draws_in_current_color_and_no_other(self):
        root, ext = self.copy()
        (ext / "media" / "if-console.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"><path stroke="#ff0000" d="M0 0"/></svg>')
        self.assertIn("currentColor and no other color", " | ".join(f.message for f in extension.manifest_findings(root)))

    def test_a_contributed_command_with_no_handler_is_found(self):
        root, ext = self.copy()
        pkg = json.loads((ext / "package.json").read_text())
        pkg["contributes"]["commands"].append({"command": "if-console.nothing", "title": "Nothing"})
        (ext / "package.json").write_text(json.dumps(pkg))
        self.assertTrue(any("if-console.nothing" in f.message for f in extension.manifest_findings(root)))

    def test_the_lock_pins_every_build_tool_at_one_version_with_integrity_hashes(self):
        self.assertEqual(extension_build.lock_problems(), [])

    def test_build_dry_run_names_the_package_and_writes_nothing(self):
        done = subprocess.run([str(HOME / "agora"), "extension", "build", "--dry-run", "--json", "--no-log"], capture_output=True, text=True)
        doc = json.loads(done.stdout)  # a command of a group that pins packages runs in that group's own environment
        self.assertTrue(doc["data"]["dry_run"])
        self.assertEqual(doc["data"]["vsix"], f"build/{extension.vsix_name(HOME)}")
        self.assertEqual(doc["data"]["changes"][0]["path"], doc["data"]["vsix"])


class Modules(unittest.TestCase):
    """`extension build --modules DIR` (0043 FR-047): the compiled modules for another repository's tests."""

    def test_the_export_copies_the_source_modules_and_the_stub_and_not_the_unit_tests(self):
        with tempfile.TemporaryDirectory() as t:
            stage, dest = Path(t, "stage"), Path(t, "dest")
            for rel in ("src/app.js", "src/model/wire.js", "test/support/vscode-stub.js", "test/app.test.js"):
                f = stage / "out" / rel
                f.parent.mkdir(parents=True, exist_ok=True)
                f.write_text("x")
            (dest / "src").mkdir(parents=True)
            (dest / "src" / "stale.js").write_text("old")
            files = extension.export_modules(stage, dest)
            self.assertEqual(files, ["src/app.js", "src/model/wire.js", "test/support/vscode-stub.js"])
            self.assertFalse((dest / "src" / "stale.js").exists())
            self.assertFalse((dest / "test" / "app.test.js").exists())

    def test_the_command_builds_in_the_staged_copy_and_writes_into_the_folder(self):
        with tempfile.TemporaryDirectory() as t:
            dest = Path(t, "mods")
            seen = {}

            def export(stage_dir, to):
                seen["to"] = to
                return ["src/app.js"]
            with mock.patch("agora.core.worker.needs_worker", return_value=False), \
                    mock.patch.object(Toolchain, "use", lambda _t, names: FakeTools()), \
                    mock.patch.object(extension, "stage", return_value=Path("/stage")), \
                    mock.patch.object(extension, "compile_tests", return_value=[]) as compiled, \
                    mock.patch.object(extension, "export_modules", export), \
                    mock.patch("agora.groups.extension.commands._node", return_value="/n/node"):
                code, doc = run_json(["extension", "build", "--modules", str(dest), "--no-log"], env={"AGORA_PLAN_GROUP": "extension"})
            self.assertEqual(code, 0, doc)
            self.assertEqual((seen["to"], doc["data"]["files"]), (dest.resolve(), ["src/app.js"]))
            self.assertTrue(compiled.called)
            self.assertNotIn("vsix", doc["data"])

    def test_dry_run_names_the_folder_and_writes_nothing(self):
        with tempfile.TemporaryDirectory() as t:
            dest = Path(t, "mods")
            done = subprocess.run([str(HOME / "agora"), "extension", "build", "--modules", str(dest), "--dry-run", "--json", "--no-log"], capture_output=True, text=True)
            doc = json.loads(done.stdout)
            self.assertEqual((doc["data"]["modules"], doc["data"]["dry_run"]), (str(dest.resolve()), True))
            self.assertFalse(dest.exists())


class FakeTools:
    """What the toolchain hands over, without a cache: every program is a path under /x, and the extension's staging and programs are patched out."""

    def env(self, extra=None):
        return {}

    def path_of(self, name):
        return Path("/x") / name


class Runners(unittest.TestCase):
    """`check extension [--runner node|vscode]`: what could not run is skipped, never passed (0042 FR-013; 0043 FR-032)."""

    def check(self, *argv, use=None, vscode=None, typecheck=None):
        patches = [mock.patch("agora.core.worker.needs_worker", return_value=False),
                   mock.patch.object(extension, "stage", return_value=Path("/stage")),
                   mock.patch.object(extension, "source_findings", return_value=[]),
                   mock.patch.object(extension, "codicon_findings", return_value=[]),
                   mock.patch.object(extension, "typecheck", return_value=typecheck or []),
                   mock.patch.object(extension, "lint", return_value=[]),
                   mock.patch.object(extension, "bundle", return_value=[]),
                   mock.patch.object(extension, "compile_tests", return_value=[]),
                   mock.patch.object(extension, "run_tests", return_value=([], ["node's test runner: 1 of 1 passed, 0 skipped"]))]
        patches.append(mock.patch.object(Toolchain, "use", use or (lambda _toolchain, names: FakeTools())))
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

    def test_the_node_runner_uses_the_extensions_build_entry_and_never_vscode(self):
        asked = []

        def use(self, names):
            asked.append(list(names))
            return FakeTools()
        code, sec = self.check("--runner", "node", use=use)
        self.assertEqual((code, sec["status"]), (0, "passed"))
        self.assertEqual(asked, [["extension-build"]])
        self.assertTrue(any("node's test runner" in n for n in sec["notes"]))
        self.assertTrue(any("tsc" in n and "ESLint" in n for n in sec["notes"]))

    def test_a_type_error_fails_the_section_where_it_is(self):
        from agora.core.checks import Finding
        code, sec = self.check("--runner", "node", typecheck=[Finding("error", "tools/if-console/src/app.ts:3", "type error TS2322: nope")])
        self.assertEqual((code, sec["status"]), (1, "failed"))
        self.assertEqual(sec["findings"][0]["where"], "tools/if-console/src/app.ts:3")

    def test_without_the_build_entry_the_section_is_skipped_naming_the_cause_and_what_could_run_is_still_said(self):
        def lacking(self, names):
            raise AgoraError("offline", "offline, and the toolchain cache lacks: extension-build", exit=3)
        code, sec = self.check("--runner", "node", use=lacking)
        self.assertEqual((code, sec["status"]), (3, "skipped"))
        self.assertIn("extension-build", sec["reason"])
        self.assertTrue(any("manifest and source rules" in n for n in sec["notes"]))

    def test_the_vscode_runner_skips_naming_the_cause_when_the_toolchain_cannot_be_had(self):
        def lacking(self, names):
            if "vscode" in names:
                raise AgoraError("system-libraries", "vscode needs system libraries this host lacks (Xvfb); run `agora system add` once", exit=3)
            return FakeTools()
        code, sec = self.check("--runner", "vscode", use=lacking)
        self.assertEqual((code, sec["status"]), (3, "skipped"))
        self.assertIn("agora system add", sec["reason"])

    def test_with_no_runner_a_part_that_could_not_run_makes_the_section_skipped_not_passed(self):
        def lacking(self, names):
            if "vscode" in names:
                raise AgoraError("offline", "offline, and the toolchain cache lacks: vscode 1.140.0", exit=3)
            return FakeTools()
        code, sec = self.check(use=lacking)
        self.assertEqual((code, sec["status"]), (3, "skipped"))
        self.assertTrue(any("node's test runner" in n for n in sec["notes"]), "what did run is still said")

    def test_no_display_server_is_a_skip_naming_the_setup_command(self):
        def display(*a, **kw):
            raise vscode_tests.DisplayError("Xvfb, the display server VS Code's tests start under, is not installed; run `agora system add` once")
        with mock.patch.object(extension, "package", return_value=mock.Mock(returncode=0)), \
                mock.patch("pathlib.Path.is_file", return_value=True):
            code, sec = self.check("--runner", "vscode", vscode=display)
        self.assertEqual((code, sec["status"]), (3, "skipped"))
        self.assertIn("Xvfb", sec["reason"])

    def test_a_failing_vscode_test_fails_the_section_with_its_reason(self):
        from agora.core.checks import Finding
        failing = lambda *a, **kw: ([Finding("error", "tools/if-console/test/vscode", "fails in a real VS Code: trusted: a thing")], ["real VS Code: 0 of 1 tests passed"], [])
        with mock.patch.object(extension, "package", return_value=mock.Mock(returncode=0)), \
                mock.patch("pathlib.Path.is_file", return_value=True):
            code, sec = self.check("--runner", "vscode", vscode=failing)
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
            def __init__(self, fbdir=None): pass
            def __enter__(self): return self
            def __exit__(self, *a): pass
        with mock.patch.object(vscode_tests, "Display", Display):
            return vscode_tests.run(HOME, HOME / "tools" / "if-console", self.fake_node(report), "/c/code", "/c/bin/code", "/c/test-electron", "x.vsix", {"PATH": "/usr/bin:/bin"})

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

        self.resolved = FakeTools()

    def go(self, *argv, vscode, use=None):
        patches = [mock.patch("agora.core.worker.needs_worker", return_value=False),
                   mock.patch.object(Toolchain, "use", use or (lambda _toolchain, names: self.resolved)),
                   mock.patch.object(Toolchain, "clean_env", lambda _toolchain: {}),
                   mock.patch.object(extension, "stage", return_value=Path("/stage")),
                   mock.patch.object(extension, "bundle", return_value=[]),
                   mock.patch.object(extension, "compile_tests", return_value=[]),
                   mock.patch("agora.groups.extension.commands._node", return_value="/n/node"),
                   mock.patch.object(vscode_tests, "run", vscode)]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        return run_json(["extension", "test", *argv, "--no-log"], env={"AGORA_PLAN_GROUP": "extension"})

    def test_the_suite_and_folders_are_passed_on_and_a_pass_is_a_resource(self):
        seen = {}

        def fake(home, ext, node, code, cli, electron, vsix, env, folders=None, suite=None, screenshots=None):
            seen.update(folders=folders, suite=suite, vsix=vsix, screenshots=screenshots)
            return [], ["real VS Code: 2 of 2 tests passed in 1.0s"], [{"name": "x: a", "status": "passed", "seconds": 1}, {"name": "x: b", "status": "passed", "seconds": 1}]
        report = self.tmp / "r.json"
        code, doc = self.go("--suite", str(self.tmp / "suite"), "--workspace", f"other={self.tmp / 'other'}", "--workspace", str(self.tmp / "suite"),
                            "--report", str(report), vscode=fake)
        self.assertEqual(code, 0, doc)
        self.assertEqual(seen["suite"], str((self.tmp / "suite").resolve()))
        self.assertEqual([n for n, _ in seen["folders"]], ["other", "suite"], "NAME=PATH names a folder; a bare path is named by its last part")
        self.assertEqual(doc["data"]["passed"], 2)
        self.assertEqual(json.loads(report.read_text())["tests"][0]["name"], "x: a")

    def test_screenshots_are_a_run_of_their_own_into_a_folder_and_a_suite_with_them_is_a_usage_error(self):
        seen = {}

        def fake(home, ext, node, code, cli, electron, vsix, env, folders=None, suite=None, screenshots=None):
            seen.update(suite=suite, screenshots=screenshots)
            screenshots.mkdir(parents=True, exist_ok=True)
            (screenshots / "dark-views.png").write_bytes(b"x")
            return [], [], [{"name": "screenshots-dark: the views", "status": "passed", "seconds": 1}]
        out = self.tmp / "shots"
        code, doc = self.go("--screenshots", str(out), vscode=fake)
        self.assertEqual(code, 0, doc)
        self.assertEqual((seen["suite"], seen["screenshots"]), (None, out.resolve()))
        self.assertEqual(doc["data"]["screenshots"], ["dark-views.png"])
        self.assertEqual(self.go("--screenshots", str(out), "--suite", str(self.tmp / "suite"), vscode=fake)[0], 2)
        self.assertEqual(self.go(vscode=fake)[0], 2, "one of the two is named")

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


class SourceRules(unittest.TestCase):
    """The TypeScript, its types and its codicon ids (0043 FR-035): what `check extension` reads and what it asks tsc and ESLint."""

    def copy(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        dest = Path(tmp.name) / "tools" / "if-console"
        shutil.copytree(HOME / "tools" / "if-console", dest, ignore=shutil.ignore_patterns("node_modules", "dist", "out"))
        return Path(tmp.name), dest

    def test_the_manifest_runs_the_bundle_and_the_package_leaves_out_what_is_not_the_bundle(self):
        pkg = json.loads((HOME / "tools" / "if-console" / "package.json").read_text())
        self.assertEqual(pkg["main"], "./dist/extension.js")
        self.assertFalse(pkg.get("dependencies"))
        kept = (HOME / "tools" / "if-console" / ".vscodeignore").read_text().split()
        for need in ("src/**", "test/**", "**/*.map"):
            self.assertIn(need, kept)

    def test_a_main_that_is_not_the_bundle_a_loose_tsconfig_and_a_package_that_keeps_its_sources_are_each_found(self):
        root, ext = self.copy()
        pkg = json.loads((ext / "package.json").read_text())
        pkg["main"] = "./src/extension.js"
        (ext / "package.json").write_text(json.dumps(pkg))
        tsconfig = json.loads((ext / "tsconfig.json").read_text())
        tsconfig["compilerOptions"]["strict"] = False
        (ext / "tsconfig.json").write_text(json.dumps(tsconfig))
        (ext / ".vscodeignore").write_text("test/**\n")
        found = " | ".join(f.message for f in extension.manifest_findings(root))
        self.assertIn("main is './src/extension.js'", found)
        self.assertIn("strict must be true", found)
        self.assertIn("exclude src/**", found)
        self.assertIn("exclude **/*.map", found)

    def test_an_import_of_a_package_the_extension_does_not_carry_and_a_name_it_must_not_know_are_found(self):
        root, ext = self.copy()
        (ext / "src" / "bad.ts").write_text("import left from 'left-pad';\nimport * as http from 'http';\n// a name that must not be known\nexport const eid = 1;\n")
        found = [f.message for f in extension.source_findings(root, ["eid"])]
        self.assertTrue(any("imports left-pad" in m for m in found), found)
        self.assertTrue(any("imports http" in m for m in found), found)
        self.assertTrue(any("names eid" in m for m in found), found)
        self.assertEqual(extension.source_findings(HOME, []), [])

    def test_the_webview_may_import_vscode_elements_and_no_other_file_may(self):
        root, ext = self.copy()
        (ext / "src" / "webview" / "main.ts").write_text("import '@vscode-elements/elements/dist/vscode-button/index.js';\n")
        self.assertEqual(extension.source_findings(root, []), [])
        (ext / "src" / "app.ts").write_text("import '@vscode-elements/elements/dist/vscode-button/index.js';\n")
        self.assertTrue(any("app.ts" in f.where for f in extension.source_findings(root, [])))

    def test_the_codicon_list_is_the_locked_packages_glyph_map_and_says_which(self):
        root, ext = self.copy()
        (root / "tools" / "agora" / "lib").mkdir(parents=True)
        listed = HOME / "tools" / "agora" / "lib" / "codicons.txt"
        shutil.copyfile(listed, root / "tools" / "agora" / "lib" / "codicons.txt")
        names = [l for l in listed.read_text().splitlines() if l and not l.startswith("#")]
        mapping = Path(tempfile.mkdtemp()) / "mapping.json"
        self.addCleanup(shutil.rmtree, mapping.parent, True)
        mapping.write_text(json.dumps({"60000": names[:300], "60001": names[300:]}))
        self.assertEqual(extension.codicon_findings(root, mapping, "0.0.45"), [])
        mapping.write_text(json.dumps({"60000": names[:-1] + ["brand-new"]}))
        found = " | ".join(f.message for f in extension.codicon_findings(root, mapping, "0.0.45"))
        self.assertIn(f"{names[-1]} is not a codicon of @vscode/codicons 0.0.45", found)
        self.assertIn("brand-new is a codicon of @vscode/codicons 0.0.45 that the list lacks", found)
        self.assertIn("does not name @vscode/codicons 0.0.46", " | ".join(f.message for f in extension.codicon_findings(root, mapping, "0.0.46")))

    def test_tsc_and_eslint_output_become_findings_at_the_repositorys_own_paths(self):
        stage = Path("/tmp/agora-extension-x/if-console")
        tsc = mock.Mock(returncode=2, stdout="src/app.ts(12,5): error TS2322: Type 'a' is not assignable to type 'b'.\n  more\n", stderr="")
        with mock.patch.object(extension, "_run", return_value=tsc):
            found = extension.typecheck(stage, "node", "tsc", {})
        self.assertEqual(found[0].where, "tools/if-console/src/app.ts:12")
        self.assertIn("TS2322", found[0].message)
        report = json.dumps([{"filePath": str(stage / "src" / "x.ts"), "messages": [{"ruleId": "@typescript-eslint/no-explicit-any", "severity": 2, "message": "no any", "line": 4}]}])
        with mock.patch.object(extension, "_run", return_value=mock.Mock(returncode=1, stdout=report, stderr="")):
            lint = extension.lint(stage, "node", "eslint", {})
        self.assertEqual((lint[0].where, "no-explicit-any" in lint[0].message), ("tools/if-console/src/x.ts:4", True))
        with mock.patch.object(extension, "_run", return_value=mock.Mock(returncode=2, stdout="", stderr="boom")):
            self.assertIn("did not run", extension.lint(stage, "node", "eslint", {})[0].message)
            self.assertIn("tsc failed", extension.typecheck(stage, "node", "tsc", {})[0].message)

    def test_the_staged_copy_holds_the_sources_beside_the_locked_modules_and_none_of_what_is_built(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        modules = Path(tmp.name) / "tree" / "node_modules"
        modules.mkdir(parents=True)
        staged = extension.stage(HOME, modules, Path(tmp.name) / "stage")
        self.assertTrue((staged / "src" / "extension.ts").is_file())
        self.assertTrue((staged / "esbuild.mjs").is_file())
        self.assertEqual((staged / "node_modules").resolve(), modules.resolve())
        self.assertFalse((staged / "dist").exists())

    def test_the_build_entry_pins_the_engines_own_types_and_the_lock_agrees(self):
        self.assertEqual(extension_build.PACKAGES["@types/vscode"], "1.101.0")
        pkg = json.loads((HOME / "tools" / "if-console" / "package.json").read_text())
        self.assertEqual(pkg["engines"]["vscode"], "^" + extension_build.PACKAGES["@types/vscode"])
        pkg["engines"]["vscode"] = "^1.140.0"
        real = (HOME / "tools" / "if-console" / "package.json")
        with mock.patch.object(Path, "read_text", lambda self, *a, **k: json.dumps(pkg) if self == real else real.read_bytes().decode()):
            self.assertTrue(any("@types/vscode is 1.101.0 and the engine is 1.140.0" in p for p in extension_build.lock_problems()))
