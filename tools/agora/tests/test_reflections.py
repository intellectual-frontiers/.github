"""Digital reflections (0047-digital-reflections): the classification rules, the relationships, the assertions, the worked examples
and the compatibility of records made under the broader meaning of the first kind. The ontology under test is the repository's own."""
import re
import unittest

from agora.lib import reflections as r
from agora.lib.turtle import Iri, Lit

from .helpers import HOME, TempRepo, run_json

FIRST, EID_K = r.FIRST, r.EID_K            # the first kind's name is built in the library; agora's code names no repository
I = lambda name: r.IFCORE + name          # noqa: E731
S = lambda name: r.SCHEMA + name          # noqa: E731
P = lambda name: r.PROV + name            # noqa: E731

HEAD = """@prefix ifcore:  <https://www.intellectualfrontiers.com/ontology/core#> .
@prefix ex:      <https://example.org/t#> .
@prefix schema:  <https://schema.org/> .
@prefix prov:    <http://www.w3.org/ns/prov#> .
@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
"""
PUB = "ifcore:hasAudience ifcore:Public"


def graph(extra: str = "", examples: bool = False) -> r.Graph:
    """The repository's ontology, and optionally its worked examples, plus the turtle a test adds."""
    g = r.Graph()
    g.add((HOME / "ontology" / "ifcore.ttl").read_text(encoding="utf-8"), "ontology/ifcore.ttl")
    if examples:
        g.add_files(r.examples(HOME), HOME)
    if extra:
        g.add(re.sub(r"ifcore:Eid\b", "ifcore:" + FIRST, HEAD + extra), "extra.ttl")
    assert not g.unreadable, g.unreadable
    return g


def errors(g: r.Graph, level: str = "error") -> list[str]:
    return [f.message for f in r.check_graph(g, own={"extra.ttl"}) if f.level == level]


def kind(g: r.Graph, *types: str) -> str:
    return r.resolve_types(g, types)[0]


