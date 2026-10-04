"""The items group and the layout commands: builds and item checks that call the design systems' own scripts
(0042-agora FR-006, FR-008, FR-013, FR-017; 0014-design-systems FR-005; 0041-command-line FR-006, FR-015, FR-033).

Scripts that need only the standard library run for real against this repository's design systems. What needs Pillow or
rsvg-convert runs against stand-ins in a temporary root, so that the test holds on a host without them.
"""
import json
import os
import shutil
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from agora.core import runner as checkrun
from agora.core import worker
from agora.core.ctx import Ctx
from agora.core.registry import Registry
from agora.groups.items import commands as items_cmd
from agora.groups.layout import commands as layout_cmd
from agora.lib import items, print_layouts

from .helpers import HOME, run, run_json

DS = HOME / "design-systems"
IN_GROUP = {"AGORA_PLAN_GROUP": "items"}  # as a worker's process stands, so a command does not re-run under uv


def section_ctx(root: Path = HOME, **options) -> Ctx:
    c = Ctx(Registry.load(HOME), home=HOME, root=root, env=dict(os.environ))
    c.section_options = options
    return c


def findings(res):
    return [(f.level, f.where, f.message) for f in res.findings]


class Sections(unittest.TestCase):
    """The item checks against the design systems' own fixtures (0042 FR-013)."""

    def test_each_section_without_a_scope_checks_the_passing_fixtures(self):
        for name, fn, unit in (("slides", items_cmd.check_slides, "deck"), ("email", items_cmd.check_email, "message"),
                               ("course", items_cmd.check_course, "course"), ("voice", items_cmd.check_voice, "file"),
                               ("merchandise", items_cmd.check_merchandise, "job")):
            with self.subTest(name):
                r = fn(section_ctx(), None)
                self.assertEqual((r.status, findings(r)), ("passed", []), r.notes)
                self.assertIn("no --scope: the design system's own passing fixtures", r.notes[0])
                self.assertGreater(r.data["checked"], 0)

    def test_a_scope_of_failing_fixtures_fails_for_the_reason_the_design_system_names(self):
        cases = (("slides", items_cmd.check_slides, "frontiers-slides", "banned word 'delve'"),
                 ("email", items_cmd.check_email, "frontiers-email", "banned word"),
                 ("voice", items_cmd.check_voice, "frontiers-written-voice", "an em dash"))
        for name, fn, slug, reason in cases:
            with self.subTest(name):
                r = fn(section_ctx(), [str(DS / slug / "assurance" / "fixtures" / "fail")])
                self.assertEqual(r.status, "failed")
                self.assertTrue(any(reason in m for _, _, m in findings(r)), findings(r))
                self.assertIn("--scope", r.notes[0])

    def test_scope_takes_files_and_directories_together(self):
        pass_ = DS / "frontiers-written-voice" / "assurance" / "fixtures" / "pass"
        r = items_cmd.check_voice(section_ctx(), [str(pass_ / "essay.md"), str(pass_ / "urls.adoc")])
        self.assertEqual((r.status, r.data["checked"]), ("passed", 2))

    def test_a_scope_that_holds_nothing_is_an_error_not_a_pass(self):
        with tempfile.TemporaryDirectory() as d:
            r = items_cmd.check_slides(section_ctx(), [d])
        self.assertEqual(r.status, "failed")
        self.assertIn("no .md file under it", findings(r)[0][2])
        r = items_cmd.check_course(section_ctx(), [str(HOME / "tools")])
        self.assertEqual(r.status, "failed")

    def test_voice_mode_draft_and_spoken(self):
        fail = DS / "frontiers-written-voice" / "assurance" / "fixtures" / "fail"
        r = items_cmd.check_voice(section_ctx(draft=True), [str(fail / "hedge.md")])
        self.assertEqual(r.status, "passed")  # every failure reported as a warning
        self.assertEqual([lv for lv, _, _ in findings(r)], ["warning"])
        long_step = str(fail / "procedure-long-step.md")
        self.assertEqual(items_cmd.check_voice(section_ctx(mode="procedure"), [long_step]).status, "failed")
        self.assertEqual(items_cmd.check_voice(section_ctx(), [long_step]).status, "passed")  # prose, as sweep.py reads it
        spoken = DS / "frontiers-spoken-voice" / "assurance" / "fixtures"
        self.assertEqual(items_cmd.check_voice(section_ctx(spoken=True), None).status, "passed")
        r = items_cmd.check_voice(section_ctx(spoken=True), [str(spoken / "fail" / "story-label.txt")])
        self.assertTrue(any("labels a story" in m for _, _, m in findings(r)))

    def test_a_procedure_named_fixture_is_swept_as_a_procedure_only_among_the_fixtures(self):
        r = items_cmd.check_voice(section_ctx(), None)
        self.assertEqual((r.status, r.data["checked"]), ("passed", 3))
        self.assertIn("a fixture named procedure-* as a procedure", r.notes[0])
        self.assertIn("a fixture named procedure-*", r.data["scope"])
        r = items_cmd.check_voice(section_ctx(), [str(DS / "frontiers-written-voice" / "assurance" / "fixtures" / "pass" / "procedure-replace-filter.md")])
        self.assertNotIn("procedure-*", r.data["scope"])

    def test_merchandise_notes_a_fixture_beyond_the_kit_but_holds_a_named_job_to_it(self):
        beyond = DS / "frontiers-merchandise" / "assurance" / "fixtures" / "pass" / "mug-front-lockup.json"
        r = items_cmd.check_merchandise(section_ctx(), None)
        self.assertEqual(r.status, "passed")
        self.assertTrue(any("mug-front-lockup.json is beyond frontiers-brand's kit" in n for n in r.notes))
        r = items_cmd.check_merchandise(section_ctx(), [str(beyond)])
        self.assertEqual(r.status, "failed")
        self.assertTrue(any("at any size" in m for _, _, m in findings(r)))

    def test_an_unknown_brand_is_a_finding(self):
        r = items_cmd.check_slides(section_ctx(brand="no-such-brand"), None)
        self.assertEqual(r.status, "failed")
        self.assertIn("is not a brand", findings(r)[0][2])

    def test_the_sections_belong_to_no_suite(self):  # 0042 FR-014 names no item check in a suite
        reg = Registry.load(HOME)
        named = {n for s in reg.suites.values() for n in s["sections"] + s["planned"]}
        for n in ("figures", "voice", "slides", "email", "course", "media", "signage", "merchandise"):
            self.assertEqual(reg.sections[n].status, "implemented", n)
            self.assertEqual((reg.sections[n].scope, reg.sections[n].many, reg.sections[n].isolated), ("PATH", True, True), n)
            self.assertNotIn(n, named)
        self.assertEqual(reg.validate(), [])
        self.assertEqual(reg.plan_conflicts(), [])


