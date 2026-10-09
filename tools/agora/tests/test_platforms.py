"""Platforms (0049-platforms): the kernel, the layers, the dependency rule, the naming rule and the worked example."""
import re
import unittest

from agora.lib import platforms as pl
from agora.lib import reflections as r
from agora.lib.turtle import Iri

from .helpers import HOME
from .test_reflections import errors, graph

EXAMPLE = (HOME / "spec-kit" / "specs" / "0049-platforms" / "examples" / "a-conforming-platform.ttl").read_text(encoding="utf-8")
BODY = "\n".join(line for line in EXAMPLE.splitlines() if not line.startswith("@prefix"))
PUB = "ifcore:hasAudience ifcore:Public"
X = "https://example.org/t#"


def rel(n: str, typ: str, frm: str, to: str) -> str:
    return (f"ex:{n} a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:{typ} ; ifcore:relationFrom ex:{frm} ; ifcore:relationTo {to} ;"
            f" ifcore:claimLabel ifcore:UnknownLabel ; {PUB} .\n")


def mod(key: str, label: str, code: str, layer: str = "PlatformServicesLayer", platform: str = "ExamplePlatform") -> str:
    return (f'ex:{key} a ifcore:PlatformModule ; rdfs:label "{label}"@en ; ifcore:moduleCode "{code}" ; ifcore:artifactName "{'-'.join(w.lower() for w in label.split())}" ; ifcore:codeStatus "confirmed" ; ifcore:platformLayer ifcore:{layer} ; {PUB} .\n'
            + rel("P" + key, "PartOf", key, "ex:" + platform))


def messages(extra_or_body: str) -> list[str]:
    return errors(graph(extra_or_body))


class Conforming(unittest.TestCase):
    def test_the_worked_example_has_no_finding(self):
        g = graph(BODY)
        self.assertEqual([f.message for f in r.check_graph(g, own={"extra.ttl"})], [])

    def test_the_example_realizes_the_whole_kernel(self):
        g = graph(BODY)
        got = pl.conformance(g, Iri(X + "ExamplePlatform"))
        self.assertEqual(set(got), set(pl.KERNEL))
        self.assertTrue(all(got.values()))

    def test_the_kernel_in_the_code_is_the_kernel_in_the_ontology(self):
        g = graph()
        scheme = {g.concept_notation(s) for s in g.by if isinstance(s, Iri) and Iri(pl.CAPABILITY_SCHEME) in g.objects(s, r.IN_SCHEME)}
        self.assertEqual(scheme, set(pl.KERNEL))

    def test_a_platform_and_a_module_are_ergons(self):
        g = graph()
        self.assertEqual(r.resolve_types(g, [pl.PLATFORM])[0], "ergon")
        self.assertEqual(r.resolve_types(g, [pl.MODULE])[0], "ergon")


class Kernel(unittest.TestCase):
    def test_each_missing_capability_is_reported(self):
        for cap in pl.KERNEL:
            with self.subTest(cap=cap):
                name = "".join(w.capitalize() for w in cap.split("-")) + "Capability"
                body = re.sub(rf"ex:R\d+ a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:Implements ; ifcore:relationFrom ex:\w+ ; ifcore:relationTo ifcore:{name} ;\n.*\n", "", BODY)
                out = messages(body)
                self.assertTrue(any(cap in m and "kernel" in m for m in out), out)

    def test_a_platform_with_no_module_lacks_everything(self):
        out = messages(f"ex:Bare a ifcore:Platform ; rdfs:label \"Bare\"@en ; {PUB} .\n")
        self.assertTrue(any("ifcore:Platform" in m and "governed-store" in m and "governed-access" in m for m in out), out)

    def test_a_product_that_is_not_typed_platform_is_not_tested(self):
        self.assertEqual(messages(f"ex:Suite a schema:SoftwareApplication ; rdfs:label \"Suite\"@en ; {PUB} .\n"), [])


class Layers(unittest.TestCase):
    def test_a_module_needs_exactly_one_layer(self):
        out = messages(BODY + f'ex:Loose a ifcore:PlatformModule ; rdfs:label "Example Loose Module"@en ; ifcore:moduleCode "ELM" ; ifcore:artifactName "example-loose-module" ; ifcore:codeStatus "confirmed" ; {PUB} .\n')
        self.assertTrue(any("exactly one layer" in m for m in out), out)

    def test_a_dependency_may_not_skip_a_layer(self):
        out = messages(BODY + rel("D1", "DependsOn", "CommitmentLedger", "ex:HostAdapters"))
        self.assertTrue(any("own layer or the one directly below" in m for m in out), out)

    def test_a_dependency_may_not_point_up(self):
        out = messages(BODY + rel("D1", "DependsOn", "DataStore", "ex:ExtensionRegistry"))
        self.assertTrue(any("own layer or the one directly below" in m for m in out), out)

    def test_a_dependency_in_the_same_layer_is_allowed(self):
        self.assertEqual(messages(BODY + rel("D1", "DependsOn", "CommitmentLedger", "ex:AccessService")), [])

    def test_nothing_depends_on_the_assurance_environment(self):
        out = messages(BODY + rel("D1", "DependsOn", "CommitmentLedger", "ex:AssuranceEnvironment"))
        self.assertTrue(any("no module depends on it at runtime" in m for m in out), out)

    def test_an_orthogonal_module_may_reach_the_data_layer(self):
        self.assertEqual(messages(BODY + rel("D1", "DependsOn", "IntegrationEngine", "ex:DataStore")), [])


