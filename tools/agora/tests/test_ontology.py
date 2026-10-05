"""The ontology's terms: the Turtle reader, `ontology list` and `ontology show` (0042-agora FR-037)."""
import json
import re
import unittest
from pathlib import Path

from agora.lib import terms, turtle
from agora.lib.turtle import Blank, Iri, Lit

from .helpers import HOME, run, run_json


class Reader(unittest.TestCase):
    def test_every_statement_form_the_ontology_uses_is_read(self):
        text = '''@prefix a: <http://e/a#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
# a comment with "quotes" and <angles>
a:X a a:C , a:D ; a:p "one"@en , "two \\"q\\" # not a comment" ; a:n 3 , true ;
    a:d "5"^^xsd:integer ;
    a:b [ a:q a:Y ] ;
    a:l ( a:Y a:Z ) .
[] a a:C ; a:m ( a:Y ) .
a:L a:p """line
two""" .
'''
        prefixes, tr = turtle.parse(text)
        self.assertEqual(prefixes["a"], "http://e/a#")
        x = Iri("http://e/a#X")
        got = {(p.rsplit("#", 1)[-1], o) for s, p, o, _ in tr if s == x}
        self.assertIn(("p", Lit("one", lang="en")), got)
        self.assertIn(("p", Lit('two "q" # not a comment')), got)
        self.assertIn(("n", Lit("3", datatype=turtle.XSD + "integer")), got)
        self.assertIn(("d", Lit("5", datatype=turtle.XSD + "integer")), got)
        self.assertEqual(sum(1 for s, p, o, _ in tr if p == turtle.RDF_FIRST), 3)
        self.assertTrue(any(isinstance(s, Blank) and p.endswith("#q") or p.endswith("#q") for s, p, o, _ in tr))
        self.assertIn(Lit("line\ntwo"), [o for s, p, o, _ in tr])
        self.assertEqual([l for s, p, o, l in tr if s == x][0], 4, "a statement's line is where its subject is")

    def test_a_malformed_file_is_refused_with_its_line(self):
        for bad, why in (("a:x a a:C .", "not declared"), ("@prefix a: <http://e/> .\na:x a:p .", "expected"),
                         ("@prefix a: <http://e/> .\na:x a:p \"open .", "cannot read")):
            with self.subTest(bad=bad):
                with self.assertRaises(turtle.TurtleError) as e:
                    turtle.parse(bad)
                self.assertIn(why, str(e.exception))

    def test_the_ontology_files_are_read_whole(self):
        for f in terms.FILES:
            prefixes, tr = turtle.parse((HOME / f).read_text(encoding="utf-8"))
            self.assertIn("ifcore", prefixes)
            subjects = {s.value for s, *_ in tr if isinstance(s, Iri)}
            declared = set(re.findall(r"^(?:ifcore|ifweb):([\w-]+)\s", (HOME / f).read_text(encoding="utf-8"), re.M))
            local = {s.rsplit("#", 1)[-1] for s in subjects if "#" in s}
            self.assertLessEqual(declared, local, f)


