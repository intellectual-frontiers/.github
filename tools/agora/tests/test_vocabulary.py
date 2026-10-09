"""The vocabulary scan (0019-controlled-vocabulary FR-007, FR-009, FR-010)."""
import tempfile
import unittest
from pathlib import Path

from agora.lib import vocabulary

TTL = '''@prefix ifcore: <https://www.intellectualfrontiers.com/ontology/core#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <https://schema.org/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
ifcore:Reused a owl:Class ; rdfs:subClassOf schema:Book .
ifcore:Child a owl:Class ; rdfs:subClassOf ifcore:Reused .
ifcore:GenericOnly a owl:Class ; rdfs:subClassOf prov:Entity .
ifcore:Invented a owl:Class .
ifcore:Own a owl:Class .
ifcore:OwnChild a owl:Class ; rdfs:subClassOf ifcore:Own .
ifcore:Tied a owl:Class ; rdfs:subClassOf schema:Book .
ifcore:Scheme a skos:ConceptScheme .
ifcore:Member a skos:Concept ; skos:inScheme ifcore:Scheme .
ifcore:OwnDecision a ifcore:Decision ; dcterms:subject ifcore:Own, ifcore:Scheme, ifcore:Tied .
'''


class Scan(unittest.TestCase):
    def status(self, ttl: str = TTL) -> dict[str, str]:
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "ontology").mkdir()
            (Path(d) / "ontology" / "a.ttl").write_text(ttl, encoding="utf-8")
            (Path(d) / "ontology" / "works").mkdir()
            (Path(d) / "ontology" / "works" / "skipped.ttl").write_text(ttl.replace("Invented", "Skipped"), encoding="utf-8")
            return {t.curie: t.status for t in vocabulary.scan({"r": Path(d)})}

    def test_each_status(self):
        got = self.status()
        self.assertEqual(got["ifcore:Reused"], "reused")
        self.assertEqual(got["ifcore:Child"], "reused", "a child of a mapped term inherits")
        self.assertEqual(got["ifcore:GenericOnly"], "unmapped", "a generic parent names no established equivalent")
        self.assertEqual(got["ifcore:Invented"], "unmapped")
        self.assertEqual(got["ifcore:Own"], "excepted")
        self.assertEqual(got["ifcore:OwnChild"], "unmapped", "a new term under an excepted parent is a new term")
        self.assertEqual(got["ifcore:Tied"], "reused", "a tie outranks a Decision")
        self.assertEqual(got["ifcore:Member"], "excepted", "a concept takes its scheme's status")
        self.assertNotIn("ifcore:Skipped", got, "a work's generated ontology is not the schema")

    def test_findings_are_warnings_and_name_the_file(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "ontology").mkdir()
            (Path(d) / "ontology" / "a.ttl").write_text(TTL, encoding="utf-8")
            f = vocabulary.findings(vocabulary.scan({"r": Path(d)}))
        self.assertEqual([x.level for x in f], ["warning"])
        self.assertIn("3 classes", f[0].message)


if __name__ == "__main__":
    unittest.main()
