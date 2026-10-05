"""`help`, the `help` check section, `docs generate` and `docs build` (0042-agora FR-033 to FR-036; 0041-command-line FR-065)."""
import json
import shutil
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from agora.core.checks import Finding
from agora.core.help import Step, Topic, discover, topic
from agora.core.registry import Registry
from agora.core.resource import AgoraError
from agora.lib import guide, helps

from .helpers import HOME, run_json

REQUIRED = ["start", "check", "specs", "design-systems", "brands", "toolchain", "editor", "ai", "extend", "recover"]


class Help(unittest.TestCase):
    def test_help_with_no_topic_lists_them_each_a_link(self):  # 0042 FR-033, 0041 FR-065
        code, doc = run_json(["help"])
        self.assertEqual((code, doc["kind"]), (0, "help-list"))
        names = [t["topic"] for t in doc["data"]["topics"]]
        for need in REQUIRED:
            self.assertIn(need, names)
        self.assertTrue(all(t["summary"] for t in doc["data"]["topics"]))
        self.assertEqual([l["command"] for l in doc["links"]], ["help"] * len(names))
        self.assertEqual({l["fields"]["topic"] for l in doc["links"]}, set(names))

    def test_a_topic_is_a_resource_whose_steps_are_actions(self):
        code, doc = run_json(["help", "start"])
        self.assertEqual((code, doc["kind"], doc["id"]), (0, "help", "start"))
        d = doc["data"]
        self.assertTrue(d["plain"] and d["sections"] and d["steps"])
        self.assertEqual(len(doc["actions"]), len(d["steps"]))
        for step, action in zip(d["steps"], doc["actions"]):
            self.assertEqual(step["label"], action["label"])
            self.assertEqual(step["command"], action["command"])
            self.assertTrue(action["category"])
        lines = [s["line"] for s in d["steps"]]
        self.assertIn("agora doctor", lines)
        self.assertIn("agora toolchain add", lines)  # a step that takes no value has a pasteable line
        self.assertIn("agora system add", lines)
        self.assertIn("agora check --suite spec", lines)

    def test_a_step_that_needs_a_value_a_person_gives_has_no_line_and_names_the_value(self):
        doc = run_json(["help", "design-systems"])[1]
        (show,) = [a for a in doc["actions"] if a["command"] == "design-system show"]
        self.assertIsNone(show["cli"])
        self.assertEqual(show["needs"], ["design_system"])

    def test_a_topic_that_does_not_exist_is_a_usage_error_with_the_topics_as_choices(self):
        code, doc = run_json(["help", "nonesuch"])
        self.assertEqual((code, doc["data"]["code"]), (2, "invalid-argument"))

    def test_help_is_a_repository_wide_read_command_on_the_editor_and_mcp_surfaces(self):
        reg = Registry.load(HOME)
        c = reg.commands["help"]
        self.assertEqual((c.category, c.noun, reg.surfaces_of(c)), ("read", None, ("editor", "mcp")))

    def test_topics_are_code_found_by_presence_and_a_duplicate_is_a_conflict(self):
        reg = Registry.load(HOME)
        self.assertEqual(sorted(reg.topics), sorted(set(reg.topics)))
        self.assertTrue(set(REQUIRED) <= set(reg.topics))
        with tempfile.TemporaryDirectory() as d:
            pkg = Path(d) / "fakehelp"
            pkg.mkdir()
            (pkg / "__init__.py").write_text("")
            for n in ("a", "b"):
                (pkg / f"{n}.py").write_text("from agora.core.help import topic\n@topic('same', 'One.')\ndef t():\n    return {}\n")
            sys.path.insert(0, d)
            try:
                found = discover("fakehelp")
            finally:
                sys.path.remove(d)
                sys.modules.pop("fakehelp", None)
        self.assertEqual(sorted(found), ["same", "same#duplicate-b"])

    def test_work_offline(self):  # 0042 FR-033
        code, doc = run_json(["help", "start", "--offline"])
        self.assertEqual(code, 0)


