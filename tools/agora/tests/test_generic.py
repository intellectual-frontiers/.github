import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from agora.core.describe import tool_schema
from agora.core.ctx import Ctx
from agora.core.registry import WRITES, Registry
from agora.lib import testrun

from .helpers import HOME, TempRepo, copy_guide, run, run_json


class EveryCommand(unittest.TestCase):
    def setUp(self):
        self.reg = Registry.load(HOME)

    def test_every_command_without_required_arguments_returns_a_resource(self):  # 0041 FR-016
        # the commands that run the checks again, write tracked files, or run in a group's locked environment (tested apart)
        skip = {"check", "test", "doctor", "lock", "spec new", "fresh", "brand generate", "figure generate", "skill generate",
                "mcp serve", "docs build"}  # mcp serve speaks on standard input; docs build needs the converters, tested apart
        for c in self.reg.commands.values():
            if c.id in skip or any(a.required for a in c.args) or any(o.required for o in c.options):
                continue
            with self.subTest(command=c.id):
                code, doc = run_json(c.id.split(), env={"AGORA_PLAN_GROUP": c.group})  # as the group's own process stands
                self.assertEqual(code, 0)
                self.assertEqual(sorted(doc), ["actions", "audience", "data", "id", "kind", "links", "schema"])
                self.assertEqual(doc["audience"], "public")

    def test_every_write_command_takes_dry_run_and_every_other_does_not(self):  # 0041 FR-015
        for c in self.reg.commands.values():
            flags = [o["flag"] for o in run_json(["command", "show", c.id])[1]["data"]["options"]]
            self.assertEqual("--dry-run" in flags, c.category in WRITES, c.id)

    def test_every_command_declares_a_group_a_category_and_surfaces(self):  # 0041 FR-012
        for c in self.reg.commands.values():
            d = run_json(["command", "show", c.id])[1]["data"]
            self.assertEqual(d["category"], c.category)
            self.assertEqual(d["surfaces"][0], "terminal")
            self.assertNotIn("status", d)

    def test_input_schemas_come_from_the_typed_arguments(self):  # 0041 FR-013, FR-027
        ctx = Ctx(self.reg, HOME, HOME)
        s = tool_schema(self.reg, ctx, self.reg.find("requirement set"))
        self.assertEqual(s["required"], ["requirement", "mechanism"])
        self.assertEqual(s["properties"]["mechanism"]["enum"], ["check", "gate", "review", "none"])
        self.assertEqual(s["properties"]["dry_run"], {"type": "boolean", "default": True})
        self.assertIn("0020-spec-format/FR-013", s["properties"]["requirement"].get("enum", ["0020-spec-format/FR-013"]))

    def test_every_type_validates_resolves_and_completes(self):  # 0041 FR-013
        import os
        before = os.getcwd()
        os.chdir(HOME)  # a PATH example is relative to where the command runs: the repository root
        self.addCleanup(os.chdir, before)
        ctx = Ctx(self.reg, HOME, HOME)
        for name, t in self.reg.types.items():
            with self.subTest(type=name):
                self.assertTrue(t.doc)
                ex = t.examples(ctx)
                for e in ex:
                    self.assertTrue(t.validate(ctx, e) is not None)
                self.assertIsInstance(t.complete(ctx, ""), list)
                with self.assertRaises(ValueError):
                    t.validate(ctx, "!!no such value!!")


class TestSummary(unittest.TestCase):
    def test_a_run_that_ran_nothing_does_not_pass(self):  # 0041 FR-034
        self.assertEqual(testrun.summarize(0, "Ran 0 tests in 0.0s\n\nOK")["status"], "failed")
        self.assertEqual(testrun.summarize(0, "")["status"], "failed")

    def test_failures_and_errors_fail_and_are_named(self):
        d = testrun.summarize(1, "FAIL: test_a (m.C.test_a)\nERROR: test_b (m.C.test_b)\nRan 5 tests in 1s\n\nFAILED (failures=1, errors=1)")
        self.assertEqual((d["status"], d["ran"], d["failures"], d["errors"], d["passed"]), ("failed", 5, 1, 1, 3))
        self.assertEqual(len(d["failing"]), 2)

    def test_skips_are_not_passes(self):
        d = testrun.summarize(0, "Ran 4 tests in 1s\n\nOK (skipped=1)")
        self.assertEqual((d["status"], d["passed"], d["skipped"]), ("passed", 3, 1))


