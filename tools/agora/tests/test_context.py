"""`context RESOURCE` for every kind of resource that has a context provider (0041-command-line FR-038)."""
import json
import unittest

from agora.core.registry import Registry

from .helpers import HOME, run, run_json

# One resource of each kind that has a provider; a provider added without one here fails the first test.
EXAMPLES = {"spec": "0020", "requirement": "0020/FR-013", "design-system": "frontiers-brand", "brand": "frontiers-brand",
            "ontology": "ifcore:ReadCommandCategory", "command": "spec show"}
NEEDS_A_CLONE = {"proposal"}  # tested with the proposals, in a clone that holds one


class Contexts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.reg = Registry.load(HOME)

    def test_every_provider_has_an_example_here_and_a_type_that_validates_it(self):
        self.assertEqual(set(self.reg.contexts) - NEEDS_A_CLONE, set(EXAMPLES))
        self.assertEqual(set(self.reg.contexts), {"spec", "requirement", "design-system", "brand", "ontology", "command", "proposal"})

    def test_each_kind_returns_the_same_parts_in_the_same_shape(self):
        for kind, ident in EXAMPLES.items():
            with self.subTest(kind=kind):
                code, doc = run_json(["context", f"{kind}:{ident}"])
                self.assertEqual(code, 0, doc)
                d = doc["data"]
                self.assertEqual((doc["kind"], doc["audience"]), ("context", "public"))
                self.assertEqual(list(d), ["resource", "specs", "requirements", "files", "omitted"])
                self.assertTrue(d["resource"])
                self.assertTrue(all(isinstance(f, str) for f in d["files"]), d["files"])
                self.assertTrue(d["files"])
                self.assertTrue(all({"name", "status"} <= set(s) for s in d["specs"]), d["specs"])
                self.assertTrue(all({"id", "mechanism", "text"} <= set(r) for r in d["requirements"]))
                self.assertTrue(doc["links"], kind)
                self.assertTrue(all(l["cli"].startswith("agora ") for l in doc["links"] + doc["actions"]))

    def test_each_kind_is_deterministic_and_bounded_and_says_what_it_left_out(self):
        for kind, ident in EXAMPLES.items():
            with self.subTest(kind=kind):
                a = run(["context", f"{kind}:{ident}", "--json"])[1]
                self.assertEqual(a, run(["context", f"{kind}:{ident}", "--json"])[1])
                d = json.loads(a)["data"]
                for key in ("specs", "requirements", "files"):
                    self.assertLessEqual(len(d[key]), 60)
        d = run_json(["context", "spec:0001"])[1]["data"]  # a spec with more requirements than the bound
        self.assertTrue(d["omitted"])

    def test_a_spec_design_system_and_brand_name_the_requirements_that_govern_them(self):
        spec = run_json(["context", "spec:frontiers-brand"])[1]["data"]
        ds = run_json(["context", "design-system:frontiers-brand"])[1]["data"]
        self.assertEqual([r["id"] for r in ds["requirements"]], [r["id"] for r in spec["requirements"]])
        self.assertTrue(ds["requirements"])
        brand = run_json(["context", "brand:frontiers-brand"])[1]["data"]
        self.assertEqual(brand["specs"][0]["name"], "frontiers-brand")
        self.assertIn("design-systems/frontiers-brand/tokens.json", brand["files"])

    def test_a_bare_id_the_kinds_can_tell_apart_and_a_wrong_one(self):
        self.assertEqual(run_json(["context", "0020/FR-013"])[1]["id"], "requirement:0020-spec-format/FR-013")
        for bad in ("nonsense:1", "spec:9999", "brand:nope", "command:nope", "ontology:ifcore:Nope"):
            with self.subTest(bad=bad):
                code, doc = run_json(["context", bad])
                self.assertEqual((code, doc["kind"]), (2, "error"))
                self.assertIn("examples", doc["data"]) if doc["data"].get("code") == "invalid-argument" else None