class Rules(unittest.TestCase):
    """The initial rules (FR-013) and the way a kind is resolved (FR-012)."""

    @classmethod
    def setUpClass(cls):
        cls.g = graph()

    def test_the_initial_table_classifies_as_specified(self):
        table = {
            I("Person"): EID_K, I("Company"): EID_K, S("GovernmentOrganization"): EID_K,
            S("MedicalOrganization"): EID_K, S("CivicStructure"): EID_K, S("IndividualProduct"): EID_K,
            S("ProductModel"): "ergon", S("SoftwareApplication"): "ergon", S("WebApplication"): "ergon", S("Service"): "ergon",
            I("Workflow"): "ergon", I("AIWorkforce"): "ergon",
        }
        for cls, want in table.items():
            with self.subTest(cls=cls):
                self.assertEqual(kind(self.g, cls), want)

    def test_a_company_is_an_eidolon_whoever_formed_it(self):
        g = graph(f"ex:Founder a ifcore:Person ; {PUB} .\nex:Co a ifcore:Company ; dcterms:creator ex:Founder ; prov:wasAttributedTo ex:Founder ; {PUB} .\n")
        self.assertEqual(r.subject_kind(g, Iri("https://example.org/t#Co"))[0], EID_K)

    def test_a_saas_product_is_an_ergon(self):
        self.assertEqual(kind(self.g, S("WebApplication")), "ergon")
        self.assertEqual(kind(self.g, I("VendorService")), "ergon", "a vendor's service is the vendor's Ergon, by its superclass")

    def test_a_unit_and_its_model_are_separate_kinds(self):
        self.assertEqual((kind(self.g, S("IndividualProduct")), kind(self.g, S("ProductModel"))), (EID_K, "ergon"))

    def test_a_workflow_is_an_ergon_and_its_execution_is_an_event(self):
        self.assertEqual(kind(self.g, I("Workflow")), "ergon")
        self.assertEqual(kind(self.g, P("Activity")), "other")

    def test_agent_design_is_not_the_runtime_agent(self):
        self.assertEqual(kind(self.g, I("AIWorkforce")), "ergon")
        self.assertEqual(kind(self.g, P("SoftwareAgent")), "undetermined", "no rule decides a running instance (OQ-2)")
        self.assertEqual(kind(self.g, P("Activity")), "other", "its activity is an event")

    def test_abstract_constructs_are_noemas_and_instruments_are_neither(self):
        for cls in (I("Invention"), I("Capability"), I("Note"), I("ResearchPillar"), I("NamedTool"), I("IntellectualConstruct"),
                    "http://www.w3.org/2004/02/skos/core#Concept"):
            with self.subTest(cls=cls):
                self.assertEqual(kind(self.g, cls), "noema")
        for cls in (I("Right"), I("PatentFamily"), I("Trademark"), S("Claim"), I("Outcome"), P("Activity")):
            with self.subTest(cls=cls):
                self.assertEqual(kind(self.g, cls), "other")

    def test_an_ambiguous_or_unknown_subject_is_not_forced(self):
        for cls in (S("Hospital"), I("Unit"), I("DigitalAsset"), I("InformationSystem"), I("DomainName"), S("CreativeWork"), S("Thing")):
            with self.subTest(cls=cls):
                self.assertEqual(kind(self.g, cls), "undetermined")

    def test_conflicting_rules_are_undetermined_and_never_defaulted(self):
        kinds, why = r.resolve_types(self.g, [I("Company"), S("SoftwareApplication")])
        self.assertEqual(kinds, "undetermined")
        self.assertIn("disagree", why)

    def test_the_most_specific_rule_decides(self):
        g = graph("ex:Clinic rdfs:subClassOf schema:Organization .\n")
        self.assertEqual(kind(g, "https://example.org/t#Clinic"), EID_K)
        g = graph("ex:ClinicApp rdfs:subClassOf schema:Organization , schema:SoftwareApplication .\n"
                  "ex:Rule a ifcore:ClassificationRule ; ifcore:subjectClass ex:ClinicApp ; ifcore:reflectedAs ifcore:ErgonKind ; rdfs:comment \"x\" ; " + PUB + " .\n")
        self.assertEqual(kind(g, "https://example.org/t#ClinicApp"), "ergon", "a rule for the class itself outranks its superclasses")

    def test_physical_or_digital_nature_does_not_decide(self):
        """A physical thing may be either kind (a unit, or a model) and so may a digital one (software, or a person's account): no rule
        classifies a thing by being physical, digital, human-made or natural."""
        for rule in self.g.members(r.RULE):
            [cls] = self.g.objects(rule, r.SUBJECT_CLASS)
            self.assertNotRegex(cls.value, r"(?i)#(Physical|Digital(?!Asset)|Natural|HumanMade)")
            [why] = self.g.objects(rule, r.RDFS + "comment")
            self.assertNotRegex(why.value, r"(?i)^(physical|digital|natural|human-made):")