class FakeSystems(unittest.TestCase):
    """A temporary root whose item design systems are stand-ins, for the scripts that need Pillow or rsvg-convert."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        shutil.copytree(HOME / "tools" / "agora", self.root / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        for slug in ("frontiers-brand",):
            d = self.root / "design-systems" / slug
            d.mkdir(parents=True)
            (d / "brand.css").write_text("/* brand */\n")
        self.addCleanup(lambda: [sys.modules.pop(m, None) for m in ("svgkit", "figcheck")])  # a stand-in must not stay as the real one

    def script(self, slug: str, name: str, text: str) -> Path:
        p = self.root / "design-systems" / slug / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return p

    def fixture(self, slug: str, name: str, text: str) -> Path:
        return self.script(slug, f"assurance/fixtures/pass/{name}", text)

    def ctx(self, **options) -> Ctx:
        c = Ctx(Registry.load(self.root), home=self.root, root=self.root, env=dict(os.environ))
        c.section_options = options
        return c

    def go(self, *argv, env=None):
        return run_json(list(argv), home=self.root, env={**IN_GROUP, **(env or {})})

    def fake_rsvg(self):
        d = self.root / "fakebin"
        d.mkdir(exist_ok=True)
        f = d / "rsvg-convert"
        f.write_text(f"#!{sys.executable}\nimport sys\na = sys.argv\nopen(a[a.index('-o') + 1], 'wb').write(b'%PDF-fake')\n")
        f.chmod(f.stat().st_mode | stat.S_IEXEC)
        p = mock.patch.dict(os.environ, {"PATH": str(d)})
        p.start()
        self.addCleanup(p.stop)

    JOB_SCRIPT = ("import json\nfrom pathlib import Path\n"
                  "def check(job, brand):\n    return [] if job.get('title') else ['no title']\n"
                  "def render(job, brand, out, svg_out=None):\n"
                  "    import subprocess\n    subprocess.run(['rsvg-convert', '-o', str(out), 'x.svg'], check=True)\n"
                  "    if svg_out:\n        svg_out.write_text('<svg/>')\n")

    def test_media_and_signage_checks_take_jobs_and_report_the_scripts_problems(self):
        for slug, script, fn in (("frontiers-media", "media.py", items_cmd.check_media),
                                 ("frontiers-signage-print", "signage.py", items_cmd.check_signage)):
            self.script(slug, script, self.JOB_SCRIPT)
            self.fixture(slug, "good.json", '{"title": "T"}')
            bad = self.root / "bad.json"
            bad.write_text("{}")
            with self.subTest(slug):
                self.assertEqual(fn(self.ctx(), None).status, "passed")
                r = fn(self.ctx(), [str(bad)])
                self.assertEqual((r.status, findings(r)[0][2]), ("failed", "no title"))

    def test_a_script_that_raises_is_a_finding_not_a_stack_trace(self):
        self.script("frontiers-media", "media.py", "def check(job, brand):\n    raise KeyError('format')\n")
        self.fixture("frontiers-media", "good.json", "{}")
        r = items_cmd.check_media(self.ctx(), None)
        self.assertEqual(r.status, "failed")
        self.assertIn("the check could not run: KeyError", findings(r)[0][2])

    def test_a_design_system_without_a_passing_fixture_is_skipped_never_passed(self):
        self.script("frontiers-slides", "deck.py", "def check(d, b):\n    return []\n")
        r = items_cmd.check_slides(self.ctx(), None)
        self.assertEqual(r.status, "skipped")
        self.assertIn("holds no passing deck", r.reason)

    def test_figures_check_measures_in_the_brand_only_when_one_is_named(self):
        self.script("frontiers-figures", "svgkit.py", "BRAND = []\ndef use_brand(b):\n    BRAND.append(str(b))\n")
        self.script("frontiers-figures", "figcheck.py", "import svgkit\ndef check(path):\n    return ['small text'] if 'bad' in path else []\n")
        self.fixture("frontiers-slides", "figures/ok.svg", "<svg/>")
        r = items_cmd.check_figures(self.ctx(), None)
        self.assertEqual((r.status, r.data["checked"]), ("passed", 1))
        self.assertIn("measured in Inter", r.notes[0])
        bad = self.root / "bad.svg"
        bad.write_text("<svg/>")
        r = items_cmd.check_figures(self.ctx(brand="frontiers-brand"), [str(bad)])
        self.assertEqual((r.status, findings(r)[0][2]), ("failed", "small text"))
        self.assertIn("frontiers-brand's sans", r.notes[0])
        self.assertTrue(items.load(self.root, "frontiers-figures", "svgkit.py").BRAND[0].endswith("frontiers-brand"))

    def test_media_and_sign_build_need_rsvg_convert_and_say_so_with_exit_3(self):
        self.script("frontiers-media", "media.py", self.JOB_SCRIPT)
        job = self.root / "job.json"
        job.write_text('{"title": "T"}')
        empty = self.root / "empty"
        empty.mkdir()
        with mock.patch.dict(os.environ, {"PATH": str(empty)}):
            for cmd in ("media", "sign"):
                code, doc = self.go(cmd, "build", str(job))
                self.assertEqual((code, doc["data"]["code"], doc["data"]["program"]), (3, "missing-program", "rsvg-convert"), cmd)
                self.assertIn("librsvg", doc["data"]["hint"])
        self.assertFalse((self.root / "job.png").exists())

    def test_media_build_renders_beside_the_job_and_dry_run_writes_nothing(self):
        self.fake_rsvg()
        self.script("frontiers-media", "media.py", self.JOB_SCRIPT)
        job = self.root / "job.json"
        job.write_text('{"title": "T"}')
        code, doc = self.go("media", "build", str(job), "--dry-run")
        self.assertEqual((code, doc["data"]["dry_run"]), (0, True))
        self.assertEqual([c["change"] for c in doc["data"]["changes"]], ["create"])
        self.assertFalse((self.root / "job.png").exists())
        code, doc = self.go("media", "build", str(job), "--svg", str(self.root / "job.svg"))
        self.assertEqual(code, 0)
        self.assertEqual((self.root / "job.png").read_bytes(), b"%PDF-fake")
        self.assertEqual((self.root / "job.svg").read_text(), "<svg/>")

    def test_sign_build_writes_a_pdf_through_apply(self):
        self.fake_rsvg()
        self.script("frontiers-signage-print", "signage.py", self.JOB_SCRIPT)
        job = self.root / "poster.json"
        job.write_text('{"title": "T"}')
        code, doc = self.go("sign", "build", str(job), "-o", str(self.root / "out" / "p.pdf"))
        self.assertEqual(code, 0, doc)
        self.assertEqual((self.root / "out" / "p.pdf").read_bytes(), b"%PDF-fake")
        self.assertEqual(self.go("sign", "build", str(job), "-o", str(self.root / "out" / "p.pdf"))[1]["data"]["changes"], [])

    def test_a_script_that_refuses_is_exit_1_in_its_own_words(self):
        self.fake_rsvg()
        self.script("frontiers-media", "media.py", "def render(job, brand, out, svg_out=None):\n    raise SystemExit('format is not one of formats.json')\n")
        job = self.root / "job.json"
        job.write_text("{}")
        code, doc = self.go("media", "build", str(job))
        self.assertEqual((code, doc["data"]["code"]), (1, "refused"))
        self.assertIn("format is not one of formats.json", doc["data"]["message"])


class Builds(unittest.TestCase):
    """The stdlib scripts built for real into a scratch directory (frontiers-slides FR-010, frontiers-email FR-005, frontiers-course FR-013)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name)

    def go(self, *argv):
        return run_json(list(argv), env=IN_GROUP)

    def test_deck_build_dry_run_writes_nothing_and_a_build_equals_the_committed_page(self):
        src = DS / "frontiers-slides" / "assurance" / "fixtures" / "pass" / "deck.md"
        code, doc = self.go("deck", "build", str(src), "-o", str(self.out / "deck.html"), "--dry-run")
        self.assertEqual((code, doc["data"]["dry_run"], [c["change"] for c in doc["data"]["changes"]]), (0, True, ["create"]))
        self.assertEqual(list(self.out.iterdir()), [])
        code, doc = self.go("deck", "build", str(src), "-o", str(self.out / "deck.html"))
        self.assertEqual(code, 0)
        # The page links the brand's files relative to where it is written, so build it where the fixture stands: no change.
        committed = src.with_suffix(".html")
        code, doc = self.go("deck", "build", str(src), "-o", str(committed), "--dry-run")
        self.assertEqual(doc["data"]["changes"], [], "the committed deck.html is what the script builds")

    def test_deck_build_inline_is_one_standalone_file(self):
        src = DS / "frontiers-slides" / "assurance" / "fixtures" / "pass" / "deck.md"
        code, doc = self.go("deck", "build", str(src), "-o", str(self.out / "one.html"), "--inline")
        self.assertEqual(code, 0)
        page = (self.out / "one.html").read_text()
        self.assertIn("data:font/woff2;base64", page)
        self.assertNotIn('href="../', page)

    def test_email_build_writes_the_html_and_its_text_and_needs_https_assets(self):
        src = DS / "frontiers-email" / "assurance" / "fixtures" / "pass" / "newsletter.md"
        code, doc = self.go("email", "build", str(src), "--assets", "http://assets.example.org", "-o", str(self.out / "n.html"))
        self.assertEqual((code, doc["data"]["code"]), (2, "invalid-argument"))
        self.assertEqual(self.go("email", "build", str(src), "-o", str(self.out / "n.html"))[0], 2)  # --assets is required
        code, doc = self.go("email", "build", str(src), "--assets", "https://assets.example.org/brand", "-o", str(self.out / "n.html"))
        self.assertEqual(code, 0)
        self.assertEqual(sorted(p.name for p in self.out.iterdir()), ["n.html", "n.txt"])
        self.assertIn("https://assets.example.org/brand", (self.out / "n.html").read_text())

    def test_course_show_reads_the_model(self):
        c = DS / "frontiers-course" / "assurance" / "fixtures" / "pass" / "fermi-estimation"
        code, doc = self.go("course", "show", str(c))
        self.assertEqual(code, 0)
        d = doc["data"]
        self.assertEqual((d["id"], len(d["outcomes"]), len(d["units"])), ("fermi-estimation", 3, 2))
        self.assertEqual(d["model"]["id"], "fermi-estimation")
        self.assertEqual(self.go("course", "show", str(self.out))[0], 1)  # no course.adoc: the script's own refusal

    def test_course_build_web_replaces_its_directory_as_the_script_does_and_refuses_a_foreign_one(self):
        c = str(DS / "frontiers-course" / "assurance" / "fixtures" / "pass" / "fermi-estimation")
        site = self.out / "site"
        code, doc = self.go("course", "build", c, "--target", "web", "-o", str(site), "--dry-run")
        self.assertEqual((code, site.exists()), (0, False))
        self.assertGreater(doc["data"]["files"], 5)
        self.assertEqual(self.go("course", "build", c, "--target", "web", "-o", str(site))[0], 0)
        self.assertTrue((site / "index.html").is_file())
        (site / "stale.txt").write_text("old")
        code, doc = self.go("course", "build", c, "--target", "web", "-o", str(site))
        self.assertEqual([x["change"] for x in doc["data"]["changes"]], ["delete"])
        self.assertFalse((site / "stale.txt").exists())
        foreign = self.out / "foreign"
        foreign.mkdir()
        (foreign / "mine.txt").write_text("keep")
        code, doc = self.go("course", "build", c, "--target", "web", "-o", str(foreign))
        self.assertEqual((code, doc["data"]["code"], (foreign / "mine.txt").exists()), (1, "refused", True))

    def test_course_build_olx_and_cmi5_write_one_file_and_check_their_arguments(self):
        c = str(DS / "frontiers-course" / "assurance" / "fixtures" / "pass" / "fermi-estimation")
        code, doc = self.go("course", "build", c, "--target", "olx", "-o", str(self.out / "c.tar.gz"))
        self.assertEqual((code, doc["data"]["code"]), (2, "invalid-argument"))  # --org is required for olx
        self.assertEqual(self.go("course", "build", c, "--target", "olx", "--org", "IF", "-o", str(self.out / "c.tar.gz"))[0], 0)
        self.assertEqual(self.go("course", "build", c, "--target", "cmi5", "--iri", "http://x", "-o", str(self.out / "c.zip"))[0], 2)
        self.assertEqual(self.go("course", "build", c, "--target", "cmi5", "--iri", "https://example.org/c", "-o", str(self.out / "c.zip"))[0], 0)
        self.assertEqual(sorted(p.name for p in self.out.iterdir()), ["c.tar.gz", "c.zip"])
        self.assertEqual(run_json(["course", "build", c, "--target", "pdf", "-o", "x"])[0], 2)

    def test_figure_build_prints_the_themed_svg_without_a_file_and_writes_one_with_out(self):
        src = HOME / "profile" / "figures" / "how-we-work.src.svg"
        code, out, _ = run(["figure", "build", str(src), "--variant", "on-dark"], env=IN_GROUP)
        self.assertEqual(code, 0)
        self.assertIn("<svg", out)
        self.assertEqual(run_json(["figure", "build", str(src), "--variant", "no-such"])[0], 2)
        code, doc = self.go("figure", "build", str(src), "-o", str(self.out / "f.svg"))
        self.assertEqual(code, 0)
        self.assertIn("<style", (self.out / "f.svg").read_text())
        self.assertEqual(self.go("figure", "build", str(src), "-o", str(self.out / "f.svg"))[1]["data"]["changes"], [])

    def test_a_path_that_does_not_exist_is_a_usage_error_naming_the_type(self):
        code, doc = self.go("deck", "build", str(self.out / "nope.md"))
        self.assertEqual((code, doc["data"]["type"]), (2, "PATH"))


