"""`design-system list`, `show` and `new` (0042-agora FR-006, FR-009; 0001-eidolon-architecture FR-037)."""
from __future__ import annotations

import shutil
import json

from agora.core.registry import Registry
from agora.lib import design_systems

from .helpers import HOME, TempRepo, run_json, spec_text


KIND_TTL = """@prefix ifcore: <https://example.test/ifcore#> .

ifcore:DesignSystemKindScheme a skos:ConceptScheme ; rdfs:label "Design system kind"@en .
ifcore:WebDesignSystemKind a skos:Concept ; skos:inScheme ifcore:DesignSystemKindScheme ; skos:prefLabel "web presentation"@en ;
    skos:notation "web" ;
    ifcore:hasAudience ifcore:Public .
ifcore:BrandDesignSystemKind a skos:Concept ; skos:inScheme ifcore:DesignSystemKindScheme ; skos:prefLabel "brand"@en ;
    skos:notation "brand" ;
    ifcore:hasAudience ifcore:Public .

ifcore:ToyWeb a ifcore:DesignSystem ;
    dcterms:identifier "toy-web" ;
    rdfs:label "Toy Web"@en ;
    ifcore:designSystemStatus ifcore:DraftDesignSystem ;
    dcterms:type ifcore:WebDesignSystemKind ;
    rdfs:comment "At design-systems/toy-web/."@en ;
    ifcore:hasAudience ifcore:Public .
"""


class ToyRepo(TempRepo):
    """A clone holding agora's code, a spec, the register and a one-design-system ontology."""

    def setUp(self) -> None:
        super().setUp()
        shutil.copytree(HOME / "tools" / "agora", self.root / "tools" / "agora", ignore=shutil.ignore_patterns("__pycache__", "tests"))
        self.write("ontology/ifcore.ttl", KIND_TTL)
        self.write("design-systems/toy-web/spec.md", spec_text("toy-web"))


