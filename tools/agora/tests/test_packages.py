"""The packages that replace the host's programs (0042-agora FR-030; 0025-tooling-environment FR-007, FR-026): the locks
agree, Node is the package's, Git is read by dulwich, and the harnesses read PDFs and render SVG with pinned packages."""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from agora.core import plan
from agora.core.registry import Registry
from agora.lib import gitstate, node

from .helpers import HOME

DS = HOME / "design-systems"


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, str(path.parent.parent))
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.path.pop(0)
    return mod


class Locks(unittest.TestCase):
    def setUp(self):
        self.reg = Registry.load(HOME)

    def test_the_selftest_group_holds_every_package_at_the_version_its_group_pins(self):
        selftest = {k.lower(): v for k, v in self.reg.groups["selftest"].packages.items()}
        for g in self.reg.groups.values():
            for name, ver in g.packages.items():
                if g.name != "selftest":
                    self.assertEqual(selftest.get(name.lower()), ver, f"{name} of group {g.name}")

    def test_every_group_lock_matches_its_pins_and_hashes_every_distribution(self):
        for g in self.reg.groups.values():
            self.assertEqual(plan.lock_problems(g), [], g.name)

    def test_the_replacements_are_pinned_where_their_commands_run(self):  # 0042 FR-030
        pins = lambda g: {k.lower() for k in self.reg.groups[g].packages}
        self.assertLessEqual({"pillow"}, pins("brand"))
        self.assertLessEqual({"pillow", "potracer", "resvg-py"}, pins("decoration"))
        self.assertLessEqual({"pillow", "resvg-py", "reportlab", "fonttools"}, pins("items"))
        self.assertLessEqual({"pypdf", "pypdfium2", "resvg-py", "reportlab"}, pins("assurance"))
        self.assertEqual(pins("vcs"), {"dulwich"})
        for banned in ("pymupdf", "fitz", "cairosvg"):  # AGPL; and a package that needs the host's libcairo
            self.assertFalse(any(banned in p for g in self.reg.groups for p in pins(g)), banned)

    def test_the_spec_suites_groups_pin_no_package(self):  # 0042 FR-018
        suite = {self.reg.sections[s.split()[0]].group for s in self.reg.suites["spec"]["sections"]}
        for g in suite:
            self.assertEqual(self.reg.groups[g].packages, {}, g)


class NoReferenceEnvironment(unittest.TestCase):
    def test_agora_holds_no_pin_and_no_environment_noun_command_section_or_resource(self):  # 0042 FR-011; 0025 FR-008
        reg = Registry.load(HOME)
        self.assertNotIn("environment", reg.nouns)
        self.assertEqual([c for c in reg.commands if c.split()[0] == "environment"], [])
        self.assertNotIn("environment", reg.sections)
        from agora.core import mcp
        self.assertNotIn("environment", mcp.KINDS)
        for gone in ("tools/reference-environment", ".github/workflows/reference-environment.yml", ".devcontainer/devcontainer.json",
                     "tools/agora/lib/environment.py"):
            self.assertFalse((HOME / gone).exists(), gone)


class Pdfs(unittest.TestCase):
    """The harnesses read PDFs with pypdf and pypdfium2, in place of poppler's programs."""

    @classmethod
    def setUpClass(cls):
        cls.signage = load(DS / "frontiers-signage-print" / "signage.py", "signage_under_test")
        cls.print_run = load(DS / "frontiers-print" / "assurance" / "run.py", "print_run_under_test")
        cls.sign_run = load(DS / "frontiers-signage-print" / "assurance" / "run.py", "sign_run_under_test")
        cls.tmp = tempfile.TemporaryDirectory()
        cls.pdf = Path(cls.tmp.name, "badge.pdf")
        job = json.loads((DS / "frontiers-signage-print" / "assurance" / "fixtures" / "pass" / "event-badge.json").read_text())
        cls.signage.render(job, DS / "frontiers-brand", cls.pdf)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_the_print_harness_reads_size_fonts_images_and_text(self):
        size, fonts, images, text = self.print_run.pdf_facts(self.pdf)
        self.assertEqual([round(v) for v in size], [306, 234])
        self.assertTrue(fonts and all(emb for _, emb in fonts))
        self.assertEqual({base.split("+")[-1] for base, _ in fonts}, {"Inter-Bold", "Inter-Regular"})
        self.assertGreaterEqual(images, 1)  # the lockup
        self.assertIn("A. Speaker", " ".join(text.split()))
        self.assertFalse([c for c in text if 0xE000 <= ord(c) <= 0xF8FF])  # no private-use code point in the text layer

    def test_the_signage_harness_reads_pages_size_and_fonts(self):
        pages, size, fonts = self.sign_run.pdf_facts(self.pdf)
        self.assertEqual((pages, [round(v) for v in size]), (1, [306, 234]))
        self.assertTrue(all(emb for _, emb in fonts))

    def test_the_sign_is_a_vector_pdf_and_the_same_bytes_every_time(self):
        again = Path(self.tmp.name, "again.pdf")
        job = json.loads((DS / "frontiers-signage-print" / "assurance" / "fixtures" / "pass" / "event-badge.json").read_text())
        self.signage.render(job, DS / "frontiers-brand", again)
        self.assertEqual(again.read_bytes(), self.pdf.read_bytes())
        import pypdfium2
        doc = pypdfium2.PdfDocument(str(self.pdf))
        try:
            self.assertIn("Speaker", doc[0].get_textpage().get_text_range())  # text, not pixels
        finally:
            doc.close()

    def test_a_font_that_is_not_embedded_is_reported_as_such(self):
        from reportlab.pdfgen import canvas
        plain = Path(self.tmp.name, "plain.pdf")
        c = canvas.Canvas(str(plain), pagesize=(100, 100))
        c.drawString(10, 10, "hi")
        c.save()
        _, fonts, _, _ = self.print_run.pdf_facts(plain)
        self.assertEqual(fonts, [("Helvetica", False)])


class Svg(unittest.TestCase):
    """resvg-py renders with the design systems' own fonts and no font of the machine's."""

    def test_media_renders_the_same_png_whatever_fonts_the_machine_has(self):
        media = load(DS / "frontiers-media" / "media.py", "media_under_test")
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80"><rect width="300" height="80" fill="#fff"/>'
               '<text x="8" y="50" font-family="Inter" font-size="36" font-weight="700">Frontiers</text></svg>')
        with_fonts = media.rasterize(svg)
        import resvg_py
        blank = bytes(resvg_py.svg_to_bytes(svg_string=svg, skip_system_fonts=True))
        self.assertNotEqual(with_fonts, blank)  # the text shows because fonts/ gave the renderer Inter
        with mock.patch.dict(os.environ, {"FONTCONFIG_FILE": "/nonexistent", "XDG_DATA_DIRS": "/nonexistent"}):
            self.assertEqual(media.rasterize(svg), with_fonts)

    def test_the_figures_harness_proves_its_text_is_set_in_the_shipped_sans(self):
        run = load(DS / "frontiers-figures" / "assurance" / "run.py", "figures_run_under_test")
        res = run.run(DS / "frontiers-brand", None)
        self.assertEqual(res.failed, [])
        self.assertGreater(res.passed, 50)


if __name__ == "__main__":
    unittest.main()