@unittest.skipUnless(shutil.which("git"), "git is not installed")
class WritesLeaveGitAlone(TempRepo):
    """0041 FR-041: a command that changes the record writes tracked files and leaves the commit to a person."""

    def git(self, *args):
        return subprocess.run(["git", "-C", str(self.root), "-c", "user.name=t", "-c", "user.email=t@t", *args], check=True,
                              capture_output=True, text=True).stdout

    def test_write_commands_never_commit_stage_tag_or_push(self):
        shutil.copytree(HOME / "tools" / "agora", self.root / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        (self.root / "ontology").mkdir()
        shutil.copy(HOME / "ontology" / "ifcore.ttl", self.root / "ontology" / "ifcore.ttl")
        self.write("spec-kit/controls.tsv", "requirement\tcontrol\tnote\n")
        self.git("init", "-q")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "first")
        head, hooks = self.git("rev-parse", "HEAD"), self.git("tag")
        from agora.lib.controls import public_controls
        control = sorted(public_controls(HOME))[0]
        for argv in (["spec", "new", "second"], ["spec", "set", "0001", "--status", "Adopted"],
                     ["requirement", "set", "0001/FR-001", "--mechanism", "none", "--note", "x"],
                     ["requirement", "add", "0001/FR-001", "--control", control]):
            with self.subTest(argv=argv):
                self.assertEqual(run_json(argv, home=self.root)[0], 0)
                self.assertEqual(self.git("rev-parse", "HEAD"), head)
                self.assertEqual(self.git("tag"), hooks)
                self.assertEqual(self.git("diff", "--cached", "--name-only"), "")
        self.assertIn("M spec-kit/specs/0001-first/spec.md", self.git("status", "--short"))

    def test_dry_runs_change_nothing(self):
        shutil.copytree(HOME / "tools" / "agora", self.root / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        (self.root / "ontology").mkdir()
        shutil.copy(HOME / "ontology" / "ifcore.ttl", self.root / "ontology" / "ifcore.ttl")
        self.git("init", "-q")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "first")
        for argv in (["spec", "new", "second"], ["spec", "set", "0001", "--status", "Adopted"],
                     ["requirement", "set", "0001/FR-001", "--mechanism", "none"]):
            code, doc = run_json([*argv, "--dry-run"], home=self.root)
            self.assertEqual(code, 0)
            self.assertTrue(doc["data"]["dry_run"])
        self.assertEqual(self.git("status", "--short"), "")


class Boundaries(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        shutil.copytree(HOME / "tools" / "agora", self.home / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        (self.home / "ontology").mkdir()
        shutil.copy(HOME / "ontology" / "ifcore.ttl", self.home / "ontology" / "ifcore.ttl")
        (self.home / ".devcontainer").mkdir()
        shutil.copy(HOME / ".devcontainer" / "ws-repos.json", self.home / ".devcontainer" / "ws-repos.json")
        shutil.copy(HOME / "agora", self.home / "agora")
        (self.home / ".workspaces-host").mkdir(exist_ok=True)
        shutil.copy(HOME / ".workspaces-host" / "provider.toml", self.home / ".workspaces-host" / "provider.toml")
        shutil.copy(HOME / ".gitignore", self.home / ".gitignore")
        shutil.copy(HOME / "README.md", self.home / "README.md")
        copy_guide(self.home)

    def findings(self):
        code, doc = run_json(["check", "commands"], home=self.home)
        return code, [f["message"] for f in doc["data"]["sections"][0]["findings"]]

    def test_it_passes_as_copied(self):
        self.assertEqual(self.findings(), (0, []))

    def test_another_repositorys_name_in_agoras_code_fails(self):
        own = Registry.load(HOME).root_manifest["register_name"]
        other = next(r["repo"].rsplit("/", 1)[1] for r in json.loads((self.home / ".devcontainer" / "ws-repos.json").read_text())["repos"]
                     if r["repo"].rsplit("/", 1)[1] != own)
        (self.home / "tools" / "agora" / "lib" / "x.py").write_text(f"# reads {other} directly\n")
        code, found = self.findings()
        self.assertEqual(code, 1)
        self.assertTrue(any("names another repository" in m for m in found))

    def test_a_launcher_that_is_not_sh_or_not_executable_fails(self):
        launcher = self.home / "agora"
        launcher.chmod(0o644)
        self.assertTrue(any("not executable" in m for m in self.findings()[1]))
        launcher.chmod(0o755)
        launcher.write_text("#!/bin/bash\n")
        self.assertTrue(any("POSIX sh" in m for m in self.findings()[1]))
        launcher.unlink()
        self.assertTrue(any("launcher is missing" in m for m in self.findings()[1]))

    def test_a_log_directory_the_repository_does_not_ignore_fails(self):
        (self.home / ".gitignore").write_text("__pycache__/\n")
        self.assertTrue(any("must list the log directory" in m for m in self.findings()[1]))

    def test_sections_and_suites_must_be_the_ones_0042_declares(self):
        m = self.home / "tools" / "agora" / "agora.toml"
        m.write_text(m.read_text().replace('sections = ["specs", "register", "controls", "ontology", "vocabulary", "toolchain", "commands", "help"]',
                                            'sections = ["specs", "register"]'))
        self.assertTrue(any("suite spec is" in x for x in self.findings()[1]))

    def test_a_group_that_holds_a_lock_without_pins_fails(self):
        (self.home / "tools" / "agora" / "groups" / "spec" / "agora.lock").write_text("x")
        self.assertTrue(any("holds a lock only where it pins packages" in x for x in self.findings()[1]))