class Listing(unittest.TestCase):
    def rows(self, *args):
        code, doc = run_json(["ontology", "list", *args])
        self.assertEqual(code, 0, doc)
        return doc["data"]["terms"]

    def test_every_kind_is_covered_and_a_row_carries_its_icon(self):
        rows = self.rows()
        kinds = {r["kind"] for r in rows}
        self.assertEqual(kinds, {"class", "property", "individual", "scheme", "concept"})
        icons = {r["kind"]: r["icon"] for r in rows}
        self.assertEqual(icons, {"class": "symbol-class", "property": "symbol-property", "individual": "symbol-constant",
                                 "scheme": "symbol-enum", "concept": "symbol-enum-member"})
        for r in rows:
            self.assertTrue({"curie", "iri", "label", "kind", "icon", "summary", "scheme", "notation", "type"} <= set(r))
        order = [terms.KINDS.index(r["kind"]) for r in rows]
        self.assertEqual(order, sorted(order), "classes, properties, schemes, concepts, then individuals")
        self.assertTrue(any(r["curie"].startswith("ifweb:") for r in rows), "ifweb.ttl is covered too")

    def test_kind_and_scheme_narrow_the_rows(self):
        self.assertEqual({r["kind"] for r in self.rows("--kind", "class")}, {"class"})
        concepts = self.rows("--scheme", "ifcore:CommandCategoryScheme")
        self.assertEqual(len(concepts), 7)
        self.assertEqual({r["scheme"] for r in concepts}, {"ifcore:CommandCategoryScheme"})
        self.assertEqual(self.rows("--scheme", "CommandCategoryScheme"), concepts)
        self.assertEqual(run_json(["ontology", "list", "--kind", "nonsense"])[0], 2)

    def test_match_is_case_insensitive_and_ranked_exact_curie_first_then_exact_label(self):
        self.assertEqual(self.rows("--match", "IFCORE:AGORA")[0]["curie"], "ifcore:Agora")
        rows = self.rows("--match", "Design system")
        self.assertEqual(rows[0]["curie"], "ifcore:DesignSystem", "the exact label before labels that only start with it")
        self.assertEqual(self.rows("--match", "design system"), rows)
        self.assertEqual(self.rows("--match", "readcommandcategory")[0]["curie"], "ifcore:ReadCommandCategory")

    def test_match_finds_a_comment_a_notation_and_an_iri_and_says_when_nothing_matches(self):
        self.assertIn("ifcore:ReadCommandCategory", [r["curie"] for r in self.rows("--match", "read")][:10])
        self.assertTrue(self.rows("--match", "ontology/core#Agora"))
        rows = self.rows("--match", "zzzz-nothing")
        self.assertEqual(rows, [])
        code, doc = run_json(["ontology", "list", "--match", "zzzz-nothing"])
        self.assertEqual([a["command"] for a in doc["actions"]], ["ontology list"], "an empty search offers the full list")

    def test_rank_orders_by_the_documented_tiers(self):
        onto = terms.load(HOME)
        t = onto.by_curie["ifcore:Agora"]
        tiers = [terms.rank(t, x) for x in ("ifcore:agora", "agora", "ago", "gor", "orchestrator named for the public")]
        self.assertEqual(tiers, sorted(tiers, reverse=True))
        self.assertEqual(terms.rank(t, "unrelated words"), 0)


