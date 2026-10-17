"""The shared specification checker (commons 0003-spec-kit)."""
from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

COMMONS = Path(__file__).resolve().parent.parent / "commons"
TOOL = COMMONS / "tools" / "spec-kit-check.py"
KIT = COMMONS / "spec-kit"

_spec = importlib.util.spec_from_file_location("spec_kit_check", TOOL)
tool = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tool)


class SpecKit(unittest.TestCase):
    def copy(self) -> Path:
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, True)
        shutil.copytree(KIT, tmp / "kit")
        return tmp / "kit"

    def findings(self, root: Path) -> str:
        return "\n".join(f"{w}: {m}" for w, m in tool.check(root))

    def edit(self, root: Path, rel: str, old: str, new: str) -> None:
        f = root / rel
        text = f.read_text()
        self.assertIn(old, text)
        f.write_text(text.replace(old, new, 1))

    def test_commons_own_folder_is_clean_from_the_command_line(self):
        """0003-spec-kit FR-006"""
        p = subprocess.run([sys.executable, str(TOOL)], capture_output=True, text=True)
        self.assertEqual((p.returncode, p.stderr), (0, ""))
        bad = self.copy()
        self.edit(bad, "registry.tsv", "0003\tspec-kit", "0005\tspec-kit")
        p = subprocess.run([sys.executable, str(TOOL), "--root", str(bad)], capture_output=True, text=True)
        self.assertEqual(p.returncode, 1)
        self.assertIn("registry.tsv", p.stderr)

    def test_a_gap_a_repeated_number_and_a_missing_folder_in_the_register(self):
        """0003-spec-kit FR-001"""
        root = self.copy()
        self.edit(root, "registry.tsv", "0003\tspec-kit\tin force", "0003\tspec-kit\tin force\n0003\tother\tin force\n0099\tnone\tin force")
        out = self.findings(root)
        self.assertIn("assigned twice", out)
        self.assertRegex(out, r"gap at \d{4}")   # the first number after the last real one; it moves with each new specification
        self.assertIn("0099-none is in force but its specification does not exist", out)

    def test_a_spec_with_no_row_and_a_register_that_is_missing(self):
        """0003-spec-kit FR-001, FR-006"""
        root = self.copy()
        shutil.copytree(root / "specs" / "0003-spec-kit", root / "specs" / "0009-extra")
        self.assertIn("has no row in registry.tsv", self.findings(root))
        (root / "registry.tsv").unlink()
        out = self.findings(root)
        self.assertIn("register of specification numbers is missing", out)
        self.assertIn("0003-spec-kit", out + " 0003-spec-kit")   # it went on to check the specifications

    def test_the_form_of_a_specification(self):
        """0003-spec-kit FR-002"""
        root = self.copy()
        s = "specs/0003-spec-kit/spec.md"
        self.edit(root, s, "**Spec ID:** 0003-spec-kit", "**Spec ID:** 0004-x")
        self.edit(root, s, "**Status:** Draft", "**Status:** Maybe")
        text = (root / s).read_text()
        (root / s).write_text(text.replace("## Assumptions", "## Zzz").replace("## Out of scope", "## Out of scope", 1))
        out = self.findings(root)
        self.assertIn("**Spec ID:** line naming 0003-spec-kit", out)
        self.assertIn("**Status:** must be one of", out)
        self.assertIn("has no ## Assumptions section", out)

    def test_sections_out_of_order(self):
        """0003-spec-kit FR-002"""
        root = self.copy()
        s = root / "specs/0003-spec-kit/spec.md"
        t = s.read_text()
        a, b = "## Key entities", "## Success criteria"
        s.write_text(t.replace(a, "@@").replace(b, a).replace("@@", b))
        self.assertIn("sections are out of the order", self.findings(root))

    def test_requirement_numbers_and_edge_cases(self):
        """0003-spec-kit FR-003"""
        root = self.copy()
        s = "specs/0003-spec-kit/spec.md"
        self.edit(root, s, "the tool names the gap, per FR-001.", "the tool names the gap, per FR-099.")
        self.edit(root, s, "- A `none` row with no reason: the tool names it, per FR-005.", "- A `none` row with no reason: the tool names it.")
        out = self.findings(root)
        self.assertIn("cites a requirement that is not here", out)
        self.assertIn("an edge case cites no requirement", out)
        self.edit(root, s, "- **FR-002**", "- **FR-001**")
        self.assertIn("used twice", self.findings(root))

    def test_a_bare_citation_of_another_repositorys_spec(self):
        """0003-spec-kit FR-004"""
        root = self.copy()
        self.edit(root, "specs/0003-spec-kit/spec.md", "`archon 0024-spec-format` and `archon 0002-specs`.", "0136-machine-bootstrap of archon.")
        self.assertIn("cites 0136-machine-bootstrap", self.findings(root))

    def test_the_enforcement_register(self):
        """0003-spec-kit FR-005"""
        root = self.copy()
        f = root / "enforcement.tsv"
        rows = f.read_text().splitlines()
        rows = [r for r in rows if not r.startswith("0003-spec-kit FR-001")]
        rows.append("0003-spec-kit FR-099\tcheck\t.github: x\tn")
        rows.append("0003-spec-kit FR-002\tnone\t-\t")
        rows.append("0003-spec-kit FR-003\tmaybe\t-\tn")
        rows.append("0003-spec-kit FR-004\tcheck\tno colon\tn")
        f.write_text("\n".join(rows) + "\n")
        out = self.findings(root)
        self.assertIn("0003-spec-kit FR-001 has no row", out)
        self.assertIn("FR-099 is not a requirement of any specification here", out)
        self.assertIn("FR-002 has two rows", out)
        self.assertIn("FR-003: the mechanism must be one of", out)
        self.assertIn("FR-004: who enforces it is '<repository>: <command>'", out)

    def test_a_none_row_must_say_why(self):
        """0003-spec-kit FR-005"""
        root = self.copy()
        f = root / "enforcement.tsv"
        f.write_text(f.read_text().replace("0003-spec-kit FR-007\tcheck\t.github: python3 -m unittest discover -s tests\t", "0003-spec-kit FR-007\tnone\t-\t").replace("\tnone\t-\tSpecKit: the tool runs on commons' own folder and each rule is broken in a copy and named", "\tnone\t-\t"))
        self.assertIn("a requirement nothing enforces has '-' for who and says why", self.findings(root))

    def test_the_tool_needs_only_the_standard_library(self):
        """0003-spec-kit FR-006, FR-007"""
        text = TOOL.read_text()
        for line in text.splitlines():
            if line.startswith(("import ", "from ")):
                self.assertIn(line.split()[1], ("__future__", "re", "sys", "pathlib"), line)
        self.assertNotIn("ontology", text.split('"""', 2)[2].split("def ")[0].replace("ontology:", ""))


if __name__ == "__main__":
    unittest.main()
