import re
import shutil
import tempfile
import unittest
from pathlib import Path

from .helpers import HOME, run_json


class CommandsSection(unittest.TestCase):
    """0042 FR-004: the registry and the ontology list the same commands, with the same noun, verb and category."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name)
        shutil.copytree(HOME / "tools" / "agora", self.home / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        (self.home / "ontology").mkdir()
        shutil.copy(HOME / "agora", self.home / "agora")
        shutil.copy(HOME / ".gitignore", self.home / ".gitignore")
        self.ttl = (HOME / "ontology" / "ifcore.ttl").read_text()

    def findings(self, ttl=None):
        (self.home / "ontology" / "ifcore.ttl").write_text(self.ttl if ttl is None else ttl)
        code, doc = run_json(["check", "commands"], home=self.home)
        return code, [f["message"] for f in doc["data"]["sections"][0]["findings"]]

    def test_they_agree_here(self):
        self.assertEqual(self.findings(), (0, []))

    def test_a_command_the_ontology_lacks(self):
        ttl = re.sub(r"ifcore:AgoraSpecShowCommand a .*?hasAudience ifcore:Public \.\n", "", self.ttl, flags=re.S)
        code, found = self.findings(ttl)
        self.assertEqual(code, 1)
        self.assertTrue(any("'spec show' is in the registry and has no ifcore:Command individual" in m for m in found))

    def test_a_command_the_registry_lacks(self):
        extra = ('ifcore:AgoraSpecFrobCommand a ifcore:Command ; ifcore:commandOf ifcore:Agora ; dcterms:identifier "spec frob" ;\n'
                 '    ifcore:commandNoun ifcore:SpecResourceKind ; ifcore:commandCategory ifcore:ReadCommandCategory .\n')
        code, found = self.findings(self.ttl + "\n" + extra)
        self.assertEqual(code, 1)
        self.assertTrue(any("declares command 'spec frob', which the registry does not" in m for m in found))

    def test_a_category_noun_or_verb_that_differs(self):
        ttl = self.ttl.replace('dcterms:identifier "spec show" ;\n    ifcore:commandNoun ifcore:SpecResourceKind ; ifcore:commandVerb ifcore:ShowCommandVerb ; ifcore:commandCategory ifcore:ReadCommandCategory',
                               'dcterms:identifier "spec show" ;\n    ifcore:commandNoun ifcore:TermResourceKind ; ifcore:commandVerb ifcore:ListCommandVerb ; ifcore:commandCategory ifcore:BuildCommandCategory')
        self.assertNotEqual(ttl, self.ttl)
        code, found = self.findings(ttl)
        self.assertEqual(code, 1)
        text = "\n".join(found)
        for k in ("noun", "verb", "category"):
            self.assertIn(f"{k} is", text)

    def test_a_planned_command_that_is_also_implemented(self):
        m = self.home / "tools" / "agora" / "agora.toml"
        m.write_text(m.read_text().replace('[planned.commands]\n', '[planned.commands]\n"spec show" = "read"\n'))
        code, found = self.findings()
        self.assertEqual(code, 1)
        self.assertTrue(any("implemented and still listed as planned" in x for x in found))

    def test_a_manifest_section_with_no_implementation(self):
        m = self.home / "tools" / "agora" / "groups" / "spec" / "agora.toml"
        m.write_text(m.read_text() + '\n[sections.ghost]\nhelp = "x"\n')
        code, found = self.findings()
        self.assertTrue(any("section ghost is declared" in x for x in found))