class HelpSection(unittest.TestCase):
    """`check help` fails a topic that is not well formed or that names what does not exist (0042 FR-033)."""

    def setUp(self):
        self.reg = Registry.load(HOME)

    def findings(self, **topics):
        for name, body in topics.items():
            self.reg.topics[name] = Topic(name, body.pop("summary", "A plain summary."), lambda body=body: body, "agora.help.fake")
        return [f.message for f in helps.findings(self.reg, HOME)]

    def good(self, **extra):
        return {"plain": "Plain.", "sections": (("A heading", "Some words."),), "steps": (Step("Check", "check", {"suite": "spec"}),), **extra}

    def test_the_real_topics_pass(self):
        self.assertEqual(helps.findings(self.reg, HOME), [])
        code, doc = run_json(["check", "help"])
        self.assertEqual((code, doc["data"]["status"]), (0, "passed"))

    def test_a_good_topic_adds_nothing(self):
        self.assertEqual(self.findings(newone=self.good()), [])

    def test_a_step_naming_a_command_that_does_not_exist_fails(self):
        found = self.findings(newone=self.good(steps=(Step("Frob", "frob widget"),)))
        self.assertTrue(any("'frob widget', which is not a command" in m for m in found), found)

    def test_a_step_with_a_field_the_command_does_not_take_or_a_bad_value_fails(self):
        found = self.findings(newone=self.good(steps=(Step("x", "check", {"nope": 1}), Step("y", "check", {"suite": "nonesuch"}))))
        self.assertTrue(any("gives nope to check" in m for m in found), found)
        self.assertTrue(any("suite" in m and "nonesuch" in m for m in found), found)

    def test_text_naming_a_command_a_topic_or_a_path_that_does_not_exist_fails(self):
        text = ("Run `agora frobnicate widgets` first.\n\n    ./agora nothing here --now\n\nThen `agora help ghosts`, and read tools/agora/nowhere.py and "
                "spec-kit/specs/.")
        found = self.findings(newone=self.good(sections=(("A heading", text),)))
        self.assertTrue(any("`agora frobnicate widgets`" in m or "agora frobnicate" in m for m in found), found)
        self.assertTrue(any("agora nothing" in m for m in found), found)
        self.assertTrue(any("'ghosts'" in m for m in found), found)
        self.assertTrue(any("tools/agora/nowhere.py" in m for m in found), found)
        self.assertFalse(any("spec-kit/specs/" in m for m in found), "a path that exists is fine")

    def test_a_topic_with_no_summary_sections_or_steps_fails(self):
        found = self.findings(bare={"plain": "", "sections": (), "steps": (), "summary": ""})
        for want in ("summary is one plain sentence", "no plain first paragraph", "has no sections", "has no steps"):
            self.assertTrue(any(want in m for m in found), (want, found))

    def test_a_missing_required_topic_fails(self):
        del self.reg.topics["recover"]
        self.assertTrue(any("no help topic 'recover'" in m for m in [f.message for f in helps.findings(self.reg, HOME)]))

    def test_the_section_reports_through_check(self):
        with mock.patch.object(helps, "findings", return_value=[Finding("error", "tools/agora/help/x.py: t", "names a thing (0042 FR-033)")]):
            code, doc = run_json(["check", "help"])
        self.assertEqual((code, doc["data"]["status"]), (1, "failed"))


