"""`fresh` and the generators (0041-command-line FR-035, FR-036; 0042-agora FR-015)."""
import os
import shutil
import subprocess
import unittest
from pathlib import Path

from agora.core import generate
from agora.core.ctx import Ctx
from agora.core.registry import Generator, Registry

from .brandfix import Repo, tree
from .helpers import HOME, run, run_json

ALL = ["brand-theme", "brand-specimen", "openedx-sources", "print-layout-docs"]


class Declared(unittest.TestCase):
    def setUp(self):
        self.reg = Registry.load(HOME)

    def test_the_generators_are_the_ones_0042_names(self):  # 0042 FR-015
        self.assertEqual(sorted(self.reg.generators),
                         sorted(["brand-theme", "brand-specimen", "brand-imagery", "brand-decoration", "openedx-sources",
                                 "print-layout-docs", "profile-figure", "agent-skill"]))

    def test_every_generator_declares_its_sources_outputs_and_the_command_that_rewrites_it(self):  # 0041 FR-035
        for g in self.reg.generators.values():
            with self.subTest(generator=g.name):
                self.assertTrue(g.sources and g.outputs and callable(g.fn))
                self.assertEqual(g.watch, g.sources + g.outputs)
                if g.command:
                    self.assertIn(g.command, self.reg.commands)
                    self.assertEqual(self.reg.commands[g.command].category, "generate")

    def test_a_generator_in_a_locked_group_runs_in_its_own_process(self):  # 0041 FR-028
        ctx = Ctx(self.reg, HOME, HOME, env={})
        self.assertTrue(generate.needs_worker(ctx, self.reg.generators["profile-figure"]))
        self.assertTrue(generate.needs_worker(ctx, self.reg.generators["brand-decoration"]))
        self.assertFalse(generate.needs_worker(ctx, self.reg.generators["print-layout-docs"]))
        ctx.env["AGORA_PLAN_GROUP"] = "assurance"
        self.assertFalse(generate.needs_worker(ctx, self.reg.generators["profile-figure"]))

    def test_the_registry_has_no_conflicts(self):
        self.assertEqual(self.reg.conflicts, [])

    def test_the_real_repository_is_fresh(self):  # 0042 FR-015: what is committed is what the generators write
        code, out, err = run(["fresh", *ALL], env={"AGORA_PLAN_GROUP": "brand"})  # as the brand group's own process stands
        self.assertEqual(code, 0, out + err)
        self.assertIn("fresh: fresh: 4 generator(s) proved, 0 stale, 0 skipped", out)

    @unittest.skipUnless(shutil.which("uv"), "needs uv")
    def test_the_profile_figure_is_fresh_in_the_assurance_groups_locked_environment(self):  # 0041 FR-002, FR-028
        code, doc = run_json(["fresh", "profile-figure", "--offline"], env=dict(os.environ))
        if code == 3:
            self.skipTest("the assurance group's environment is not available offline: " + doc["data"]["generators"][0]["reason"])
        self.assertEqual(code, 0, doc)
        (row,) = doc["data"]["generators"]
        self.assertEqual((row["name"], row["status"], row["files"]), ("profile-figure", "fresh", 3))