class WorkedExamples(unittest.TestCase):
    """The examples next to the spec are valid, and answer the questions they say they answer."""

    @classmethod
    def setUpClass(cls):
        cls.g = graph(examples=True)

    def test_the_examples_are_valid(self):
        findings = r.check_graph(self.g)
        self.assertEqual([str(f) for f in findings], [])

    def test_the_examples_are_read(self):
        self.assertGreaterEqual(len(self.g.members(r.REFLECTION)), 10)
        self.assertGreaterEqual(len(self.g.members(r.RELATIONSHIP)), 25)

    def test_every_example_reflection_agrees_with_its_subject(self):
        for rec in self.g.members(r.REFLECTION):
            [subject] = self.g.objects(rec, r.REFLECTS)
            want = r.subject_kind(self.g, subject)[0]
            self.assertEqual(r.record_kind(self.g, rec), {want}, rec.value)

    def test_customer_account(self):
        ex = lambda n: Iri("https://example.org/reflections/customer-account#" + n)   # noqa: E731
        deploys = r.relationships_of(self.g, "deploys", ex("MeridianHealth"), ex("CareConnect"))
        self.assertEqual(len(deploys), 1)
        self.assertEqual(r.relationships_of(self.g, "develops", None, ex("CareConnect"))[0], ex("VendorDevelopsCareConnect"))
        # the developer, the owner, the seller, the buyer and the user are five facts, not one
        self.assertEqual({self.g.objects(x, r.REL_FROM)[0].value for t in ("develops", "owns", "offers")
                          for x in r.relationships_of(self.g, t, None, ex("CareConnect"))}, {ex("VendorCo").value})
        self.assertEqual(r.relationships_of(self.g, "purchases", None, ex("CareConnect"))[0], ex("MeridianPurchasesCareConnect"))
        # a contract is held by reference, not as a value
        source = self.g.objects(ex("MeridianPurchasesCareConnect"), r.SOURCE)[0]
        self.assertIn(Iri(I("RestrictedDataReference")), [Iri(t) for t in self.g.declared_types(source)])

    def test_customer_account_keeps_what_ended(self):
        ex = lambda n: Iri("https://example.org/reflections/customer-account#" + n)   # noqa: E731
        meridian = ex("MeridianHealth")
        used = lambda day: {x.value.rsplit("#", 1)[-1] for x in r.relationships_of(self.g, "uses", meridian, on=day)}   # noqa: E731
        self.assertEqual(used("2024-01-01"), {"MeridianUsedLegacyScheduler"})
        self.assertEqual(used("2025-04-14"), {"MeridianUsedLegacyScheduler"})
        self.assertEqual(used("2025-04-15"), {"MeridianUsesCareConnect"})
        self.assertEqual(r.relationships_of(self.g, "uses", meridian, ex("LegacyScheduler")), [ex("MeridianUsedLegacyScheduler")],
                         "the ended relationship is still there to ask about")

    def test_the_account_separates_a_verified_observation_from_an_ai_hypothesis(self):
        ex = lambda n: Iri("https://example.org/reflections/customer-account#" + n)   # noqa: E731
        self.assertEqual(r.assertion_status(self.g, ex("ConcernObservation")), "verified")
        self.assertEqual(r.assertion_status(self.g, ex("CompetitorHypothesis")), "ai-unverified")
        self.assertEqual(r.label_of(self.g, ex("CompetitorHypothesis")), "hypothesis")
        self.assertEqual(r.label_of(self.g, ex("NextStepRecommendation")), "recommendation")
        self.assertEqual(r.assertion_status(self.g, ex("NextStepRecommendation")), "ai-unverified")

    def test_medical_device_keeps_the_unit_and_the_model_apart(self):
        ex = lambda n: Iri("https://example.org/reflections/medical-device#" + n)   # noqa: E731
        unit, model = ex("VentriFlowUnit0042"), ex("VentriFlow200")
        self.assertEqual((r.subject_kind(self.g, unit)[0], r.subject_kind(self.g, model)[0]), (EID_K, "ergon"))
        self.assertNotEqual(unit, model)
        records = {rec: self.g.objects(rec, r.REFLECTS)[0] for rec in self.g.members(r.REFLECTION)}
        self.assertEqual(sorted(k for k, v in records.items() if v == unit), [ex("VentriFlowUnit0042Eidolon")])
        self.assertEqual(sorted(k for k, v in records.items() if v == model), [ex("VentriFlow200Ergon")])
        self.assertEqual(len(r.relationships_of(self.g, "instantiates", unit, model)), 1)
        # owning the unit and operating it are two relationships, by two parties
        self.assertEqual(self.g.objects(r.relationships_of(self.g, "owns", None, unit)[0], r.REL_FROM), [ex("StMarysHealth")])
        self.assertEqual(self.g.objects(r.relationships_of(self.g, "operates", None, unit)[0], r.REL_FROM), [ex("BiomedTech")])

    def test_ai_workforce_keeps_design_runtime_runs_and_outputs_apart(self):
        ex = lambda n: Iri("https://example.org/reflections/ai-workforce#" + n)   # noqa: E731
        self.assertEqual(r.subject_kind(self.g, ex("ClaimsTriage"))[0], "ergon")
        self.assertEqual(r.subject_kind(self.g, ex("TriageWorkflow"))[0], "ergon")
        self.assertEqual(r.subject_kind(self.g, ex("ClaimsTriageAgentProd1"))[0], "undetermined")
        self.assertEqual(r.subject_kind(self.g, ex("Run20261007n1"))[0], "other")
        self.assertEqual(r.subject_kind(self.g, ex("AuditEvent20261007n1"))[0], "other")
        reflected = {self.g.objects(rec, r.REFLECTS)[0] for rec in self.g.members(r.REFLECTION)}
        for not_a_reflection in ("ClaimsTriageAgentProd1", "Run20261007n1", "AuditEvent20261007n1", "TriageSummary20261007n1"):
            self.assertNotIn(ex(not_a_reflection), reflected)
        for human_or_org in ("Operator", "RiverbendClinic", "ManagedServicesCo"):
            self.assertEqual(r.subject_kind(self.g, ex(human_or_org))[0], EID_K)
        self.assertEqual(len(r.relationships_of(self.g, "executes", ex("Run20261007n1"), ex("TriageWorkflow"))), 1)

    def test_patent_ownership_is_not_inferred_from_inventorship(self):
        ex = lambda n: Iri("https://example.org/reflections/rights#" + n)   # noqa: E731
        for idea in ("MethodInvention", "SecondInvention"):
            self.assertEqual(r.subject_kind(self.g, ex(idea))[0], "noema", "the invention is the idea")
        for instrument in ("MethodPatentFamily", "SecondPatentFamily"):
            self.assertEqual(r.subject_kind(self.g, ex(instrument))[0], "other", "the right in it is not the idea")
        self.assertEqual(len(r.relationships_of(self.g, "inventorOf", ex("Inventor"))), 2)
        self.assertEqual(len(r.relationships_of(self.g, "owns", ex("Inventor"))), 0, "an inventor does not own by inventing")
        self.assertEqual(len(r.relationships_of(self.g, "owns", None, ex("SecondPatentFamily"))), 0, "no owner is recorded, so none is inferred")
        self.assertEqual(r.relationships_of(self.g, "owns", None, ex("MethodPatentFamily")), [ex("AssigneeOwnsFamily")])
        self.assertEqual(self.g.objects(ex("InventorAssigns"), I("concerning")), [ex("MethodPatentFamily")])
        self.assertEqual(r.relationships_of(self.g, "owns", None, ex("MethodPatentFamily"), on="2024-05-19"), [], "ownership began with the assignment")

    def test_relationship_types_are_flat_and_in_one_family_each(self):
        scheme = Iri(r.RELATION_SCHEME)
        types = [s for s in self.g.by if scheme in self.g.objects(s, r.IN_SCHEME)]
        self.assertGreaterEqual(len(types), len(r.REQUIRED_TYPES))
        self.assertEqual({self.g.concept_notation(t) for t in types} & set(r.REQUIRED_TYPES), set(r.REQUIRED_TYPES))
        for t in types:
            self.assertEqual(len(self.g.objects(t, r.FAMILY)), 1)
            for p in r.HIERARCHY:
                self.assertEqual(self.g.objects(t, p), [], f"{t.value} must not be arranged under another type")
        legal = {self.g.concept_notation(t) for t in types if self.g.objects(t, r.FAMILY) == [Iri(I("LegalRightFamily"))]}
        self.assertEqual(legal, {"owns", "inventorOf", "assignsTo", "licensesTo"})