class Reference(unittest.TestCase):
    """The reference chapters are written from the code and proved current by `fresh` (0042 FR-034)."""

    def test_the_committed_chapters_are_what_the_generator_writes(self):
        code, doc = run_json(["fresh", "reference-docs"])
        self.assertEqual(code, 0, doc["data"])
        self.assertEqual(doc["data"]["generators"][0]["files"], 6)

    def test_a_hand_edit_makes_it_stale_and_names_the_command(self):
        with mock.patch.object(guide, "commands_chapter", lambda reg: "// edited\n"):
            code, doc = run_json(["fresh", "reference-docs"])
        self.assertEqual(code, 1)
        stale = doc["data"]["generators"][0]["stale"]
        self.assertEqual([s["path"] for s in stale], ["docs-src/chapters/reference/commands.adoc"])
        self.assertEqual(stale[0]["rewrite"], "agora docs generate")

    def test_every_chapter_carries_the_generator_header_and_names_what_it_documents(self):
        reg = Registry.load(HOME)
        from agora.core.toolchain import discover as entries
        files = guide.reference_files(reg, HOME, entries())
        self.assertEqual(sorted(p.name for p in files),
                         ["checks.adoc", "commands.adoc", "design-systems.adoc", "help-topics.adoc", "specs.adoc", "toolchain.adoc"])
        for path, text in files.items():
            self.assertTrue(text.startswith("// Generated by the reference-docs generator"), path.name)
            self.assertIn("agora docs generate", text.splitlines()[0])
        commands = files[HOME / "docs-src/chapters/reference/commands.adoc"]
        for c in reg.commands:
            self.assertIn(f"agora {c}", commands, c)
        for n in reg.nouns:
            self.assertIn(f"=== {n}\n", commands, n)
        self.assertEqual(files, guide.reference_files(reg, HOME, entries()), "deterministic")
        toolchain = files[HOME / "docs-src/chapters/reference/toolchain.adoc"]
        for e in ("jre", "asciidoctor", "asciidoctor-pdf", "vscode", "extension-build"):
            self.assertIn(f"|`{e}`", toolchain)
        self.assertIn("Xvfb", toolchain)
        topics = files[HOME / "docs-src/chapters/reference/help-topics.adoc"]
        for t in reg.topics:
            self.assertIn(f"=== {t}\n", topics)

    def test_docs_generate_dry_run_writes_nothing_and_a_current_tree_changes_nothing(self):
        code, doc = run_json(["docs", "generate", "--dry-run"])
        self.assertEqual((code, doc["data"]["dry_run"], doc["data"]["changes"]), (0, True, []))


FAKE_ASCIIDOCTOR = r'''#!{python}
import re, sys, zipfile
from pathlib import Path
args = sys.argv[1:]
out_dir = out_file = backend = None
files = []
i = 0
while i < len(args):
    a = args[i]
    if a in ("-D", "-o", "-b", "-a"):
        v = args[i + 1]
        i += 2
        if a == "-D": out_dir = v
        if a == "-o": out_file = v
        if a == "-b": backend = v
        continue
    if a.startswith("-"):
        i += 1
        continue
    files.append(a)
    i += 1
def title(p):
    m = re.search(r"^== (.+)$", Path(p).read_text(), re.M)
    return m.group(1) if m else Path(p).stem
if out_dir:
    for f in files:
        stem = Path(f).stem
        other = "faq" if stem != "faq" else "preface"
        body = '<div class="sect1"><h2 id="%s">%s</h2><p>Words.</p><a href="#%s">[%s]</a><img src="../assets/logo.webp" alt=""></div>' % (stem, title(f), other, other)
        (Path(out_dir) / (stem + ".html")).parent.mkdir(parents=True, exist_ok=True)
        (Path(out_dir) / (stem + ".html")).write_text(body)
elif backend == "pdf":
    Path(out_file).write_bytes(b"%PDF-1.7 fake")
elif backend == "epub3":
    with zipfile.ZipFile(out_file, "w") as z:
        z.writestr("mimetype", "application/epub+zip")
else:
    Path(out_file).write_text("<html><body>one page</body></html>")
'''


class FakeResolved:
    def __init__(self, script):
        self.script = script

    def argv(self, program):
        return [str(self.script)]

    def env(self):
        return {"PATH": "/usr/bin:/bin"}


class FakeToolchain:
    def __init__(self, script, pdf=True):
        self.r, self.pdf = FakeResolved(script), pdf

    def resolve(self, names):
        return self.r

    def use(self, names):
        if "asciidoctor-pdf" in names and not self.pdf:
            raise AgoraError("offline", "offline, and the toolchain cache lacks: asciidoctor-pdf 2.3.27", exit=3)
        return self.r