class Layouts(unittest.TestCase):
    """layout list, show and build (0042 FR-006, FR-008, FR-017)."""

    def test_list_names_every_layout_and_its_aliases(self):
        code, doc = run_json(["layout", "list"])
        self.assertEqual(code, 0)
        names = {r["name"]: r for r in doc["data"]["layouts"]}
        self.assertEqual(doc["data"]["default"], "two-column")
        self.assertTrue(names["two-column"]["default"])
        self.assertEqual(names["two-column-dense"]["aliases"], "nature")
        self.assertEqual(names["three-column"]["status"], "planned")

    def test_the_layout_type_takes_names_and_aliases_and_resolves_to_the_name(self):
        reg = Registry.load(HOME)
        ctx = Ctx(reg, HOME, HOME)
        t = reg.types["LAYOUT"]
        self.assertEqual((t.validate(ctx, "nature"), t.validate(ctx, "two-column")), ("two-column-dense", "two-column"))
        self.assertIn("nejm", t.choices(ctx))
        with self.assertRaises(ValueError):
            t.validate(ctx, "no-such-layout")
        code, doc = run_json(["layout", "show", "no-such-layout"])
        self.assertEqual((code, doc["data"]["type"]), (2, "LAYOUT"))
        self.assertEqual(run_json(["layout", "show", "jama"])[1]["id"], "single-sidebar")

    def test_show_def_is_what_the_design_systems_own_emit_writes(self):
        code, doc = run_json(["layout", "show", "nature", "--def"])
        self.assertEqual(code, 0)
        mod = items.load(HOME, "frontiers-print", "latex/layout.py")
        self.assertEqual(doc["data"]["def"], mod.emit("two-column-dense", ""))
        self.assertNotIn("def", run_json(["layout", "show", "nature"])[1]["data"])

    def test_a_planned_layout_shows_but_is_not_built(self):
        code, doc = run_json(["layout", "show", "hbr"])
        self.assertEqual((code, doc["data"]["status"]), (0, "planned"))
        code, doc = run_json(["layout", "show", "hbr", "--def"])
        self.assertEqual((code, doc["data"]["code"]), (1, "refused"))
        self.assertIn("planned and not built yet", doc["data"]["message"])
        with tempfile.TemporaryDirectory() as d:
            code, doc = run_json(["layout", "build", "hbr", "-o", str(Path(d) / "x.def")])
            self.assertEqual((code, list(Path(d).iterdir())), (1, []))

    def test_build_writes_through_apply_and_honours_dry_run(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "iflayout.def"
            code, doc = run_json(["layout", "build", "jama", "-o", str(out), "--dry-run"])
            self.assertEqual((code, out.exists(), doc["data"]["changes"][0]["change"]), (0, False, "create"))
            self.assertEqual(run_json(["layout", "build", "jama", "-o", str(out)])[0], 0)
            self.assertEqual(out.read_text(), print_layouts.emit(HOME, "single-sidebar", ""))
            self.assertEqual(run_json(["layout", "build", "jama", "-o", str(out)])[1]["data"]["changes"], [])
            self.assertEqual(run_json(["layout", "build", "jama"])[0], 2)  # -o is required
            code, doc = run_json(["layout", "build", "nature", "-o", str(out), "--typeface", "no-such-set"])
            self.assertEqual((code, doc["data"]["code"]), (1, "refused"))


class Plumbing(unittest.TestCase):
    """What the item checks need of `check` and of the loader."""

    def test_scope_may_be_repeated_only_for_a_section_that_takes_many(self):
        code, doc = run_json(["check", "specs", "--scope", "0042", "--scope", "0041"])
        self.assertEqual((code, doc["data"]["code"]), (2, "usage"))
        self.assertIn("takes one", doc["data"]["message"])
        with mock.patch("agora.core.worker.needs_worker", return_value=False):
            code, doc = run_json(["check", "voice", "--scope", str(DS / "frontiers-written-voice" / "assurance" / "fixtures" / "pass" / "essay.md"),
                                  "--scope", str(DS / "frontiers-written-voice" / "assurance" / "fixtures" / "pass" / "urls.adoc")])
        self.assertEqual((code, doc["data"]["sections"][0]["data"]["checked"]), (0, 2))
        self.assertEqual(len(doc["data"]["scope"]), 2)

    def test_voice_options_apply_to_voice_only(self):
        for flag in ("--draft", "--spoken"):
            self.assertEqual(run_json(["check", "slides", flag])[0], 2, flag)
        self.assertEqual(run_json(["check", "voice", "--mode", "chant"])[0], 2)

    def test_scope_paths_reach_a_worker_absolute_and_with_every_option(self):
        reg = Registry.load(HOME)
        ctx = Ctx(reg, HOME, HOME, env={})
        ctx.section_options = {"brand": "frontiers-brand", "mode": "procedure", "draft": True, "spoken": True}
        seen = {}

        class P:
            stdout = mock.Mock(read=lambda: json.dumps({"data": {"sections": [{"name": "voice", "status": "passed", "findings": []}]}}))
            stderr = []
            def wait(self):
                pass

        def popen(argv, **kw):
            seen["argv"] = argv
            return P()

        with mock.patch("agora.core.plan.prepare", return_value=Path(sys.executable)), mock.patch("subprocess.Popen", popen):
            worker.run_section(ctx, reg.sections["voice"], ["/a/one.md", "/b/two.md"])
        argv = seen["argv"]
        self.assertEqual([argv[i + 1] for i, a in enumerate(argv) if a == "--scope"], ["/a/one.md", "/b/two.md"])
        self.assertIn("--mode", argv)
        self.assertIn("--draft", argv)
        self.assertIn("--spoken", argv)
        self.assertNotIn("--brand", argv)  # voice declares no --brand

    def test_run_check_makes_path_scopes_absolute(self):
        reg = Registry.load(HOME)
        got = {}
        reg.sections["voice"].fn = lambda ctx, scope: got.setdefault("scope", scope) and items_cmd.SectionResult("voice")
        before = os.getcwd()
        os.chdir(HOME)
        self.addCleanup(os.chdir, before)
        with mock.patch("agora.core.worker.needs_worker", return_value=False):
            checkrun.run_check(Ctx(reg, HOME, HOME, env={}), ["voice"], None, ["README.md"], False, None)
        self.assertEqual(got["scope"], [str(HOME / "README.md")])

    def test_an_isolated_section_runs_in_a_worker_once_and_never_in_the_worker_of_its_own_group(self):
        reg = Registry.load(HOME)
        s = reg.sections["slides"]
        self.assertTrue(worker.needs_worker(Ctx(reg, HOME, HOME, env={}), s))
        self.assertFalse(worker.needs_worker(Ctx(reg, HOME, HOME, env={"AGORA_PLAN_GROUP": "items"}), s))  # no worker of a worker

    def test_staged_writes_are_held_and_links_stay_relative_to_the_real_place(self):
        target = items.staged(Path("/nowhere/at/all/deck.html"))
        target.write_text("page")
        target.with_suffix(".txt").write_bytes(b"text")
        self.assertEqual(items.Staged.held, {"/nowhere/at/all/deck.html": "page", "/nowhere/at/all/deck.txt": b"text"})
        self.assertEqual(str(target.parent), "/nowhere/at/all")
        self.assertFalse(Path("/nowhere").exists())

    def test_the_loader_loads_a_script_once_from_where_it_stands_and_reads_its_exit_as_a_problem(self):
        mod = items.load(HOME, "frontiers-slides", "deck.py")
        self.assertIs(items.load(HOME, "frontiers-slides", "deck.py"), mod)
        self.assertEqual(Path(mod.__file__).parent, DS / "frontiers-slides")
        with self.assertRaises(items.ScriptProblem):
            items.call(lambda: sys.exit("no way"))

    def test_the_option_alias_is_a_flag_of_the_parser_and_listed_by_command_show(self):
        code, doc = run_json(["command", "show", "deck", "build"])
        out = [o for o in doc["data"]["options"] if o["flag"] == "--out"][0]
        self.assertEqual(out["alias"], "-o")
        self.assertIn("[--out|-o TEXT]", doc["data"]["usage"])

    def test_every_item_command_is_declared_in_the_ontology_and_none_is_planned(self):
        reg = Registry.load(HOME)
        for c in ("deck build", "email build", "course show", "course build", "media build", "sign build", "figure build",
                  "layout list", "layout show", "layout build"):
            self.assertEqual(reg.commands[c].status, "implemented", c)
        self.assertEqual(reg.commands["media build"].programs, ("rsvg-convert",))
        self.assertEqual(reg.commands["sign build"].programs, ("rsvg-convert",))
        self.assertEqual(run_json(["check", "commands"])[0], 0)