class Fresh(Repo):
    openedx = True

    def setUp(self):
        super().setUp()
        ds = self.root / "design-systems" / "frontiers-print"
        shutil.copytree(HOME / "design-systems" / "frontiers-print" / "latex", ds / "latex", ignore=shutil.ignore_patterns("*.cls", "*.tex"))
        (ds / "docs").mkdir()
        for f in ("paper-layouts.md", "paper-design-reference.md"):
            shutil.copy(HOME / "design-systems" / "frontiers-print" / "docs" / f, ds / "docs" / f)
        self.generate()
        self.assertEqual(self.go("openedx", "generate", "mini-brand")[0], 0)

    def fresh(self, *names):
        from unittest import mock
        with mock.patch("agora.core.generate.needs_worker", return_value=False):  # the tests' own environment holds every group's packages
            return self.go("fresh", *(names or ALL))

    def test_it_passes_on_what_the_generators_wrote(self):  # 0041 FR-036
        code, doc = self.fresh()
        self.assertEqual((code, doc["data"]["status"], doc["data"]["summary"]["stale"]), (0, "fresh", 0))
        self.assertEqual([r["name"] for r in doc["data"]["generators"]], ALL)

    def test_a_hand_edited_file_fails_naming_the_generator_and_the_command_and_nothing_is_written(self):  # 0042 EC, 0041 FR-036
        css = self.brand / "brand.css"
        css.write_text(css.read_text().replace("#214ea2", "#ff0000"))
        before = tree(self.root)
        code, doc = self.fresh()
        self.assertEqual((code, doc["data"]["status"]), (1, "stale"))
        (row,) = [r for r in doc["data"]["generators"] if r["status"] == "stale"]
        self.assertEqual(row["name"], "brand-theme")
        (f,) = row["stale"]
        self.assertEqual((f["path"], f["rewrite"]), ("design-systems/mini-brand/brand.css", "agora brand generate mini-brand"))
        self.assertEqual(tree(self.root), before)  # fresh writes nothing
        self.assertEqual(doc["actions"][0]["command"], "brand generate")
        code, out, err = run(["fresh", "brand-theme"], home=self.root)
        self.assertIn("brand-theme: design-systems/mini-brand/brand.css differs", out)
        self.assertIn("run `agora brand generate mini-brand`", out)
        self.go("brand", "generate")  # the command it names puts it right
        self.assertEqual(self.fresh()[0], 0)

    def test_a_missing_file_and_an_unwritten_file_are_stale(self):
        (self.brand / "brand.tex").unlink()
        (self.brand / "openedx" / "stray.md").write_text("x")
        code, doc = self.fresh()
        why = {f["path"].split("mini-brand/", 1)[1]: f["why"] for r in doc["data"]["generators"] for f in r["stale"]}
        self.assertEqual(code, 1)
        self.assertEqual(why["brand.tex"], "is missing")
        self.assertEqual(why["openedx/stray.md"], "is not written by the generator")
        (self.brand / "openedx" / "stray.md").unlink()
        (self.brand / "openedx" / "dist").mkdir()
        (self.brand / "openedx" / "dist" / "core.css").write_text("built")  # Paragon's, not a source
        self.go("brand", "generate")
        self.assertEqual(self.fresh()[0], 0)

    def test_a_changed_token_makes_every_generator_that_reads_it_stale(self):
        t = self.brand / "tokens.json"
        t.write_text(t.read_text().replace("#8a3147", "#8a3148", 1))
        code, doc = self.fresh()
        stale = {r["name"] for r in doc["data"]["generators"] if r["status"] == "stale"}
        self.assertEqual((code, stale), (1, {"brand-theme", "brand-specimen", "openedx-sources"}))

    def test_the_print_layout_docs_are_proven_by_the_design_systems_own_sync(self):  # 0042 FR-017
        doc_md = self.root / "design-systems" / "frontiers-print" / "docs" / "paper-layouts.md"
        doc_md.write_text(doc_md.read_text().replace("<!-- layouts:end -->", "an edit by hand\n<!-- layouts:end -->", 1))
        before = tree(self.root)
        code, doc = self.fresh("print-layout-docs")
        (row,) = doc["data"]["generators"]
        self.assertEqual((code, row["status"]), (1, "stale"))
        self.assertEqual(row["stale"][0]["rewrite"],
                         "python3 design-systems/frontiers-print/latex/layout.py sync design-systems/frontiers-print/docs/paper-layouts.md")
        self.assertIsNone(row["stale"][0]["call"])
        self.assertEqual(tree(self.root), before)
        subprocess.run(["python3", "design-systems/frontiers-print/latex/layout.py", "sync", str(doc_md)], cwd=self.root, check=True)
        self.assertEqual(self.fresh("print-layout-docs")[0], 0)

    def test_a_generator_whose_program_is_missing_says_so_and_exits_3_not_stale(self):  # 0042 FR-015
        reg = Registry.load(self.root)
        g = reg.generators["brand-theme"]
        reg.generators["needs-a-program"] = Generator("needs-a-program", "x", g.sources, g.outputs, g.command,
                                                      ("no-such-program-xyz",), "brand", g.fn)
        from unittest import mock
        with mock.patch("agora.core.generate.needs_worker", return_value=False):
            code, doc = run_json(["fresh", "needs-a-program"], home=self.root, registry=reg)
        (row,) = doc["data"]["generators"]
        self.assertEqual((code, row["status"], row["stale"]), (3, "skipped", []))
        self.assertIn("needs no-such-program-xyz", row["reason"])
        css = self.brand / "brand.css"
        css.write_text("hand edited")
        with mock.patch("agora.core.generate.needs_worker", return_value=False):
            code, doc = run_json(["fresh", "needs-a-program", "brand-theme"], home=self.root, registry=reg)
        self.assertEqual((code, doc["data"]["status"]), (1, "stale"))  # a stale generator still fails the run

    def test_with_none_named_every_generator_is_proved_and_none_is_left_out(self):
        from agora.core.generate import Generated
        reg = Registry.load(self.root)
        for n in ("profile-figure", "brand-imagery", "brand-decoration"):
            reg.generators[n].fn = lambda ctx, scope: Generated()  # the ones that need their own environment; proved apart
        self.go("skill", "generate")
        from unittest import mock
        with mock.patch("agora.core.generate.needs_worker", return_value=False):
            code, doc = run_json(["fresh"], home=self.root, registry=reg, env={"AGORA_PLAN_GROUP": "assurance"})
        self.assertEqual(code, 0, doc)
        self.assertEqual([r["name"] for r in doc["data"]["generators"]], list(reg.generators))
        self.assertNotIn("not_run", doc["data"])
        self.assertEqual(self.go("fresh", "no-such-generator")[0], 2)

    def test_the_agent_skill_is_proved_current_and_a_hand_edit_or_a_new_command_makes_it_stale(self):  # 0042 FR-028
        self.go("skill", "generate")
        self.assertEqual(self.fresh("agent-skill")[0], 0)
        skill = self.root / ".claude" / "skills" / "agora" / "SKILL.md"
        skill.write_text(skill.read_text() + "a hand edit\n")
        code, doc = self.fresh("agent-skill")
        (row,) = doc["data"]["generators"]
        self.assertEqual((code, row["name"], row["status"]), (1, "agent-skill", "stale"))
        self.assertEqual(row["stale"][0]["rewrite"], "agora skill generate")
        self.go("skill", "generate")
        self.assertEqual(self.fresh("agent-skill")[0], 0)
        # a command the registry gains reaches the skill, and only regenerating puts it right
        reg = Registry.load(self.root)
        from agora.core.registry import Command
        reg.add_command(Command(("spec", "frobnicate"), "read", "Frobnicates a spec", group="spec", fn=lambda ctx: None))
        with __import__("unittest").mock.patch("agora.core.generate.needs_worker", return_value=False):
            code, doc = run_json(["fresh", "agent-skill"], home=self.root, registry=reg)
        self.assertEqual((code, doc["data"]["status"]), (1, "stale"))

    def test_changed_proves_only_generators_whose_inputs_or_outputs_changed(self):  # 0041 FR-032
        def git(*a):
            return subprocess.run(["git", "-C", str(self.root), "-c", "user.name=t", "-c", "user.email=t@t", *a], check=True,
                                  capture_output=True, text=True)
        git("init", "-q")
        git("add", "-A")
        git("commit", "-q", "-m", "x")
        code, doc = self.go("fresh", *ALL, "--changed")
        self.assertEqual((code, doc["data"]["summary"]["run"]), (0, 0))
        self.assertEqual({s["name"] for s in doc["data"]["skipped_unchanged"]}, set(ALL))
        t = self.root / "design-systems" / "frontiers-print" / "latex" / "layouts.json"
        t.write_text(t.read_text() + " ")
        code, doc = self.go("fresh", *ALL, "--changed")
        self.assertEqual([r["name"] for r in doc["data"]["generators"]], ["print-layout-docs"])

    def test_fresh_refuses_root_and_dry_run(self):  # 0041 FR-015, FR-040
        self.assertEqual(run(["fresh", "--root", str(self.root)])[0], 2)
        self.assertEqual(run(["fresh", "--dry-run"])[0], 2)

    def test_every_file_a_brand_generator_writes_names_its_generator(self):  # 0041 FR-035
        for path, text in {**self.written("brand-theme"), **self.written("brand-specimen")}.items():
            self.assertRegex(text[:600], r"agora's brand-(theme|specimen) generator", path)

    def written(self, name):
        reg = Registry.load(self.root)
        ctx = Ctx(reg, self.root, self.root)
        return {p.name: t for p, t in reg.generators[name].fn(ctx, None).files.items()}