class DesignSystems(ToyRepo):
    def go(self, *argv):
        return run_json(list(argv), home=self.root)

    def tree(self):
        return sorted(str(p.relative_to(self.root)) for p in (self.root / "design-systems").rglob("*") if p.is_file())

    def test_list_and_show_read_the_ontology_and_the_directory(self):
        code, doc = run_json(["design-system", "list", "--root", str(self.root)])
        self.assertEqual(code, 0)
        row = doc["data"]["design systems"][0]
        self.assertEqual((row["slug"], row["kind"], row["status"], row["spec"], row["harness"]), ("toy-web", "web", "Draft", "Draft", "none"))
        self.assertEqual(doc["links"][0]["cli"], "agora design-system show toy-web")
        self.assertEqual(run_json(["design-system", "list", "--kind", "brand", "--root", str(self.root)])[1]["data"]["count"], 0)
        code, doc = run_json(["design-system", "show", "toy-web", "--root", str(self.root)])
        d = doc["data"]
        self.assertEqual((d["registered"], d["label"], d["readme"], d["requirements"]), (True, "Toy Web", False, 1))
        self.assertIn("agora spec show toy-web", [l["cli"] for l in doc["links"]])
        self.assertEqual(run_json(["design-system", "show", "nope", "--root", str(self.root)])[0], 2)

    def test_this_repositorys_design_systems_are_all_read(self):
        code, doc = run_json(["design-system", "list"])
        rows = {r["slug"]: r for r in doc["data"]["design systems"]}
        self.assertEqual(rows["frontiers-brand"]["kind"], "brand")
        self.assertEqual(rows["frontiers-spoken-voice"]["kind"], "spoken-voice")
        for r in rows.values():
            self.assertNotEqual(r["status"], "unregistered", r["slug"])
        d = run_json(["design-system", "show", "frontiers-spoken-voice"])[1]["data"]
        self.assertEqual(d["derives from"], ["frontiers-written-voice"])
        self.assertEqual(run_json(["design-system", "show", "frontiers-written-voice"])[1]["data"]["derived by"], ["frontiers-spoken-voice"])

    def test_new_refuses_without_the_spec_first(self):  # 0042 FR-009
        (self.root / "design-systems/toy-web/spec.md").unlink()
        code, doc = self.go("design-system", "new", "toy-web", "--kind", "web")
        self.assertEqual((code, doc["data"]["code"]), (1, "no-spec"))
        self.assertEqual(self.tree(), [])

    def test_new_refuses_without_the_ontology_entry(self):
        self.write("design-systems/other-web/spec.md", spec_text("other-web"))
        code, doc = self.go("design-system", "new", "other-web", "--kind", "web")
        self.assertEqual((code, doc["data"]["code"]), (1, "no-entry"))
        self.assertEqual(self.tree(), ["design-systems/other-web/spec.md", "design-systems/toy-web/spec.md"])

    def test_new_refuses_a_kind_that_is_not_the_entrys_or_not_the_slugs(self):
        code, doc = self.go("design-system", "new", "toy-web", "--kind", "brand")
        self.assertEqual((code, doc["data"]["code"]), (2, "kind"))
        self.assertIn("does not end with -brand", doc["data"]["message"])
        self.write("design-systems/toy-brand/spec.md", spec_text("toy-brand"))
        self.write("ontology/ifcore.ttl", (self.root / "ontology/ifcore.ttl").read_text() + """
ifcore:ToyBrand a ifcore:DesignSystem ;
    dcterms:identifier "toy-brand" ;
    rdfs:label "Toy Brand"@en ;
    ifcore:designSystemStatus ifcore:DraftDesignSystem ;
    dcterms:type ifcore:WebDesignSystemKind ;
    ifcore:hasAudience ifcore:Public .
""")
        code, doc = self.go("design-system", "new", "toy-brand", "--kind", "brand")  # registered as web
        self.assertEqual((code, doc["data"]["code"]), (2, "kind"))
        self.assertIn("a kind never changes", doc["data"]["message"])
        self.assertEqual(self.go("design-system", "new", "toy-web", "--kind", "nonsense")[0], 2)  # not a kind of the scheme

    def test_new_scaffolds_only_what_is_missing_and_never_overwrites(self):  # 0014 FR-006
        code, doc = self.go("design-system", "new", "toy-web", "--kind", "web", "--dry-run")
        self.assertEqual((code, [c["change"] for c in doc["data"]["changes"]], doc["data"]["dry_run"]), (0, ["create", "create"], True))
        self.assertEqual(self.tree(), ["design-systems/toy-web/spec.md"])
        code, doc = self.go("design-system", "new", "toy-web", "--kind", "web")
        self.assertEqual(code, 0)
        self.assertEqual(self.tree(), ["design-systems/toy-web/README.md", "design-systems/toy-web/assurance/run.py", "design-systems/toy-web/spec.md"])
        readme = (self.root / "design-systems/toy-web/README.md").read_text()
        self.assertIn("# Toy Web: design system", readme)
        self.assertNotIn("Active", readme)  # its status is the ontology's, not the README's (0014 FR-011)
        self.assertEqual(design_systems.harness_files(self.root, "toy-web"), ["assurance/run.py"])
        (self.root / "design-systems/toy-web/README.md").write_text("mine\n")
        code, doc = self.go("design-system", "new", "toy-web", "--kind", "web")
        self.assertEqual((code, doc["data"]["changes"]), (0, []))
        self.assertEqual((self.root / "design-systems/toy-web/README.md").read_text(), "mine\n")
        self.assertIn("design-systems/toy-web/README.md", doc["data"]["kept"])

    def test_a_harness_it_already_has_is_not_replaced_by_a_stub(self):
        self.write("design-systems/toy-web/assurance/run.mjs", "//")
        code, doc = self.go("design-system", "new", "toy-web", "--kind", "web")
        self.assertEqual((code, [c["path"] for c in doc["data"]["changes"]]), (0, ["design-systems/toy-web/README.md"]))
        self.assertIn("design-systems/toy-web/assurance/run.mjs", doc["data"]["kept"])

    def test_the_stub_harness_fails_until_it_has_tests(self):  # 0014 FR-015
        import subprocess, sys
        self.go("design-system", "new", "toy-web", "--kind", "web")
        p = subprocess.run([sys.executable, str(self.root / "design-systems/toy-web/assurance/run.py")], capture_output=True, text=True)
        self.assertEqual(p.returncode, 1)
        self.assertIn("no tests yet", p.stdout)

    def test_new_is_a_generate_command_that_writes_no_git_state_and_refuses_root(self):
        reg = Registry.load(HOME)
        self.assertEqual(reg.find("design-system new").category, "generate")
        code, doc = run_json(["design-system", "new", "toy-web", "--kind", "web", "--root", str(self.root)])
        self.assertEqual((code, doc["data"]["code"]), (2, "usage"))