class Showing(unittest.TestCase):
    def show(self, curie):
        code, doc = run_json(["ontology", "show", curie])
        self.assertEqual(code, 0, doc)
        return doc

    def test_a_class(self):
        d = self.show("ifcore:Orchestrator")["data"]
        self.assertEqual((d["kind"], d["icon"], d["label"]), ("class", "symbol-class", "Orchestrator"))
        self.assertEqual(d["superclasses"], ["schema:SoftwareApplication"])
        self.assertEqual([i["curie"] for i in d["individuals"]], ["ifcore:Agora"])
        self.assertIn("ifcore:Orchestrator", {r["object"] for r in self.show("ifcore:Agora")["data"]["statements"]})
        self.assertEqual(d["path"], "ontology/ifcore.ttl")
        self.assertIsInstance(d["line"], int)
        sub = self.show("ifcore:Company")["data"]
        self.assertEqual(sub["superclasses"], ["ifcore:Organization"])
        self.assertIn("ifcore:Company", [r["curie"] for r in self.show("ifcore:Organization")["data"]["subclasses"]])

    def test_a_property_has_domain_range_and_statements_and_is_referenced(self):
        d = self.show("ifcore:commandOf")["data"]
        self.assertEqual((d["kind"], d["domain"], d["range"]), ("property", ["ifcore:Command"], ["ifcore:Orchestrator"]))
        self.assertEqual(d["superproperties"], ["schema:isPartOf"])
        self.assertEqual({r["predicate"] for r in self.show("ifcore:Agora")["data"]["referenced_by"]}, {"ifcore:commandOf", "ifcore:drives"})
        self.assertIn("ifcore:commandOf", [r["curie"] for r in self.show("ifcore:Command")["data"]["properties"]])

    def test_a_scheme_lists_its_members_and_a_concept_its_scheme_and_notation(self):
        s = self.show("ifcore:CommandCategoryScheme")["data"]
        self.assertEqual((s["kind"], s["member_count"]), ("scheme", 7))
        c = self.show("ifcore:ReadCommandCategory")["data"]
        self.assertEqual((c["kind"], c["scheme"], c["notation"], c["icon"]), ("concept", "ifcore:CommandCategoryScheme", "read", "symbol-enum-member"))
        self.assertIn("ifcore:AgoraOntologyListCommand", [r["curie"] for r in c["referenced_by"]])

    def test_an_individual_has_its_type_audience_and_every_statement(self):
        d = self.show("ifcore:AgoraOntologyShowCommand")["data"]
        self.assertEqual((d["kind"], d["types"], d["audience"]), ("individual", ["ifcore:Command"], "Public"))
        preds = {r["predicate"] for r in d["statements"]}
        self.assertTrue({"rdf:type", "ifcore:commandOf", "dcterms:identifier", "skos:definition", "ifcore:commandNoun"} <= preds)
        row = next(r for r in d["statements"] if r["predicate"] == "ifcore:commandNoun")
        self.assertEqual((row["object"], row["kind"]), ("ifcore:OntologyResourceKind", "term"))

    def test_objects_that_are_terms_link_to_ontology_show_and_requirements_to_requirement_show(self):
        doc = self.show("ifcore:Orchestrator")
        links = {(l["command"], tuple(l["fields"].values())) for l in doc["links"]}
        self.assertIn(("ontology show", ("ifcore:Agora",)), links)
        self.assertIn(("requirement show", ("0042-agora/FR-004",)), links)
        self.assertTrue(all(l["cli"] for l in doc["links"]))

    def test_the_requirements_that_cite_a_term_by_curie_or_label_in_backticks_or_define_it(self):
        specs = {c["requirement"]: c for c in self.show("ifcore:Orchestrator")["data"]["specs"]}
        self.assertEqual(specs["0042-agora/FR-004"]["how"], "names it")
        self.assertEqual(specs["0019-controlled-vocabulary/FR-002"]["how"], "defines it")
        check = self.show("ifcore:AgoraCheckCommand")["data"]
        self.assertIn("0041-command-line/FR-031", {c["requirement"] for c in check["specs"]}, "its label, `check`, in backticks")
        self.assertEqual(check["specs_count"], len(check["specs"]) if check["specs_count"] <= 100 else check["specs_count"])

    def test_an_iri_is_accepted_and_a_wrong_name_is_refused_with_the_nearest_curies(self):
        iri = "https://www.intellectualfrontiers.com/ontology/core#Agora"
        self.assertEqual(self.show(iri)["id"], "ifcore:Agora")
        code, doc = run_json(["ontology", "show", "ifcore:Agor"])
        self.assertEqual(code, 2)
        self.assertIn("ifcore:Agora", doc["data"]["message"])

    def test_text_shows_the_term_and_its_tables(self):
        code, out, _ = run(["ontology", "show", "ifcore:Orchestrator"])
        self.assertEqual(code, 0)
        self.assertIn("statements:", out)
        self.assertIn("predicate", out)
        code, out, _ = run(["ontology", "list", "--kind", "scheme"])
        self.assertIn("ifcore:CommandCategoryScheme", out)
        self.assertGreater(len(out.splitlines()), 40, "text lists every row, not the first forty")

    def test_context_and_the_mcp_resource_name_the_same_term(self):
        code, doc = run_json(["context", "ontology:ifcore:Orchestrator"])
        self.assertEqual(code, 0)
        d = doc["data"]
        self.assertEqual(d["resource"]["curie"], "ifcore:Orchestrator")
        self.assertIn("ontology/ifcore.ttl", d["files"])
        self.assertIn("0042-agora/FR-004", [r["id"] for r in d["requirements"]])


if __name__ == "__main__":
    unittest.main()