class Naming(unittest.TestCase):
    def test_a_wrong_code_is_reported(self):
        out = messages(BODY.replace('"EDS"', '"XYZ"'))
        self.assertTrue(any("must be EDS" in m for m in out), out)

    def test_a_code_is_three_capital_letters(self):
        out = messages(BODY.replace('"EDS"', '"eds"'))
        self.assertTrue(any("three capital letters" in m for m in out), out)

    def test_a_name_must_be_the_platform_and_two_words(self):
        out = messages(BODY.replace("Example Data Store", "Example Governed Data Store").replace('"EDS"', '"EGD"'))
        self.assertTrue(any("followed by two plain words" in m for m in out), out)
        out = messages(BODY.replace("Example Data Store", "Lake Data Store"))
        self.assertTrue(any("followed by two plain words" in m for m in out), out)

    def test_a_code_is_unique_within_a_platform(self):
        out = messages(BODY + mod("Other", "Example Distributed Storage", "EDS", "DataLayer"))
        self.assertTrue(any("also the code of" in m for m in out), out)


class Artifacts(unittest.TestCase):
    def test_an_artifact_name_built_on_the_code_is_reported(self):
        out = messages(BODY.replace('ifcore:artifactName "example-data-store"', 'ifcore:artifactName "example-eds"'))
        self.assertTrue(any("artifactName" in m for m in out), out)

    def test_a_missing_artifact_name_is_reported(self):
        out = messages(BODY.replace('ifcore:artifactName "example-data-store" ; ', ''))
        self.assertTrue(any("artifactName" in m for m in out), out)

    def test_a_code_status_is_confirmed_or_proposed(self):
        self.assertEqual(messages(BODY.replace('ifcore:codeStatus "confirmed"', 'ifcore:codeStatus "proposed"', 1)), [])
        out = messages(BODY.replace('ifcore:codeStatus "confirmed"', 'ifcore:codeStatus "maybe"', 1))
        self.assertTrue(any("codeStatus" in m for m in out), out)


class Suites(unittest.TestCase):
    def test_a_suite_is_an_ergon_subject(self):
        self.assertEqual(r.resolve_types(graph(), [pl.SUITE])[0], "ergon")

    def test_a_subject_is_not_both(self):
        out = messages(BODY + "ex:Both a ifcore:Platform, ifcore:Suite ; rdfs:label \"Both\"@en ; " + PUB + " .\n")
        self.assertTrue(any("both ifcore:Platform and ifcore:Suite" in m for m in out), out)

    def test_a_suite_needs_two_members(self):
        out = messages(BODY.replace("ex:RS2 a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:PartOf ;", "ex:RS2 a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:IntegratesWith ;"))
        self.assertTrue(any("at least two products" in m for m in out), out)

    def test_a_suite_has_no_modules(self):
        out = messages(BODY + rel("M1", "PartOf", "DataStore", "ex:ExampleSuite"))
        self.assertTrue(any("a suite has no modules" in m for m in out), out)

    def test_nothing_is_built_on_a_suite(self):
        out = messages(BODY + rel("B1", "BuiltOn", "IntakeSolution", "ex:ExampleSuite"))
        self.assertTrue(any("nothing is built on a suite" in m for m in out), out)

    def test_a_product_may_be_in_a_suite_and_be_a_platform(self):
        extra = rel("M2", "PartOf", "ExamplePlatform", "ex:ExampleSuite")
        self.assertEqual(messages(BODY + extra), [])


class Offers(unittest.TestCase):
    def test_built_on_must_name_a_platform(self):
        out = messages(BODY + f"ex:Thing a schema:Service ; {PUB} .\n" + rel("B1", "BuiltOn", "IntakeSolution", "ex:Thing"))
        self.assertTrue(any("not typed ifcore:Platform" in m for m in out), out)

    def test_a_module_is_part_of_a_platform_only(self):
        out = messages(BODY + f"ex:Suite a schema:SoftwareApplication ; {PUB} .\n" + rel("B1", "PartOf", "DataStore", "ex:Suite"))
        self.assertTrue(any("is not typed ifcore:Platform" in m for m in out), out)

    def test_a_module_belongs_to_one_platform(self):
        other = f'ex:Other a ifcore:Platform ; rdfs:label "Other"@en ; {PUB} .\n'
        out = messages(BODY + other + rel("B1", "PartOf", "DataStore", "ex:Other"))
        self.assertTrue(any("two platforms" in m for m in out), out)


if __name__ == "__main__":
    unittest.main()