class Violations(unittest.TestCase):
    """The checks fail on what they say they fail on, so a passing check means something."""

    REFLECT = "ex:Co a ifcore:Company ; {p} .\n".format(p=PUB)

    def test_both_kinds_at_once(self):
        g = graph(self.REFLECT + f"ex:R a ifcore:Eid, ifcore:Ergon ; ifcore:reflects ex:Co ; ifcore:purpose \"x\" ; {PUB} .\n")
        self.assertTrue(any(f"both {FIRST} and Ergon" in e for e in errors(g)))

    def test_no_subject_or_two_or_a_name(self):
        for reflects, label in (("", "none"), ("ifcore:reflects ex:Co , ex:Co2 ;", "two"), ('ifcore:reflects "Acme" ;', "a name")):
            with self.subTest(label):
                g = graph(self.REFLECT + f"ex:Co2 a ifcore:Company ; {PUB} .\nex:R a ifcore:Eid ; {reflects} {PUB} .\n")
                self.assertTrue(any("exactly one subject" in e for e in errors(g)), errors(g))

    def test_an_ergon_needs_a_purpose(self):
        g = graph(f"ex:App a schema:SoftwareApplication ; {PUB} .\nex:R a ifcore:Ergon ; ifcore:reflects ex:App ; {PUB} .\n")
        self.assertTrue(any("no ifcore:purpose" in e for e in errors(g)))

    def test_a_reflection_declares_an_audience(self):
        g = graph(self.REFLECT + "ex:R a ifcore:Eid ; ifcore:reflects ex:Co .\n")
        self.assertTrue(any("no audience" in e for e in errors(g)))

    def test_a_duplicate_or_malformed_rule(self):
        g = graph(f"ex:A a ifcore:ClassificationRule ; ifcore:subjectClass schema:Person ; ifcore:reflectedAs ifcore:ErgonKind ; rdfs:comment \"x\" ; {PUB} .\n"
                  f"ex:B a ifcore:ClassificationRule ; rdfs:comment \"x\" ; {PUB} .\n"
                  f"ex:C a ifcore:ClassificationRule ; ifcore:subjectClass ex:Z ; ifcore:reflectedAs ifcore:Public ; {PUB} .\n")
        found = " | ".join(errors(g))
        self.assertIn("both classify schema:Person", found)
        self.assertIn("names 0 subject classes", found)
        self.assertIn("does not name exactly one kind", found)
        self.assertIn("states no reason", found)

    def test_a_relationship_must_be_typed_and_between_identifiers(self):
        base = "ex:R a ifcore:ReflectionRelationship ; ifcore:claimLabel ifcore:HypothesisLabel ; ifcore:confidenceLevel ifcore:Low ; " + PUB
        g = graph(self.REFLECT + base + ' ; ifcore:relationType ifcore:Owns ; ifcore:relationFrom "Acme" ; ifcore:relationTo ex:Co .\n')
        self.assertTrue(any("not a name" in e for e in errors(g)))
        g = graph(self.REFLECT + base + " ; ifcore:relationFrom ex:Co ; ifcore:relationTo ex:Co .\n")
        self.assertTrue(any("exactly one type" in e for e in errors(g)))
        g = graph(self.REFLECT + base + " ; ifcore:relationType ex:Invented ; ifcore:relationFrom ex:Co ; ifcore:relationTo ex:Co .\n")
        self.assertTrue(any("exactly one type" in e for e in errors(g)))

    def test_the_model_itself_must_be_complete(self):
        def without(*drops: tuple[str, str | None]) -> list[str]:
            g = graph()
            g.triples = [t for t in g.triples if not any(t[0] == Iri(s) and (p is None or t[1] == p) for s, p in drops)]
            g._by = None
            return [f.message for f in r.check_graph(g)]
        self.assertTrue(any("no type owns" in m for m in without((I("Owns"), None))))
        self.assertTrue(any("notation 'other'" in m for m in without((I("OtherKind"), None))))
        self.assertTrue(any("not declared owl:disjointWith" in m for m in without((r.EID, r.OWL + "disjointWith"), (r.ERG, r.OWL + "disjointWith"))))
        self.assertEqual([m for m in without((r.EID, r.OWL + "disjointWith")) if "disjointWith" in m], [], "one side's declaration is enough")
        self.assertTrue(any("not a subclass of ifcore:DigitalReflection" in m for m in without((r.ERG, r.SUBCLASS))))

    def test_a_relationship_is_between_subjects_not_records(self):
        g = graph(self.REFLECT + f"ex:Rec a ifcore:Eid ; ifcore:reflects ex:Co ; {PUB} .\n"
                  "ex:R a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:Owns ; ifcore:relationFrom ex:Rec ; ifcore:relationTo ex:Co ; "
                  "ifcore:claimLabel ifcore:UnknownLabel ; " + PUB + " .\n")
        self.assertTrue(any("between records" in e for e in errors(g)))

    def test_a_relationship_between_the_wrong_kinds(self):
        g = graph(self.REFLECT + "ex:Prod a schema:WebApplication ; " + PUB + " .\n"
                  "ex:R a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:Develops ; ifcore:relationFrom ex:Prod ; ifcore:relationTo ex:Co ; "
                  "ifcore:claimLabel ifcore:HypothesisLabel ; ifcore:confidenceLevel ifcore:Low ; " + PUB + " .\n")
        found = errors(g)
        self.assertTrue(any("cannot start from" in e for e in found), found)
        self.assertTrue(any("cannot point to" in e for e in found), found)

    def test_an_undetermined_end_is_not_a_violation(self):
        g = graph(f"ex:Agent a prov:SoftwareAgent ; {PUB} .\nex:App a ifcore:AIWorkforce ; {PUB} .\n"
                  "ex:R a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:Instantiates ; ifcore:relationFrom ex:Agent ; ifcore:relationTo ex:App ; "
                  "ifcore:claimLabel ifcore:HypothesisLabel ; ifcore:confidenceLevel ifcore:Low ; " + PUB + " .\n")
        self.assertEqual(errors(g), [])

    def test_a_relationship_with_no_source_is_a_hypothesis(self):
        rel = "ex:R a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:Owns ; ifcore:relationFrom ex:Co ; ifcore:relationTo ex:Co ; " + PUB
        g = graph(self.REFLECT + rel + " ; ifcore:claimLabel ifcore:ObservationLabel .\n")
        self.assertTrue(any("no source" in e for e in errors(g)))
        g = graph(self.REFLECT + rel + " ; ifcore:claimLabel ifcore:HypothesisLabel .\n")
        self.assertTrue(any("no ifcore:confidenceLevel" in e for e in errors(g)))
        g = graph(self.REFLECT + rel + " ; ifcore:claimLabel ifcore:HypothesisLabel ; ifcore:confidenceLevel ifcore:Low .\n")
        self.assertEqual(errors(g), [])
        g = graph(self.REFLECT + rel + " ; ifcore:claimLabel ifcore:UnknownLabel .\n")
        self.assertEqual(errors(g), [])

    def test_a_relationship_cannot_end_before_it_starts(self):
        rel = ("ex:R a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:Owns ; ifcore:relationFrom ex:Co ; ifcore:relationTo ex:Co ; "
               "ifcore:claimLabel ifcore:UnknownLabel ; " + PUB)
        g = graph(self.REFLECT + rel + ' ; schema:validFrom "2025-01-02"^^xsd:date ; schema:validThrough "2025-01-01"^^xsd:date .\n')
        self.assertTrue(any("before it starts" in e or "ends (" in e for e in errors(g)))
        g = graph(self.REFLECT + rel + ' ; schema:validFrom "2025-01-01"^^xsd:date ; schema:validThrough "2025-01-01"^^xsd:date .\n')
        self.assertEqual(errors(g), [])

    def test_relationship_types_may_not_be_arranged_in_a_hierarchy(self):
        for statement in ("ifcore:Owns skos:broader ifcore:InventorOf .", "ifcore:Owns rdfs:subPropertyOf ifcore:InventorOf ."):
            with self.subTest(statement):
                messages = [f.message for f in r.check_graph(graph(statement + "\n"))]
                self.assertTrue(any("types are flat" in m for m in messages), messages)

    def test_an_assertion_carries_one_label_and_a_subject(self):
        g = graph(f"ex:A a ifcore:Assertion ; schema:about ex:Co ; {PUB} .\n" + self.REFLECT)
        self.assertTrue(any("exactly one ifcore:claimLabel" in e for e in errors(g)))
        g = graph(f"ex:A a ifcore:Assertion ; ifcore:claimLabel ifcore:HypothesisLabel ; {PUB} .\n")
        self.assertTrue(any("says nothing about a subject" in e for e in errors(g)))
        g = graph(f"ex:A a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:HypothesisLabel , ifcore:EvidenceLabel ; {PUB} .\n" + self.REFLECT)
        self.assertTrue(any("exactly one ifcore:claimLabel" in e for e in errors(g)))

    def test_an_observation_or_evidence_needs_a_source(self):
        for label in ("Observation", "Evidence"):
            g = graph(f"ex:A a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:{label}Label ; {PUB} .\n" + self.REFLECT)
            self.assertTrue(any("no source" in e for e in errors(g)), label)

    def test_an_ai_agent_never_verifies(self):
        agent = f"ex:Bot a prov:SoftwareAgent ; {PUB} .\n"
        g = graph(agent + self.REFLECT + f"ex:A a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:EvidenceLabel ; dcterms:source ex:Co ; "
                  f"ifcore:verifiedBy ex:Bot ; ifcore:verifiedOn \"2026-01-01\"^^xsd:date ; {PUB} .\n")
        self.assertTrue(any("not a person" in e for e in errors(g)))

    def test_a_hypothesis_cannot_carry_verification(self):
        person = f"ex:Pat a ifcore:Person ; {PUB} .\n"
        for label in ("Hypothesis", "Inference", "Unknown"):
            g = graph(person + self.REFLECT + f"ex:A a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:{label}Label ; "
                      f"ifcore:confidenceLevel ifcore:Low ; ifcore:verifiedBy ex:Pat ; ifcore:verifiedOn \"2026-01-01\"^^xsd:date ; {PUB} .\n")
            self.assertTrue(any("cannot carry verification" in e for e in errors(g)), label)

    def test_verification_needs_a_person_and_a_date(self):
        person = f"ex:Pat a ifcore:Person ; {PUB} .\n"
        g = graph(person + self.REFLECT + f"ex:A a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:EvidenceLabel ; dcterms:source ex:Co ; ifcore:verifiedBy ex:Pat ; {PUB} .\n")
        self.assertTrue(any("both ifcore:verifiedBy and ifcore:verifiedOn" in e for e in errors(g)))

    def test_a_recommendation_rests_on_something(self):
        g = graph(self.REFLECT + f"ex:A a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:RecommendationLabel ; {PUB} .\n")
        self.assertTrue(any("derived from nothing" in e for e in errors(g)))

    def test_status_distinguishes_verified_from_ai_hypotheses(self):
        g = graph(f"ex:Pat a ifcore:Person ; {PUB} .\nex:Bot a prov:SoftwareAgent ; {PUB} .\n" + self.REFLECT
                  + f"ex:V a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:EvidenceLabel ; dcterms:source ex:Co ; ifcore:verifiedBy ex:Pat ; ifcore:verifiedOn \"2026-01-01\"^^xsd:date ; {PUB} .\n"
                  + f"ex:H a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:HypothesisLabel ; ifcore:confidenceLevel ifcore:Low ; prov:wasAttributedTo ex:Bot ; {PUB} .\n"
                  + f"ex:U a ifcore:Assertion ; schema:about ex:Co ; ifcore:claimLabel ifcore:ObservationLabel ; dcterms:source ex:Co ; {PUB} .\n")
        self.assertEqual([r.assertion_status(g, Iri("https://example.org/t#" + n)) for n in "VHU"], ["verified", "ai-unverified", "unverified"])
        self.assertEqual(errors(g), [])


