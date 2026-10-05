"""The assurance group: harness discovery, the missing-harness failure, a missing program, streaming, and the sections
(0014-design-systems FR-015, FR-017, FR-039; 0042-agora FR-013, FR-014, FR-017; 0041-command-line FR-006, FR-033)."""
import contextlib
import importlib.util
import io
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from agora.core import runner as checkrun
from agora.core import toolchain as tcore
from agora.core.ctx import Ctx
from agora.core.registry import Registry
from agora.groups.assurance import commands
from agora.lib import assurance, imagery, openedx

from .helpers import HOME, run_json
from .toolchain_fixture import entry as fixture_entry, make_tar, toolchain as fixture_toolchain

TOKENS = '{"$extensions": {"com.intellectualfrontiers.logo": {}}}'
PASS = "import sys\nprint('ok')\n"
FAIL = "import sys\nprint('✗ a rule broke')\nsys.exit(1)\n"
WITH_BRAND = "import argparse\nap = argparse.ArgumentParser()\nap.add_argument(\"--brand\")\nprint('brand', ap.parse_args().brand)\n"


def quiet(fn, *a, **kw):
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        r = fn(*a, **kw)
    return r, err.getvalue()


class Repo(unittest.TestCase):
    """A small public root: design systems with harnesses of every kind."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.reg = Registry.load(HOME)
        # the toolchain lock for these tests: the cache is a temp directory, and `no-such-tool` has no build anywhere
        self.nobuild = tcore.Entry("no-such-tool", "1.0", "x", {}, lambda p: {})
        self.tc = fixture_toolchain({"no-such-tool": self.nobuild}, self.root / "tc-cache", env=dict(os.environ))

    def add_entry(self, e):
        self.tc.entries[e.name] = e

    def ds(self, slug, *, brand=False, py=None, mjs=None):
        d = self.root / "design-systems" / slug
        (d / "assurance").mkdir(parents=True)
        if brand:
            (d / "brand.css").write_text("/* brand */\n")
        if py is not None:
            (d / "assurance" / "run.py").write_text(py)
        if mjs is not None:
            (d / "assurance" / "run.mjs").write_text(mjs)
        return d

    def ctx(self, **options):
        c = Ctx(self.reg, home=self.root, root=self.root, env=dict(os.environ))
        c.section_options = options
        c.__dict__["_toolchain"] = self.tc
        return c

    def manifest(self):
        return self.reg.groups["assurance"].manifest


class Discovery(Repo):
    def setUp(self):
        super().setUp()
        self.ds("brand-a", brand=True, mjs="//")
        self.ds("brand-b", brand=True, mjs="//", py=WITH_BRAND)
        self.ds("web", mjs="//")
        self.ds("print", py=PASS)
        self.ds("both", mjs="//", py=PASS)

    def plan(self, **kw):
        return assurance.plan(self.root, self.manifest(), **kw)

    def test_brands_are_the_design_systems_with_a_brand_css(self):
        self.assertEqual(assurance.brands(self.root), ["brand-a", "brand-b"])

    def test_a_themed_browser_harness_runs_under_every_brand_and_a_brands_own_once(self):
        found, missing = self.plan()
        self.assertEqual(missing, [])
        browser = [(h.slug, h.brand) for h in found if h.kind == "browser"]
        self.assertEqual(browser, [("both", "brand-a"), ("both", "brand-b"), ("brand-a", None), ("brand-b", None),
                                   ("web", "brand-a"), ("web", "brand-b")])
        argv = {(h.slug, h.brand): h.argv for h in found if h.kind == "browser"}
        self.assertEqual(argv[("web", "brand-b")], ["node", "design-systems/web/assurance/run.mjs", "--brand", "brand-b"])
        self.assertEqual(argv[("brand-a", None)], ["node", "design-systems/brand-a/assurance/run.mjs"])

    def test_a_python_harness_runs_once_with_the_interpreter_in_use(self):
        found, _ = self.plan(runner="python")
        self.assertEqual([h.slug for h in found], ["both", "brand-b", "print"])
        self.assertTrue(all(h.argv[0] == sys.executable and h.brand is None for h in found))

    def test_brand_narrows_themed_harnesses_and_goes_to_a_harness_that_takes_it(self):
        found, _ = self.plan(brand="brand-b")
        self.assertEqual({h.brand for h in found if h.kind == "browser" and h.slug in ("web", "both")}, {"brand-b"})
        py = {h.slug: h.argv for h in found if h.kind == "python"}
        self.assertEqual(py["brand-b"][-2:], ["--brand", "brand-b"])
        self.assertNotIn("--brand", py["print"])

    def test_scope_limits_to_one_design_system(self):
        found, _ = self.plan(scope="web")
        self.assertEqual({h.slug for h in found}, {"web"})

    def test_a_design_system_with_no_harness_is_named(self):
        self.ds("empty")
        (self.root / "design-systems" / "stray.md").write_text("not a design system\n")
        found, missing = self.plan()
        self.assertEqual(missing, ["empty"])
        found, missing = self.plan(runner="browser")
        self.assertEqual(missing, ["empty"])

    def test_each_harness_carries_what_the_manifest_says_it_needs(self):
        found, _ = self.plan()
        browser = next(h for h in found if h.kind == "browser")
        self.assertEqual(browser.toolchain, ["chromium", "npm-packages"])  # node is a package, not an entry (0042 FR-030)
        m = self.manifest()
        m["harnesses"]["print:python"] = {"toolchain": ["tinytex"]}
        found, _ = self.plan(runner="python")
        printer = next(h for h in found if h.slug == "print")
        self.assertEqual(printer.toolchain, ["tinytex"])

    def test_the_real_manifest_names_the_print_harness_toolchain_and_the_python_packages(self):
        m = Registry.load(HOME).groups["assurance"].manifest
        self.assertEqual(m["harnesses"]["frontiers-print:python"]["toolchain"], ["tinytex", "tex-packages"])
        self.assertEqual(m["runners"]["browser"]["toolchain"], ["chromium", "npm-packages"])
        self.assertEqual(m["runners"]["python"]["toolchain"], [])
        self.assertNotIn("programs", m)  # no host program is declared (0042 FR-030)
        self.assertEqual(set(m["packages"]), {"Pillow", "fonttools", "lxml", "nodejs-wheel-binaries", "pypdf", "pypdfium2",
                                              "reportlab", "resvg-py"})
        self.assertTrue(all(v.replace(".", "").isdigit() for v in m["packages"].values()))  # exact pins


class Running(Repo):
    def run_one(self, h):
        lines = []
        return assurance.run_one(self.tc, h, self.root, dict(os.environ), lines.append), lines

    def harness(self, slug, text, toolchain=()):
        self.ds(slug, py=text)
        found, _ = assurance.plan(self.root, self.manifest(), scope=slug)
        found[0].toolchain = list(toolchain)
        return found[0]

    def test_a_passing_harness_streams_its_output(self):
        o, lines = self.run_one(self.harness("a", PASS))
        self.assertEqual(o.status, "passed")
        self.assertEqual(lines, ["── a (python)", "ok"])

    def test_a_failing_harness_fails_with_its_last_lines(self):
        o, lines = self.run_one(self.harness("a", FAIL))
        self.assertEqual((o.status, o.code), ("failed", 1))
        self.assertIn("✗ a rule broke", assurance.failure_message(o))
        self.assertIn("✗ a rule broke", lines)

    def test_an_entry_that_cannot_be_had_skips_the_harness_naming_it_and_never_runs_it(self):
        h = self.harness("a", "raise SystemExit('must not run')\n", ["no-such-tool"])
        o, lines = self.run_one(h)
        self.assertEqual(o.status, "skipped")
        self.assertIn("no-such-tool 1.0", o.reason)
        self.assertIn("AGORA_NO_SUCH_TOOL", o.reason)
        self.assertFalse(any("must not run" in l for l in lines))

    def test_offline_with_a_cold_cache_skips_the_harness_naming_the_entry_and_the_command_that_fetches_it(self):
        archive = self.root / "t.tar.gz"
        self.add_entry(fixture_entry("cold-tool", archive, make_tar(archive, {"bin/cold-tool": b"x"})))
        self.tc.offline = True
        h = self.harness("a", "raise SystemExit('must not run')\n", ["cold-tool"])
        o, _ = self.run_one(h)
        self.assertEqual(o.status, "skipped")
        self.assertIn("cold-tool 1.0", o.reason)
        self.assertIn("agora toolchain ensure cold-tool", o.reason)

    def test_an_entry_is_fetched_on_first_use_and_its_environment_reaches_the_harness(self):
        archive = self.root / "t.tar.gz"
        self.add_entry(fixture_entry("warm-tool", archive, make_tar(archive, {"bin/warm-tool": b"x"}),
                                     env=lambda r, path, platform: {"WARM_TOOL_HOME": str(path)}))
        h = self.harness("a", "import os\nprint('HOME=' + os.environ.get('WARM_TOOL_HOME', ''))\n", ["warm-tool"])
        o, _ = self.run_one(h)
        self.assertEqual(o.status, "passed")
        self.assertTrue(any(l.startswith("HOME=") and "warm-tool-1.0" in l for l in o.tail), o.tail)

    def test_an_override_is_said_and_the_hosts_own_settings_do_not_reach_the_harness(self):
        archive = self.root / "t.tar.gz"
        self.add_entry(fixture_entry("warm-tool", archive, make_tar(archive, {"bin/warm-tool": b"x"})))
        mine = self.root / "mine"
        mine.mkdir()
        self.tc.env = {**os.environ, "AGORA_WARM_TOOL": str(mine), "CHROMIUM": "/host/chromium", "PLAYWRIGHT_BROWSERS_PATH": "/host/pw"}
        h = self.harness("a", "import os\nprint('SEEN', os.environ.get('CHROMIUM'), os.environ.get('PLAYWRIGHT_BROWSERS_PATH'))\n", ["warm-tool"])
        o, lines = self.run_one(h)
        self.assertEqual(o.status, "passed")
        self.assertTrue(any("warm-tool is" in l and "AGORA_WARM_TOOL" in l for l in lines))
        self.assertIn("SEEN None None", o.tail)

    def test_a_harness_runs_without_agoras_environment(self):
        h = self.harness("a", "import os\nprint('PP', os.environ.get('PYTHONPATH'), os.environ.get('AGORA_PLAN_GROUP'))\n")
        with mock.patch.dict(os.environ, {"PYTHONPATH": "/x/tools", "AGORA_PLAN_GROUP": "assurance"}):
            o = assurance.run_one(self.tc, h, self.root, dict(os.environ), lambda _l: None)
        self.assertIn("PP None None", o.tail)

    def test_the_harness_runs_in_the_root(self):
        o, _ = self.run_one(self.harness("a", "import os\nprint('CWD', os.getcwd())\n"))
        self.assertIn(f"CWD {self.root.resolve()}", [l for l in o.tail])


class DesignSystemsSection(Repo):
    def section(self, **options):
        return quiet(commands.check_design_systems, self.ctx(**options), options.get("scope"))

    def test_every_harness_passing_passes(self):
        self.ds("a", py=PASS)
        self.ds("b", py=PASS)
        r, err = self.section(runner="python")
        self.assertEqual(r.status, "passed")
        self.assertEqual(r.data["summary"], {"passed": 2, "failed": 0, "skipped": 0})
        self.assertIn("── a (python)", err)
        self.assertEqual(sum(n.startswith("✅") for n in r.notes), 2)

    def test_a_design_system_with_no_harness_fails(self):
        self.ds("a", py=PASS)
        self.ds("empty")
        r, err = self.section()
        self.assertEqual(r.status, "failed")
        self.assertTrue(any("empty has no assurance harness" in f.message and "FR-015" in f.message for f in r.findings))
        self.assertIn("empty has no assurance harness", err)

    def test_a_failing_harness_fails_the_section_naming_its_script(self):
        self.ds("a", py=PASS)
        self.ds("b", py=FAIL)
        r, _ = self.section(runner="python")
        self.assertEqual(r.status, "failed")
        self.assertEqual([f.where for f in r.findings], ["design-systems/b/assurance/run.py"])

    def test_a_skipped_harness_makes_the_section_skipped_not_passed(self):
        self.manifest().setdefault("harnesses", {})["b:python"] = {"toolchain": ["no-such-tool"]}
        self.ds("a", py=PASS)
        self.ds("b", py="raise SystemExit(1)\n")
        r, _ = self.section(runner="python")
        self.assertEqual(r.status, "skipped")
        self.assertIn("no-such-tool", r.reason)
        self.assertIn("1 passed", r.reason)
        self.assertEqual(r.data["summary"]["skipped"], 1)

    def test_a_failure_outranks_a_skip(self):
        self.manifest().setdefault("harnesses", {})["b:python"] = {"toolchain": ["no-such-tool"]}
        self.ds("a", py=FAIL)
        self.ds("b", py=PASS)
        r, _ = self.section(runner="python")
        self.assertEqual(r.status, "failed")

    def test_nothing_to_run_is_a_failure_never_a_pass(self):
        self.ds("a", py=PASS)
        r, _ = self.section(runner="browser")
        self.assertEqual(r.status, "failed")
        self.assertIn("nothing was checked", r.findings[0].message)

    def test_a_browser_entry_that_cannot_be_had_skips_the_browser_harness_naming_it(self):
        self.ds("web", mjs="//")
        self.ds("b", brand=True)
        self.manifest()["runners"]["browser"]["toolchain"] = ["no-such-tool"]
        (self.root / "design-systems" / "b" / "assurance" / "run.mjs").write_text("//")
        r, _ = self.section(runner="browser")
        self.assertEqual(r.status, "skipped")
        self.assertIn("AGORA_NO_SUCH_TOOL", r.reason)


class SuitesAndOptions(unittest.TestCase):
    def setUp(self):
        self.reg = Registry.load(HOME)

    def test_the_sections_and_suites_are_declared(self):
        for n in ("design-systems", "imagery", "openedx"):
            self.assertTrue(callable(self.reg.sections[n].fn), n)
        s = self.reg.suites
        self.assertEqual((s["browser"]["sections"], s["browser"]["options"]), (["design-systems", "openedx"], {"runner": "browser"}))
        self.assertEqual((s["python"]["sections"], s["python"]["options"]), (["design-systems"], {"runner": "python"}))
        self.assertEqual(s["images"]["sections"], ["imagery"])
        self.assertEqual(self.reg.validate(), [])
        self.assertEqual(self.reg.plan_conflicts(), [])

    def test_a_suite_fixes_its_runner_and_refuses_the_other(self):
        code, doc = run_json(["check", "--suite", "python", "--runner", "browser"])
        self.assertEqual((code, doc["data"]["code"]), (2, "usage"))
        self.assertIn("conflicts with suite python", doc["data"]["message"])

    def test_options_belong_to_the_sections_that_declare_them(self):
        code, doc = run_json(["check", "imagery", "--runner", "browser"])
        self.assertEqual(code, 2)
        code, doc = run_json(["check", "design-systems", "--paragon", "/x"])
        self.assertEqual(code, 2)
        code, doc = run_json(["check", "imagery", "--scope", "no-such-brand"])
        self.assertEqual(code, 2)

    def test_the_register_rows_that_name_these_sections_parse(self):
        from agora.core import invocation
        ctx = Ctx(self.reg, HOME, HOME, env=dict(os.environ))
        for text in ("agora check design-systems --runner browser --scope frontiers-console-web",
                     "agora check design-systems --runner python --scope frontiers-print",
                     "agora check imagery", "agora check openedx --scope frontiers-brand"):
            self.assertIsNone(invocation.problem(ctx, text), text)
        self.assertIn("not a known", invocation.problem(ctx, "agora check openedx --scope no-such-brand") or "")

    def test_a_section_whose_toolchain_cannot_be_had_is_skipped_with_exit_3_naming_the_entry(self):
        import dataclasses
        reg = Registry.load(HOME)
        reg.sections["imagery"] = dataclasses.replace(reg.sections["imagery"], toolchain=("no-such-tool",))
        nobuild = tcore.Entry("no-such-tool", "1.0", "x", {}, lambda p: {})
        ctx = Ctx(reg, HOME, HOME, env=dict(os.environ))
        with mock.patch.object(tcore, "discover", lambda: {"no-such-tool": nobuild}):
            res = checkrun.run_check(ctx, ["imagery"], None, None, False, None)
        (s,) = res.data["sections"]
        self.assertEqual((s["status"], res.exit), ("skipped", 3))
        self.assertIn("no-such-tool 1.0", s["reason"])

    def test_no_host_program_of_the_replaced_kind_is_declared(self):  # 0042 FR-030
        self.assertFalse(any(hasattr(g, "programs") for g in self.reg.groups.values()))
        self.assertNotIn("programs", self.reg.groups["assurance"].manifest)


@unittest.skipUnless(importlib.util.find_spec("PIL"), "Pillow is not installed")
class Imagery(Repo):
    def test_the_real_brands_pass(self):
        for brand in assurance.brands(HOME):
            self.assertEqual(imagery.check(HOME / "design-systems" / brand), [], brand)

    def test_the_section_reports_each_brand_and_a_problem_by_brand(self):
        brand = self.ds("some-brand", brand=True)
        (brand / "tokens.json").write_text(TOKENS)
        r, err = quiet(commands.check_imagery, self.ctx(), None)
        self.assertEqual(r.status, "failed")
        self.assertTrue(any("images/share-card.png: missing" in f.message for f in r.findings))
        self.assertIn("── some-brand's imagery and share card", err)
        self.assertEqual(r.data["brands"][0]["brand"], "some-brand")

    def test_a_scope_that_is_not_a_brand_fails(self):
        self.ds("plain")
        r, _ = quiet(commands.check_imagery, self.ctx(), "plain")
        self.assertEqual(r.status, "failed")
        self.assertIn("is not a brand", r.findings[0].message)


class ImageryLibrary(unittest.TestCase):
    def test_the_whole_module_is_there(self):
        for name in ("build", "check", "measure", "build_icons", "catalog", "lockup", "surface", "luminance"):
            self.assertTrue(callable(getattr(imagery, name)), name)

    def test_luminance_and_messages_name_agora(self):
        self.assertAlmostEqual(imagery.luminance("#ffffff"), 1.0)
        self.assertEqual(imagery.luminance("#000000"), 0.0)
        with tempfile.TemporaryDirectory() as d:
            brand = Path(d, "b")
            brand.mkdir()
            (brand / "tokens.json").write_text(TOKENS)
            if shutil.which("identify"):
                (p,) = imagery.check(brand)
                self.assertIn("agora imagery build b", p)
                self.assertNotIn("tools/", p)


class OpenedxSection(Repo):
    def package(self, run_py):
        b = self.ds("brand-x", brand=True, py=run_py)
        (b / "openedx").mkdir()
        return b

    def section(self, scope=None, env=None, **options):
        ctx = self.ctx(**options)
        ctx.env = {**{k: v for k, v in os.environ.items() if k != "PARAGON"}, **(env or {})}
        return quiet(commands.check_openedx, ctx, scope)

    def locked_paragon(self):
        """The npm tree, as a local archive holding a stand-in Paragon, so that the lock is used with no network."""
        archive = self.root / "npm.tar.gz"
        sha = make_tar(archive, {"node_modules/.bin/paragon": b"#!/bin/sh\n"})
        self.add_entry(fixture_entry("npm-packages", archive, sha, provides={"paragon": "node_modules/.bin/paragon", "playwright": "x"},
                                     env=lambda r, path, platform: {"PLAYWRIGHT_MODULE": str(path)}))

    def test_without_paragon_the_one_the_npm_lock_installs_is_used(self):
        self.package("import os\nprint('PARAGON=' + os.environ.get('PARAGON', ''))\n")
        self.locked_paragon()
        r, err = self.section()
        self.assertEqual(r.status, "passed", r.findings)
        self.assertIn("node_modules/.bin/paragon", r.data["paragon"])
        self.assertIn(f"PARAGON={r.data['paragon']}", err)
        self.assertIn("rebuilt with", err)

    def test_without_paragon_offline_and_a_cold_cache_the_section_is_skipped_naming_the_entry(self):
        self.package(PASS)
        self.locked_paragon()
        self.tc.offline = True
        r, _ = self.section()
        self.assertEqual(r.status, "skipped")
        self.assertIn("npm-packages", r.reason)
        self.assertIn("agora toolchain ensure npm-packages", r.reason)

    def test_paragon_comes_from_the_option_and_not_from_the_hosts_environment(self):
        self.package("import os\nprint('PARAGON=' + os.environ.get('PARAGON', ''))\n")
        fake = self.root / "paragon"
        fake.write_text("")
        r, err = self.section(paragon=str(fake))
        self.assertEqual(r.status, "passed")
        self.assertIn(f"PARAGON={fake.resolve()}", err)
        self.assertEqual(r.data["paragon"], str(fake.resolve()))
        self.locked_paragon()
        self.tc.offline = True  # a PARAGON in the environment is the host's: it stands in for nothing
        r, _ = self.section(env={"PARAGON": str(fake)})
        self.assertEqual(r.status, "skipped")

    def test_a_paragon_that_is_not_a_file_fails(self):
        self.package(PASS)
        r, _ = self.section(paragon=str(self.root / "nope"))
        self.assertEqual(r.status, "failed")
        self.assertIn("not a file", r.findings[0].message)

    def test_a_failing_harness_fails_the_section(self):
        self.package(FAIL)
        self.locked_paragon()
        r, _ = self.section()
        self.assertEqual(r.status, "failed")
        self.assertIn("✗ a rule broke", r.findings[0].message)

    def test_a_package_with_no_harness_and_a_brand_with_no_package_fail(self):
        b = self.ds("brand-y", brand=True)
        (b / "openedx").mkdir()
        self.locked_paragon()
        r, _ = self.section()
        self.assertEqual(r.status, "failed")
        self.assertIn("no assurance/run.py", r.findings[0].message)
        self.ds("brand-z", brand=True)
        r, _ = self.section(scope="brand-z")
        self.assertIn("no Open edX package", r.findings[0].message)

    def test_with_no_package_anywhere_nothing_passes(self):
        self.ds("brand-z", brand=True)
        self.locked_paragon()
        r, _ = self.section()
        self.assertEqual(r.status, "failed")


class OpenedxLibrary(unittest.TestCase):
    def test_the_committed_package_is_what_the_writer_writes(self):
        b = HOME / "design-systems" / "frontiers-brand"
        self.assertEqual(openedx.check(b, b / "openedx", "frontiers-brand-openedx", None), [])

    def test_the_whole_module_is_there_and_its_text_names_agora(self):
        for name in ("write", "build", "check", "files", "contrast_problems", "variables", "hexcolor"):
            self.assertTrue(callable(getattr(openedx, name)), name)
        with tempfile.TemporaryDirectory() as d:
            problems = openedx.check(HOME / "design-systems" / "frontiers-brand", Path(d, "none"), "x", None)
        self.assertTrue(any("agora openedx generate frontiers-brand" in p for p in problems))
        self.assertFalse(any("tools/" in p for p in problems))

    def test_the_brand_harness_finds_the_writer_beside_the_tools_directory(self):
        text = (HOME / "design-systems" / "frontiers-brand" / "assurance" / "run.py").read_text()
        self.assertIn("from agora.lib import openedx", text)
        self.assertIn('BRAND.parent.parent / "tools"', text)


if __name__ == "__main__":
    unittest.main()


class OpenedxWithoutPillow(unittest.TestCase):
    """A brand without a favicon.ico needs Pillow; where the interpreter lacks it the harness skips that brand, naming the
    package and exiting 3, and is not a failure (0041 FR-006, FR-033; 0042 FR-013, FR-030)."""

    def test_the_harness_exits_3_and_says_what_it_skipped(self):
        import subprocess
        import sys
        # -S: no site-packages, so the interpreter holds no Pillow, as the harness run on a bare Python would
        p = subprocess.run([sys.executable, "-S", "design-systems/frontiers-brand/assurance/run.py"], cwd=HOME, capture_output=True,
                           text=True, env={"PATH": "/nonexistent", "PYTHONDONTWRITEBYTECODE": "1"})
        self.assertEqual(p.returncode, 3, p.stdout + p.stderr)
        self.assertIn("skipped example-brand: needs Pillow", p.stdout)
        self.assertNotIn("FAIL", p.stdout)

    @unittest.skipUnless(importlib.util.find_spec("PIL"), "Pillow is not installed")
    def test_with_pillow_the_brand_without_a_favicon_is_checked(self):
        import subprocess
        import sys
        p = subprocess.run([sys.executable, "design-systems/frontiers-brand/assurance/run.py"], cwd=HOME, capture_output=True,
                           text=True, env={"PATH": "/nonexistent", "PYTHONDONTWRITEBYTECODE": "1"})
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        self.assertNotIn("skipped", p.stdout)

    def test_the_favicon_is_written_by_pillow_in_the_three_sizes(self):
        if not importlib.util.find_spec("PIL"):
            self.skipTest("Pillow is not installed")
        from PIL import Image
        with Image.open(io.BytesIO(openedx.favicon(HOME / "design-systems" / "example-brand"))) as ico:
            self.assertEqual(sorted(ico.info["sizes"]), [(16, 16), (32, 32), (48, 48)])

    def test_the_workflows_install_none_of_the_replaced_programs(self):
        text = "\n".join(l for l in (HOME / ".github" / "workflows" / "design-systems.yml").read_text().splitlines()
                         if not l.lstrip().startswith("#"))  # a comment may name what is gone
        for gone in ("imagemagick", "poppler-utils", "librsvg2-bin", "potrace"):
            self.assertNotIn(gone, text)