class Build(unittest.TestCase):
    """`docs build`: four editions, each said to be built, failed or skipped, and links that all resolve (0042 FR-034)."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)
        self.script = self.dir / "asciidoctor"
        self.script.write_text(FAKE_ASCIIDOCTOR.replace("{python}", sys.executable))
        self.script.chmod(self.script.stat().st_mode | stat.S_IXUSR)
        self.out = self.dir / "out"

    def build(self, pdf=True):
        return guide.build_all(HOME, self.out, FakeToolchain(self.script, pdf), "agora", False)

    def test_the_four_editions_are_built_and_the_site_has_a_page_for_each_chapter(self):
        rows = {r["edition"]: r for r in self.build()}
        self.assertEqual({k: v["status"] for k, v in rows.items()}, {"multi-page HTML": "built", "single-page HTML": "built", "PDF": "built", "EPUB": "built"})
        self.assertEqual(set(guide.EDITIONS), set(rows))
        chapters = guide.manuscript(HOME)
        for c in chapters:
            self.assertTrue((self.out / "guide" / f"{c['slug']}.html").is_file(), c["slug"])
        self.assertEqual((self.out / "guide" / "index.html").read_text(), (self.out / "guide" / f"{chapters[0]['slug']}.html").read_text())
        page = (self.out / "guide" / "first-day.html").read_text()
        self.assertIn('<a href="faq.html#faq">', page, "a cross-reference to another chapter points at that chapter's page")
        self.assertIn('class="current"', page)
        for f in ("index.html", "guide.html", "guide.pdf", "guide.epub", ".nojekyll", "assets/logo.webp", "assets/brand.css", "assets/InterVariable.ttf",
                  "guide/html.css", "guide/site.css", "guide.css"):
            self.assertTrue((self.out / f).exists(), f)
        self.assertEqual(guide.site_links(self.out), [])

    def test_the_landing_page_is_the_hand_written_one_and_uses_only_the_brands_assets(self):  # 0042 FR-035
        self.build()
        self.assertEqual((self.out / "index.html").read_text(), (HOME / "docs" / "index.html").read_text())
        for name, src in guide.ASSETS.items():
            self.assertEqual((self.out / "assets" / name).read_bytes(), (HOME / src).read_bytes())

    def test_a_converter_that_cannot_be_had_is_skipped_with_the_reason_never_built(self):
        rows = {r["edition"]: r for r in self.build(pdf=False)}
        self.assertEqual(rows["PDF"]["status"], "skipped")
        self.assertIn("asciidoctor-pdf", rows["PDF"]["reason"])
        self.assertFalse((self.out / "guide.pdf").exists())
        self.assertEqual(rows["EPUB"]["status"], "built")

    def test_a_converter_that_fails_is_reported_failed_with_its_output(self):
        self.script.write_text("#!/bin/sh\necho 'asciidoctor: FAILED: boom' >&2\nexit 1\n")
        rows = self.build()
        self.assertTrue(all(r["status"] == "failed" for r in rows if r["edition"] != "PDF"))
        self.assertIn("boom", rows[0]["reason"])

    def test_a_link_that_points_at_nothing_is_found_by_file_and_by_fragment(self):
        self.build()
        page = self.out / "guide" / "first-day.html"
        page.write_text(page.read_text().replace("</body>", '<a href="missing.html">x</a><a href="faq.html#nope">y</a><a href="#nowhere">z</a><a href="https://example.org/">ok</a></body>'))
        found = guide.site_links(self.out)
        self.assertTrue(any("first-day.html: missing.html points at a file that does not exist" in m for m in found), found)
        self.assertTrue(any("faq.html#nope points at an id" in m for m in found), found)
        self.assertTrue(any("#nowhere" in m for m in found), found)
        self.assertFalse(any("example.org" in m for m in found))

    def test_the_manuscript_lists_every_chapter_file_and_no_chapter_is_left_out(self):
        listed = {c["file"] for c in guide.manuscript(HOME)}
        on_disk = {str(p.relative_to(HOME / "docs-src")) for p in (HOME / "docs-src" / "chapters").rglob("*.adoc")}
        self.assertEqual(listed, on_disk)

    def test_docs_build_dry_run_plans_the_editions_and_writes_nothing(self):
        with mock.patch("agora.core.cli.check_programs"):  # the converters are not fetched for a plan
            code, doc = run_json(["docs", "build", "--dry-run", "--out", str(self.out)])
        self.assertEqual(code, 0)
        self.assertEqual([e["edition"] for e in doc["data"]["editions"]], list(guide.EDITIONS))
        self.assertFalse(self.out.exists())
        self.assertTrue(doc["data"]["dry_run"])

    def test_the_command_exits_3_when_an_edition_is_skipped_and_1_when_one_fails(self):
        with mock.patch("agora.core.cli.check_programs"), mock.patch.object(guide, "build_all") as built:
            built.return_value = [{"edition": "multi-page HTML", "status": "built", "file": "guide/index.html", "seconds": 1, "reason": ""},
                                  {"edition": "PDF", "status": "skipped", "file": "guide.pdf", "seconds": 0, "reason": "x"}]
            with mock.patch.object(guide, "site_links", return_value=[]):
                self.assertEqual(run_json(["docs", "build", "--out", str(self.out)])[0], 3)
            built.return_value[0]["status"] = "failed"
            with mock.patch.object(guide, "site_links", return_value=[]):
                self.assertEqual(run_json(["docs", "build", "--out", str(self.out)])[0], 1)
            built.return_value[0]["status"] = "built"
            with mock.patch.object(guide, "site_links", return_value=["x.html: a points at a file that does not exist"]):
                self.assertEqual(run_json(["docs", "build", "--out", str(self.out)])[0], 1)

    def test_the_converters_are_toolchain_entries_never_the_host(self):  # 0042 FR-034
        reg = Registry.load(HOME)
        self.assertEqual(reg.commands["docs build"].toolchain, ("jre", "asciidoctor"))
        from agora.core.toolchain import discover as entries
        e = entries()
        self.assertEqual(e["asciidoctor-pdf"].needs, ("jre", "asciidoctor"))
        self.assertEqual(e["asciidoctor"].needs, ("jre",))


class Pins(unittest.TestCase):
    """The jre and asciidoctor entries are the pins other repositories' toolchains hold, so one cache can serve both (0042 FR-030)."""

    def test_the_versions_and_addresses_are_the_agreed_ones(self):
        from agora.toolchain import asciidoctor, jre
        self.assertEqual(jre.ENTRY.version, "21.0.12.1+1")
        self.assertEqual(jre.ENTRY.platforms["linux-x86_64"][0].sha256, "2413149700df0f7d440500a84a8f764c535f21e5a5e87d38328b64eec2c5b500")
        self.assertEqual(asciidoctor.ENTRY.version, "3.0.1")
        a = asciidoctor.ENTRY.platforms["linux-x86_64"][0]
        self.assertEqual(a.sha256, "18b085b7f67a7f872abe00352be5caacd9b436400aec27f838c6380077cb88bf")
        self.assertEqual(a.url, "https://repo1.maven.org/maven2/org/asciidoctor/asciidoctorj/3.0.1/asciidoctorj-3.0.1-bin.zip")
        self.assertEqual(set(jre.ENTRY.platforms), {"linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64"})

    def test_vscode_is_pinned_by_version_with_the_vendors_checksum_for_each_platform(self):
        from agora.toolchain import vscode
        self.assertEqual(vscode.ENTRY.version, "1.140.0")
        for p, archives in vscode.ENTRY.platforms.items():
            (a,) = archives
            self.assertTrue(a.url.startswith("https://vscode.download.prss.microsoft.com/dbazure/download/stable/" + vscode.COMMIT + "/"), p)
            self.assertEqual(len(a.sha256), 64)
        self.assertEqual(set(vscode.ENTRY.platforms), {"linux-x86_64", "linux-aarch64", "macos-arm64", "macos-x86_64"})


if __name__ == "__main__":
    unittest.main()