class Compatibility(unittest.TestCase):
    """Records made under the broader meaning of the first kind stay served, are reported, and are never changed by a check."""

    LEGACY = (f"ex:Product a schema:WebApplication ; {PUB} .\n"
              f"ex:OldRecord a ifcore:Eid ; ifcore:reflects ex:Product ; {PUB} .\n")

    def test_the_iri_stays_and_the_class_is_a_digital_reflection(self):
        g = graph()
        self.assertIn(r.REFLECTION, g.supers(r.EID))
        self.assertIn(r.REFLECTION, g.supers(r.ERG))
        self.assertEqual(g.objects(Iri(r.EID), r.IFCORE + "hasAudience"), [Iri(I("Public"))])

    def test_a_legacy_record_of_a_product_is_served_and_reported_not_failed(self):
        g = graph(self.LEGACY)
        self.assertEqual(errors(g), [])
        warnings = errors(g, "warning")
        self.assertEqual(len(warnings), 1)
        self.assertIn("t#OldRecord", warnings[0])
        self.assertIn("resolves to ergon", warnings[0])
        self.assertIn("needs review, not changed", warnings[0])
        self.assertIn(Iri("https://example.org/t#OldRecord"), g.members(r.REFLECTION), "a reader of DigitalReflection still finds it")
        self.assertIn(Iri("https://example.org/t#OldRecord"), g.members(r.EID), "and a reader of the first kind still finds it until it is migrated")

    def test_a_record_of_an_abstract_or_undetermined_subject_is_reported(self):
        for typ, want in (("ifcore:PatentFamily", "other"), ("schema:Hospital", "undetermined"), ("schema:CreativeWork", "undetermined")):
            with self.subTest(typ):
                g = graph(f"ex:S a {typ} ; {PUB} .\nex:R a ifcore:Eid ; ifcore:reflects ex:S ; {PUB} .\n")
                self.assertTrue(any(f"resolves to {want}" in w for w in errors(g, "warning")))
                self.assertEqual(errors(g), [])

    def test_a_reflection_of_an_untyped_subject_is_reported(self):
        g = graph(f"ex:R a ifcore:Eid ; ifcore:reflects ex:Nothing ; {PUB} .\n")
        self.assertTrue(any("gives it no type" in w for w in errors(g, "warning")))

    def test_a_reviewed_migration_keeps_identifiers_and_relationships(self):
        migrated = self.LEGACY + (
            f"ex:Co a ifcore:Company ; {PUB} .\n"
            "ex:Builds a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:Develops ; ifcore:relationFrom ex:Co ; ifcore:relationTo ex:Product ; "
            f"ifcore:claimLabel ifcore:UnknownLabel ; {PUB} .\n"
            "ex:NewRecord a ifcore:Ergon ; ifcore:reflects ex:Product ; ifcore:purpose \"x\" ; prov:wasDerivedFrom ex:OldRecord ; " + PUB + " .\n"
            "ex:OldRecord dcterms:isReplacedBy ex:NewRecord .\n")
        before, after = graph(self.LEGACY + f"ex:Co a ifcore:Company ; {PUB} .\n"), graph(migrated)
        self.assertEqual(errors(after), [])
        self.assertEqual(len(r.relationships_of(after, "develops")), 1, "the relationship is between subjects, so it did not move")
        self.assertEqual(after.objects(Iri("https://example.org/t#OldRecord"), r.REFLECTS), after.objects(Iri("https://example.org/t#NewRecord"), r.REFLECTS))
        self.assertIn(Iri("https://example.org/t#OldRecord"), after.members(r.REFLECTION), "the old record stays")
        self.assertEqual(len(before.members(r.RELATIONSHIP)), len(graph().members(r.RELATIONSHIP)), "the legacy record adds no relationship of its own")

    def test_a_replaced_record_points_at_a_derived_record_of_the_same_subject(self):
        base = self.LEGACY + f"ex:Other a schema:WebApplication ; {PUB} .\n"
        for newer, label in (("ex:New a ifcore:Ergon ; ifcore:reflects ex:Other ; ifcore:purpose \"x\" ; prov:wasDerivedFrom ex:OldRecord ;", "another subject"),
                             ("ex:New a ifcore:Ergon ; ifcore:reflects ex:Product ; ifcore:purpose \"x\" ;", "not derived")):
            with self.subTest(label):
                g = graph(base + newer + f" {PUB} .\nex:OldRecord dcterms:isReplacedBy ex:New .\n")
                self.assertTrue(any("must reflect the same subject" in e for e in errors(g)), errors(g))

    def test_a_check_changes_nothing(self):
        before = (HOME / "ontology" / "ifcore.ttl").read_bytes()
        r.check(HOME, HOME)
        self.assertEqual(before, (HOME / "ontology" / "ifcore.ttl").read_bytes())


class Repository(TempRepo):
    """The check, run as the command: in the public root, and in a repository that extends it."""

    def test_the_public_root_passes(self):
        code, doc = run_json(["check", "ontology"])
        self.assertEqual(code, 0, doc)

    def test_a_repository_that_extends_the_root_is_checked_against_it(self):
        text = (f"ex:Product a schema:WebApplication ; {PUB} .\nex:Rec a ifcore:Eid ; ifcore:reflects ex:Product ; {PUB} .\n"
                f"ex:Bad a ifcore:Ergon ; ifcore:reflects ex:Product ; {PUB} .\n")
        self.write("ontology/own.ttl", re.sub(r"ifcore:Eid\b", "ifcore:" + FIRST, HEAD + text))
        messages = self.findings("ontology")
        self.assertTrue(any("no ifcore:purpose" in m for m in messages), messages)
        self.assertTrue(any("needs review" in m for m in messages), messages)


if __name__ == "__main__":
    unittest.main()
