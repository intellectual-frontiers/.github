"""Noemas (0048-noemas): the third kind of reflection, its epistemic model, evidence, claims, review, commercial trace and the
worked examples A to E. The ontology under test is the repository's own, with the examples beside the specs."""
import re
import unittest

from agora.lib import noemas as n
from agora.lib import reflections as r
from agora.lib.turtle import Iri

from .helpers import HOME, TempRepo, run_json
from .test_reflections import EID_K, HEAD, PUB, errors, graph, kind

I = lambda name: r.IFCORE + name          # noqa: E731
S = lambda name: r.SCHEMA + name          # noqa: E731
P = lambda name: r.PROV + name            # noqa: E731
NA, UW, CD, AW, FH = ("https://example.org/noema/" + x for x in ("native-alpha#", "unbundling-work#", "care-delivery#", "ai-workforce#", "falsified#"))
RV = "ifcore:reviewState ifcore:AcceptedState ; ifcore:reviewedBy ex:Pat ; ifcore:reviewedOn \"2026-01-01\"^^xsd:date"
PAT = f"ex:Pat a ifcore:Person ; {PUB} .\nex:Bot a prov:SoftwareAgent ; {PUB} .\n"


def idea(extra: str = "", types: str = "ifcore:HypothesisType", defn: bool = True, claim: bool = True, falsifier: bool = True) -> str:
    """A small Noema of one subject, and the pieces a valid hypothesis carries; a test removes or breaks one."""
    definition = 'skos:definition "an idea" ;' if defn else ""
    out = (PAT + f"ex:H a ifcore:IntellectualConstruct ; rdfs:label \"H\" ; dcterms:type {types} ; {PUB} .\n"
           f"ex:Rec a ifcore:Noema ; ifcore:reflects ex:H ; {definition} {PUB} .\n")
    if claim:
        out += (f"ex:C a schema:Claim ; {PUB} .\nex:St a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:States ; ifcore:relationFrom ex:H ; "
                f"ifcore:relationTo ex:C ; ifcore:claimLabel ifcore:UnknownLabel ; {PUB} .\n")
    if falsifier:
        out += (f"ex:F a ifcore:Assertion ; schema:about ex:H ; ifcore:aspect ifcore:FalsificationCriterionAspect ; ifcore:claimLabel ifcore:HypothesisLabel ; "
                f"ifcore:confidenceLevel ifcore:Low ; {PUB} .\n")
    return out + extra


def assess(state: str, frm: str | None = "2026-03-01", extra: str = "", by: str = RV, name: str = "A1") -> str:
    when = f'schema:validFrom "{frm}"^^xsd:date ;' if frm else ""
    return (f"ex:{name} a ifcore:EpistemicAssessment ; schema:about ex:H ; ifcore:assessedState ifcore:{state} ; {when} ifcore:claimLabel ifcore:InferenceLabel ; "
            f"ifcore:confidenceLevel ifcore:Low ; {by} ; {extra} {PUB} .\n")


def msgs(g: r.Graph) -> list[str]:
    return errors(g)


class Kinds(unittest.TestCase):
    """Three distinct first-class kinds with one foundation."""

    @classmethod
    def setUpClass(cls):
        cls.g = graph()

    def test_three_kinds_share_one_parent_and_are_pairwise_disjoint(self):
        kc = r.kind_classes(self.g)
        self.assertEqual(set(kc), {r.EID_K, r.ERG_K, r.NOEMA_K})
        for k, c in kc.items():
            self.assertIn(r.REFLECTION, self.g.supers(c), k)
        self.assertEqual(r.check_graph(self.g), [])
        classes = list(kc.values())
        for i, x in enumerate(classes):
            for y in classes[i + 1:]:
                both = Iri(y) in self.g.objects(Iri(x), r.OWL + "disjointWith") or Iri(x) in self.g.objects(Iri(y), r.OWL + "disjointWith")
                self.assertTrue(both, (x, y))

    def test_no_mechanism_is_repeated_for_the_third_kind(self):
        """Every shared mechanism sits on the parent, so a Noema inherits it and defines none of its own."""
        own = {t[1] for t in self.g.triples if t[0] == Iri(r.NOEMA)}
        self.assertFalse(own & {r.REFLECTS, r.REVIEW_STATE, r.REVIEWED_BY, r.VERIFIED_BY, r.RDFS + "domain", r.RDFS + "range"}, "it declares no property of its own")
        for prop in (r.REFLECTS, r.REVIEW_STATE, r.REVIEWED_BY):
            doms = [t[2] for t in self.g.triples if t[0] == Iri(prop) and t[1] == r.RDFS + "domain"]
            self.assertTrue(doms, prop)
            for d in doms:
                self.assertNotEqual(d, Iri(r.NOEMA))

    def test_the_kind_of_an_idea_is_noema_and_never_ergon_or_eidolon(self):
        for cls in (I("IntellectualConstruct"), I("Note"), I("ResearchPillar"), I("Invention"), I("Capability"), I("NamedTool")):
            self.assertEqual(kind(self.g, cls), "noema", cls)

    def test_claims_instruments_events_and_outcomes_are_not_ideas(self):
        for cls in (S("Claim"), I("PatentFamily"), I("Right"), I("Trademark"), P("Activity"), I("Outcome")):
            self.assertEqual(kind(self.g, cls), "other", cls)

    def test_an_idea_in_a_document_stays_an_idea(self):
        g = graph(idea("ex:Doc a schema:DigitalDocument ; schema:about ex:H ; " + PUB + " .\n"))
        self.assertEqual(r.subject_kind(g, Iri("https://example.org/t#H"))[0], "noema")
        self.assertEqual(r.subject_kind(g, Iri("https://example.org/t#Doc"))[0], "undetermined", "the document is not given a kind")
        self.assertEqual(errors(g), [])
        g = graph(idea("ex:DocRec a ifcore:Ergon ; ifcore:reflects ex:Doc ; ifcore:purpose \"x\" ; " + PUB + " .\nex:Doc a schema:DigitalDocument ; " + PUB + " .\n"))
        self.assertTrue(any("needs review" in w for w in errors(g, "warning")), "an Ergon made of the document is reported")

    def test_a_further_kind_needs_no_change_to_the_three(self):
        """A fourth kind is a class, a kind concept naming it, and a rule; the three and their records are untouched."""
        extra = (f"ex:Fourth a owl:Class ; rdfs:subClassOf ifcore:DigitalReflection ; owl:disjointWith ifcore:Eid, ifcore:Ergon, ifcore:Noema .\n"
                 f"ex:FourthKind a skos:Concept ; skos:inScheme ifcore:ReflectionKindScheme ; skos:notation \"fourth\" ; ifcore:reflectionClass ex:Fourth ; {PUB} .\n"
                 f"ex:Thing a owl:Class .\nex:Rule a ifcore:ClassificationRule ; ifcore:subjectClass ex:Thing ; ifcore:reflectedAs ex:FourthKind ; rdfs:comment \"x\" ; {PUB} .\n"
                 f"ex:S a ex:Thing ; {PUB} .\nex:R a ex:Fourth ; ifcore:reflects ex:S ; {PUB} .\n")
        extra = "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n" + extra
        g = graph(extra)
        self.assertEqual(r.subject_kind(g, Iri("https://example.org/t#S"))[0], "fourth")
        found = [m for m in errors(g) if "disjoint" in m]
        self.assertEqual(found, [], found)   # the three pairs the new class names are covered; pairs with it declared on its side
        self.assertEqual([m for m in errors(g)], [])
        self.assertEqual(r.record_kind(g, Iri("https://example.org/t#R")), {"fourth"})


class Claims(unittest.TestCase):
    """A claim is a statement a Noema states; it is not a Noema, and an assertion is a third thing."""

    def test_a_claim_has_no_reflection(self):
        for k in ("Noema", "Ergon", "Eid"):
            g = graph(f"ex:Cl a schema:Claim ; {PUB} .\nex:R a ifcore:{k} ; ifcore:reflects ex:Cl ; skos:definition \"x\" ; ifcore:purpose \"x\" ; {PUB} .\n")
            self.assertTrue(any("a claim has no reflection" in m for m in errors(g)), k)

    def test_a_hypothesis_or_finding_states_a_claim(self):
        for t in ("ifcore:HypothesisType", "ifcore:ResearchFindingType"):
            g = graph(idea(types=t, claim=False))
            self.assertTrue(any("states no claim" in m for m in errors(g)), t)
        self.assertEqual(errors(graph(idea())), [])
        self.assertEqual(errors(graph(idea(types="ifcore:ResearchQuestionType", claim=False, falsifier=False))), [], "a question states none")

    def test_one_claim_may_be_stated_by_two_ideas(self):
        g = graph(idea() + "ex:H2 a ifcore:IntellectualConstruct ; dcterms:type ifcore:TheoryType ; " + PUB + " .\n"
                  "ex:St2 a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:States ; ifcore:relationFrom ex:H2 ; ifcore:relationTo ex:C ; ifcore:claimLabel ifcore:UnknownLabel ; " + PUB + " .\n")
        self.assertEqual(len(r.relationships_of(g, "states", None, Iri("https://example.org/t#C"))), 2)

    def test_an_idea_states_a_claim_only_of_kind_other(self):
        g = graph(idea("ex:St3 a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:States ; ifcore:relationFrom ex:H ; ifcore:relationTo ex:H ; ifcore:claimLabel ifcore:UnknownLabel ; " + PUB + " .\n"))
        self.assertTrue(any("cannot point to" in m for m in errors(g)))

    def test_stating_a_claim_is_not_asserting_it(self):
        """The relationship is an observation of what the idea says; truth is assessed on the idea, with evidence."""
        g = graph(idea())
        st = Iri("https://example.org/t#St")
        self.assertEqual(r.label_of(g, st), "unknown")
        self.assertEqual(n.current_state(g, Iri("https://example.org/t#H")), ("proposed", None))

    def test_patent_claim_and_research_claim_are_both_kind_other(self):
        g = graph()
        self.assertEqual(kind(g, S("Claim")), "other")


class Epistemic(unittest.TestCase):
    """State is an assessment over time, apart from lifecycle, and only a person's acceptance changes it."""

    def test_the_states(self):
        g = graph()
        scheme = [s for s in g.by if isinstance(s, Iri) and Iri(n.EPISTEMIC_SCHEME) in g.objects(s, r.IN_SCHEME)]
        self.assertEqual({g.concept_notation(s) for s in scheme}, set(n.STATES))
        self.assertTrue(not ({g.concept_notation(s) for s in scheme} & n.NOT_STATES), "no proven, and no lifecycle state")

    def test_a_proven_state_is_refused(self):
        g = graph("ex:Proven a skos:Concept ; skos:inScheme ifcore:EpistemicStateScheme ; skos:notation \"proven\" ; " + PUB + " .\n")
        self.assertTrue(any("not an epistemic state" in m for m in r.check_graph(g, own=None) and [f.message for f in r.check_graph(g)]))

    def test_lifecycle_and_epistemic_states_share_nothing(self):
        g = graph()
        epi = {s for s in g.by if isinstance(s, Iri) and Iri(n.EPISTEMIC_SCHEME) in g.objects(s, r.IN_SCHEME)}
        life = {t[0] for t in g.triples if t[1] == r.TYPE and t[2] == Iri(I("WorkLifecycleStage"))}
        self.assertTrue(life and epi)
        self.assertFalse(epi & life)
        self.assertFalse({g.concept_notation(x) for x in epi} & {n.notation(g, x) for x in life if n.notation(g, x)})

    def test_current_state_is_the_latest_accepted_assessment_in_force(self):
        h = Iri("https://example.org/t#H")
        g = graph(idea(assess("SupportedState", "2026-03-01", extra="dcterms:source ex:Pat ;") + assess("ContestedState", "2026-06-01", name="A2", extra="dcterms:source ex:Pat ;")))
        self.assertEqual(n.current_state(g, h)[0], "contested")
        self.assertEqual(n.current_state(g, h, "2026-04-01")[0], "supported")
        self.assertEqual(n.current_state(g, h, "2026-02-01")[0], "proposed", "before the first assessment")

    def test_an_ai_assessment_is_a_candidate_and_changes_nothing(self):
        h = Iri("https://example.org/t#H")
        bot = assess("FalsifiedState", "2026-05-01", name="AI", by="prov:wasAttributedTo ex:Bot", extra="dcterms:source ex:Pat ;")
        g = graph(idea(assess("SupportedState", "2026-03-01", extra="dcterms:source ex:Pat ;") + bot))
        self.assertEqual(n.current_state(g, h)[0], "supported")
        self.assertEqual(errors(g), [])
        self.assertIn(Iri("https://example.org/t#AI"), n.candidates(g))
        reasons = n.reexamine(g, h)
        self.assertTrue(any("awaiting a person's review" in x for x in reasons), reasons)

    def test_a_rejected_or_reviewed_assessment_does_not_count_either(self):
        h = Iri("https://example.org/t#H")
        for st in ("ReviewedState", "RejectedState"):
            by = f"ifcore:reviewState ifcore:{st} ; ifcore:reviewedBy ex:Pat ; ifcore:reviewedOn \"2026-01-01\"^^xsd:date"
            g = graph(idea(assess("SupportedState", "2026-03-01", by=by, extra="dcterms:source ex:Pat ;")))
            self.assertEqual(n.current_state(g, h)[0], "proposed", st)

    def test_an_assessment_needs_a_state_a_date_and_a_basis(self):
        g = graph(idea("ex:A0 a ifcore:EpistemicAssessment ; schema:about ex:H ; ifcore:claimLabel ifcore:InferenceLabel ; " + PUB + " .\n"))
        self.assertTrue(any("exactly one state" in m for m in errors(g)))
        g = graph(idea(assess("ProposedState", None)))
        self.assertTrue(any("from when it holds" in m for m in errors(g)))
        for st in ("SupportedState", "ContestedState", "FalsifiedState"):
            g = graph(idea(assess(st)))
            self.assertTrue(any("with no basis" in m for m in errors(g)), st)
        self.assertEqual(errors(graph(idea(assess("UnderInvestigationState")))), [], "a state that claims no result needs no basis")

    def test_superseded_needs_a_successor(self):
        g = graph(idea(assess("SupersededState", extra="dcterms:source ex:Pat ;")))
        self.assertTrue(any("nothing supersedes it" in m for m in errors(g)))
        succ = ("ex:H2 a ifcore:IntellectualConstruct ; dcterms:type ifcore:TheoryType ; " + PUB + " .\n"
                "ex:Sp a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:Supersedes ; ifcore:relationFrom ex:H2 ; ifcore:relationTo ex:H ; ifcore:claimLabel ifcore:UnknownLabel ; " + PUB + " .\n")
        self.assertEqual(errors(graph(idea(assess("SupersededState", extra="dcterms:source ex:Pat ;") + succ))), [])

    def test_an_epistemic_state_belongs_to_an_idea(self):
        g = graph(idea() + "ex:Co a ifcore:Company ; " + PUB + " .\nex:A9 a ifcore:EpistemicAssessment ; schema:about ex:Co ; ifcore:assessedState ifcore:ProposedState ; "
                  "schema:validFrom \"2026-01-01\"^^xsd:date ; ifcore:claimLabel ifcore:InferenceLabel ; " + PUB + " .\n")
        self.assertTrue(any("an epistemic state belongs to an idea" in m for m in errors(g)))
        g = graph(idea("ex:A8 a ifcore:EpistemicAssessment ; schema:about ex:H ; ifcore:assessedState ifcore:Distribute ; schema:validFrom \"2026-01-01\"^^xsd:date ; ifcore:claimLabel ifcore:InferenceLabel ; " + PUB + " .\n"))
        self.assertTrue(any("exactly one state" in m for m in errors(g)), "a lifecycle stage is not an epistemic state")

    def test_a_hypothesis_without_a_falsifier_is_reported_not_failed(self):
        g = graph(idea(falsifier=False))
        self.assertEqual(errors(g), [])
        self.assertTrue(any("no falsification criterion" in m for m in errors(g, "warning")))


class Review(unittest.TestCase):
    """Candidate, reviewed, accepted (0047 FR-038): an AI cannot promote its own proposal."""

    def test_nothing_stated_is_a_candidate(self):
        g = graph(idea())
        self.assertEqual(r.review_state(g, Iri("https://example.org/t#Rec")), "candidate")
        self.assertIn(Iri("https://example.org/t#Rec"), n.candidates(g))

    def test_a_state_beyond_candidate_needs_a_person(self):
        for st in ("ReviewedState", "AcceptedState", "RejectedState"):
            g = graph(PAT + f"ex:A a ifcore:Assertion ; schema:about ex:Pat ; ifcore:claimLabel ifcore:HypothesisLabel ; ifcore:confidenceLevel ifcore:Low ; "
                      f"prov:wasAttributedTo ex:Bot ; ifcore:reviewState ifcore:{st} ; {PUB} .\n")
            found = errors(g)
            self.assertTrue(any("with no reviewer, and an AI agent stated it" in m for m in found), (st, found))

    def test_an_agent_never_reviews(self):
        g = graph(PAT + f"ex:A a ifcore:Assertion ; schema:about ex:Pat ; ifcore:claimLabel ifcore:UnknownLabel ; ifcore:reviewState ifcore:AcceptedState ; "
                  f"ifcore:reviewedBy ex:Bot ; ifcore:reviewedOn \"2026-01-01\"^^xsd:date ; {PUB} .\n")
        self.assertTrue(any("an AI agent never reviews" in m for m in errors(g)))

    def test_a_reviewer_needs_a_date_and_a_known_state(self):
        g = graph(PAT + f"ex:A a ifcore:Assertion ; schema:about ex:Pat ; ifcore:claimLabel ifcore:UnknownLabel ; ifcore:reviewedBy ex:Pat ; {PUB} .\n")
        self.assertTrue(any("both ifcore:reviewedBy and ifcore:reviewedOn" in m for m in errors(g)))
        g = graph(PAT + f"ex:A a ifcore:Assertion ; schema:about ex:Pat ; ifcore:claimLabel ifcore:UnknownLabel ; ifcore:reviewState ifcore:SupportedState ; {PUB} .\n")
        self.assertTrue(any("at most one review state" in m for m in errors(g)))

    def test_accepting_a_hypothesis_does_not_verify_it(self):
        g = graph(PAT + f"ex:A a ifcore:Assertion ; schema:about ex:Pat ; ifcore:claimLabel ifcore:HypothesisLabel ; ifcore:confidenceLevel ifcore:Low ; {RV} ; {PUB} .\n")
        self.assertEqual(errors(g), [])
        a = Iri("https://example.org/t#A")
        self.assertEqual((r.review_state(g, a), r.assertion_status(g, a)), ("accepted", "unverified"))

    def test_an_ai_proposed_idea_stays_a_candidate_and_off_the_trace(self):
        g = graph(idea("ex:Rec2 a ifcore:Noema ; ifcore:reflects ex:H2 ; skos:definition \"x\" ; prov:wasAttributedTo ex:Bot ; " + PUB + " .\n"
                       "ex:H2 a ifcore:IntellectualConstruct ; dcterms:type ifcore:ConceptType ; " + PUB + " .\n"))
        self.assertIn(Iri("https://example.org/t#Rec2"), n.candidates(g))
        self.assertEqual(errors(g), [])


class Validity(unittest.TestCase):
    """A Noema record and its subject are checked for what only an idea needs."""

    def test_a_noema_states_the_idea(self):
        self.assertTrue(any("no skos:definition" in m for m in errors(graph(idea(defn=False)))))

    def test_an_intellectual_construct_has_a_subtype_from_the_scheme(self):
        g = graph(idea(types="ifcore:ConceptType").replace("dcterms:type ifcore:ConceptType ;", ""))
        self.assertTrue(any("with no subtype" in m for m in errors(g)))
        g = graph(idea(types="ex:Made"))
        self.assertTrue(any("is not a Noema subtype" in m for m in errors(g)))

    def test_subtypes_overlap_and_a_new_one_is_a_concept(self):
        g = graph(idea(types="ifcore:FrameworkType , ifcore:MethodologyType , ex:Extra", claim=False, falsifier=False)
                  + "ex:Extra a skos:Concept ; skos:inScheme ifcore:NoemaTypeScheme ; skos:notation \"extra\" ; " + PUB + " .\n")
        self.assertEqual(errors(g), [])
        self.assertEqual(n.subtypes(g, Iri("https://example.org/t#H")), {"framework", "methodology", "extra"})

    def test_the_thirteen_subtypes(self):
        g = graph()
        have = {g.concept_notation(s) for s in g.by if isinstance(s, Iri) and Iri(n.TYPE_SCHEME) in g.objects(s, r.IN_SCHEME)}
        want = {"concept", "hypothesis", "theory", "principle", "framework", "methodology", "research-question", "research-finding",
                "research-agenda", "taxonomy", "ontology", "design-pattern", "business-model"}
        self.assertTrue(want <= have)

    def test_duplicates_are_reported_and_never_merged(self):
        g = graph(idea("ex:H3 a ifcore:IntellectualConstruct ; rdfs:label \"h\" ; dcterms:type ifcore:ConceptType ; " + PUB + " .\n"
                       "ex:Rec3 a ifcore:Noema ; ifcore:reflects ex:H3 ; skos:definition \"x\" ; " + PUB + " .\n"))
        self.assertTrue(any("possible duplicates" in m for m in errors(g, "warning")))
        self.assertEqual(len(n.possible_duplicates(g)), 1)


class Rights(unittest.TestCase):
    """An idea is not a right, and no right is derived from engaging with an idea."""

    def test_nobody_owns_assigns_or_licenses_an_idea(self):
        for t in ("Owns", "AssignsTo", "LicensesTo"):
            g = graph(idea("ex:Co a ifcore:Company ; " + PUB + " .\nex:X a ifcore:ReflectionRelationship ; ifcore:relationType ifcore:" + t + " ; "
                           "ifcore:relationFrom ex:Co ; ifcore:relationTo ex:H ; ifcore:claimLabel ifcore:UnknownLabel ; " + PUB + " .\n"))
            self.assertTrue(any("cannot point to" in m for m in errors(g)), t)

    def test_engagement_relationships_are_not_legal_relationships(self):
        g = graph()
        fam = lambda t: g.objects(Iri(I(t)), r.FAMILY)   # noqa: E731
        for t in ("Proposes", "Researches", "Adopts"):
            self.assertEqual(fam(t), [Iri(I("EngagementFamily"))])
        for t in ("Owns", "InventorOf", "AssignsTo", "LicensesTo"):
            self.assertEqual(fam(t), [Iri(I("LegalRightFamily"))])
        self.assertEqual(fam("Describes"), [Iri(I("EpistemicFamily"))], "a document that describes an idea is not a right in it")

    def test_the_ontology_has_no_inference_from_idea_to_right(self):
        g = graph()
        banned = re.compile(r"(?i)patentab|enforceab|freedomtooperate|publicdomain")
        names = [t[0].value for t in g.triples if isinstance(t[0], Iri) and t[0].value.startswith(r.IFCORE)]
        self.assertFalse([x for x in names if banned.search(x)])

    def test_instruments_and_ideas_and_products_are_different_kinds(self):
        g = graph(examples=True)
        ex = lambda x: Iri("https://example.org/reflections/rights#" + x)   # noqa: E731
        self.assertEqual([r.subject_kind(g, ex(x))[0] for x in ("MethodInvention", "MethodPatentFamily")], ["noema", "other"])


class Native(unittest.TestCase):
    """Examples A to E behave as they say."""

    @classmethod
    def setUpClass(cls):
        cls.g = graph(examples=True)

    def test_every_example_is_valid_and_every_noema_agrees_with_its_subject(self):
        self.assertEqual([str(f) for f in r.check_graph(self.g)], [])
        recs = self.g.members(r.NOEMA)
        self.assertGreaterEqual(len(recs), 20)
        for rec in recs:
            [s] = self.g.objects(rec, r.REFLECTS)
            self.assertEqual(r.subject_kind(self.g, s)[0], "noema", rec.value)

    # -- A
    def test_a_claims_are_not_noemas(self):
        for c in ("ClaimAdvantage", "ClaimInsufficient", "ClaimCompounds"):
            self.assertEqual(r.subject_kind(self.g, Iri(NA + c))[0], "other")
        reflected = {self.g.objects(rec, r.REFLECTS)[0] for rec in self.g.members(r.REFLECTION)}
        self.assertFalse({Iri(NA + c) for c in ("ClaimAdvantage", "ClaimInsufficient", "ClaimCompounds")} & reflected)
        self.assertEqual(len(n.claims_of(self.g, Iri(NA + "InsightMeetsProblem"))), 1)

    def test_a_support_and_contradiction_coexist_and_state_does_not_move(self):
        p = Iri(NA + "InsightMeetsProblem")
        ev = n.evidence(self.g, p)
        self.assertEqual((len(ev["supports"]), len(ev["contradicts"])), (1, 1))
        self.assertEqual(n.current_state(self.g, p)[0], "supported", "the agent's candidate 'contested' did not count")
        self.assertEqual(n.current_state(self.g, p, "2026-02-01")[0], "proposed")
        reasons = n.reexamine(self.g, p)
        self.assertTrue(any("began 2026-09-15" in x and "contradicts" in x for x in reasons), reasons)
        self.assertTrue(any("awaiting a person's review" in x for x in reasons))

    def test_a_the_ai_proposal_is_a_candidate_everywhere(self):
        cand = {c.value.rsplit("#", 1)[-1] for c in n.candidates(self.g) if c.value.startswith(NA)}
        self.assertIn("NetworkOfInsightNoema", cand)
        self.assertIn("AssessContestedByAgent", cand)
        self.assertIn("CommercialGuess", cand)
        self.assertNotIn("InsightMeetsProblemNoema", cand)

    def test_a_trace_from_observation_to_demand(self):
        t = n.trace(self.g, Iri(NA + "InsightMeetsProblem"))
        reached = [st for st in n.STAGES if t[st]["reached"]]
        self.assertEqual(reached, ["observation", "conception", "investigation", "relevance", "operationalization", "validation"])
        self.assertFalse(t["experimentation"]["reached"] or t["compounding"]["reached"], "not forced through every stage")
        demand = t["validation"]["reached"][0]
        self.assertEqual(self.g.objects(demand, n.DEMONSTRATED_BY), [Iri(NA + "ClientCo")])
        self.assertEqual(r.subject_kind(self.g, Iri(NA + "ClientCo"))[0], EID_K)

    def test_a_guesses_and_candidates_are_not_demand(self):
        t = n.trace(self.g, Iri(NA + "InsightMeetsProblem"))
        got = {x.value.rsplit("#", 1)[-1] for x in t["validation"]["reached"]}
        self.assertEqual(got, {"Demand1"})
        self.assertNotIn("CommercialGuess", got)
        self.assertEqual(n.trace(self.g, Iri(NA + "NetworkOfInsight"))["investigation"]["reached"], [])

    def test_a_engagement_and_the_mark_are_not_ownership_of_the_idea(self):
        idea = Iri(NA + "NativeAlpha")
        self.assertEqual(r.relationships_of(self.g, "owns", None, idea), [])
        self.assertEqual({self.g.objects(x, r.REL_TO)[0].value.rsplit("#", 1)[-1] for x in r.relationships_of(self.g, "owns", Iri(NA + "ResearchCo"))}, {"NativeAlphaMark"})
        self.assertEqual(len(r.relationships_of(self.g, "proposes", Iri(NA + "ResearchCo"), idea)), 1)
        self.assertEqual(len(r.relationships_of(self.g, "adopts", Iri(NA + "ClientCo"), idea)), 1)

    def test_a_framework_contains_ideas_that_are_their_own_noemas(self):
        parts = {o.value.rsplit("#", 1)[-1] for o in self.g.objects(Iri(NA + "NativeAlpha"), r.DCT + "hasPart")}
        self.assertEqual(parts, {"InsightMeetsProblem", "InsightAloneFails"})
        self.assertEqual(n.subtypes(self.g, Iri(NA + "NativeAlpha")), {"concept", "framework"})
        for p in parts:
            self.assertIn(Iri(NA + p), n.noema_subjects(self.g))

    # -- B
    def test_b_the_method_is_a_noema_and_what_runs_it_is_an_ergon(self):
        m = Iri(UW + "AcceptanceTesting")
        self.assertEqual(r.subject_kind(self.g, m)[0], "noema")
        for e in ("DelegationWorkflow", "TestHarness", "ContractReviewWorkforce"):
            self.assertEqual(r.subject_kind(self.g, Iri(UW + e))[0], "ergon", e)
        self.assertEqual(len(r.relationships_of(self.g, "operationalizes", Iri(UW + "DelegationWorkflow"), m)), 1)
        self.assertEqual(len(r.relationships_of(self.g, "implements", Iri(UW + "TestHarness"), m)), 1)
        self.assertEqual(len(r.relationships_of(self.g, "informsDesignOf", Iri(UW + "AIExecutes"), Iri(UW + "ContractReviewWorkforce"))), 1)

    def test_b_a_question_stays_a_question_and_an_unreviewed_theory_is_a_candidate(self):
        for q in ("LiabilityQ", "CredentialsQ"):
            self.assertEqual(n.current_state(self.g, Iri(UW + q))[0], "proposed")
            self.assertEqual(n.subtypes(self.g, Iri(UW + q)), {"research-question"})
        self.assertIn(Iri(UW + "OrgEconomicsNoema"), n.candidates(self.g))
        self.assertEqual(n.subtypes(self.g, Iri(UW + "UnbundlingAgenda")), {"research-agenda", "framework"})
        self.assertEqual(len(self.g.objects(Iri(UW + "UnbundlingAgenda"), r.DCT + "hasPart")), 6)

    def test_b_ideas_depend_on_each_other(self):
        d = r.relationships_of(self.g, "dependsOn", Iri(UW + "AIExecutes"), Iri(UW + "Decomposable"))
        self.assertEqual(len(d), 1)
        self.assertEqual(n.assertions_about(self.g, Iri(UW + "LiabilityQ"))[0].value.rsplit("#", 1)[-1], "OpenQ1")

    # -- C
    def test_c_competing_explanations_both_stand_and_both_are_contested(self):
        w, i, o = Iri(CD + "VariationIsWorkflow"), Iri(CD + "VariationIsIncentive"), Iri(CD + "CostVariation")
        self.assertEqual([len(r.relationships_of(self.g, "explains", x, o)) for x in (w, i)], [1, 1])
        self.assertEqual(len(r.relationships_of(self.g, "contradicts", i, w)) + len(r.relationships_of(self.g, "contradicts", w, i)), 2)
        self.assertEqual([n.current_state(self.g, x)[0] for x in (w, i)], ["contested", "contested"])
        self.assertEqual(n.current_state(self.g, w, "2026-07-01")[0], "proposed")

    def test_c_evidence_splits_across_the_two_theories(self):
        w, i = Iri(CD + "VariationIsWorkflow"), Iri(CD + "VariationIsIncentive")
        self.assertEqual((len(n.evidence(self.g, w)["supports"]), len(n.evidence(self.g, i)["supports"]), len(n.evidence(self.g, i)["contradicts"])), (1, 1, 2))

    def test_c_experiment_reached_but_no_demand(self):
        t = n.trace(self.g, Iri(CD + "VariationIsWorkflow"))
        self.assertTrue(t["experimentation"]["reached"])
        self.assertFalse(t["validation"]["reached"], "buyers and wedges are guesses")
        aspects = {self.g.concept_notation(o) for a in n.aspects_of(self.g, Iri(CD + "VariationIsWorkflow")) for o in self.g.objects(a, n.ASPECT)}
        self.assertTrue({"potential-buyer", "product-wedge", "competing-approach", "adoption-obstacle", "commercial-hypothesis", "assumption",
                         "experimental-design", "limitation", "counterargument", "falsification-criterion"} <= aspects)

    def test_c_a_program_is_an_ergon_a_system_is_an_eidolon(self):
        self.assertEqual((r.subject_kind(self.g, Iri(CD + "CareProgram"))[0], r.subject_kind(self.g, Iri(CD + "HealthSystem"))[0]), ("ergon", EID_K))

    # -- D
    def test_d_the_idea_the_deployment_and_the_organizations(self):
        idea, dep = Iri(AW + "AIWorkforceIdea"), Iri(AW + "ClaimsWorkforce")
        self.assertEqual((r.subject_kind(self.g, idea)[0], r.subject_kind(self.g, dep)[0]), ("noema", "ergon"))
        for e in ("DeveloperCo", "OperatorCo", "ClientHospital", "ClinicalStaff"):
            self.assertEqual(r.subject_kind(self.g, Iri(AW + e))[0], EID_K, e)
        self.assertEqual(len(r.relationships_of(self.g, "operationalizes", dep, idea)), 1)
        self.assertEqual([len(r.relationships_of(self.g, t, None, dep)) for t in ("develops", "operates", "purchases", "uses")], [1, 1, 1, 1])
        self.assertEqual(len(r.relationships_of(self.g, "adopts", Iri(AW + "ClientHospital"), idea)), 1)
        self.assertEqual(r.relationships_of(self.g, "purchases", None, idea), [], "an idea is adopted, not bought")

    def test_d_the_deployment_implements_principles_and_generates_evidence(self):
        dep = Iri(AW + "ClaimsWorkforce")
        self.assertEqual({self.g.objects(x, r.REL_TO)[0].value.rsplit("#", 1)[-1] for x in r.relationships_of(self.g, "implements", dep)}, {"HumanDecides", "EvidenceBeforeAcceptance"})
        self.assertEqual(len(n.evidence(self.g, Iri(AW + "EvidenceBeforeAcceptance"))["generatesEvidenceFor"]), 1)
        self.assertEqual(n.current_state(self.g, Iri(AW + "EvidenceBeforeAcceptance"))[0], "under-investigation")

    # -- E
    def test_e_the_state_at_any_date(self):
        h = Iri(FH + "KeywordRouting")
        got = {d: n.current_state(self.g, h, d)[0] for d in ("2026-01-09", "2026-01-15", "2026-03-01", "2026-05-02", "2026-06-20", "2026-12-31")}
        self.assertEqual(got, {"2026-01-09": "proposed", "2026-01-15": "proposed", "2026-03-01": "proposed", "2026-05-02": "contested",
                               "2026-06-20": "falsified", "2026-12-31": "falsified"})
        self.assertEqual(n.current_state(self.g, h)[0], "falsified")

    def test_e_falsified_keeps_its_identity_evidence_and_relationships(self):
        h = Iri(FH + "KeywordRouting")
        self.assertIn(h, n.noema_subjects(self.g))
        ev = n.evidence(self.g, h)
        self.assertEqual((len(ev["supports"]), len(ev["contradicts"]), len(ev["tests"])), (1, 1, 2), "the early support is not erased by the refutation")
        self.assertEqual(len(n.assessments(self.g, h)), 4)
        self.assertEqual(r.subject_kind(self.g, h)[0], "noema")
        self.assertEqual(r.check_graph(self.g), [])

    def test_e_a_retraction_derives_from_what_it_withdraws_and_both_stay(self):
        ret, early = Iri(FH + "Retraction1"), Iri(FH + "EarlyClaim")
        self.assertEqual(self.g.objects(ret, r.DERIVED), [early])
        self.assertIn(early, n.assertions_about(self.g, Iri(FH + "KeywordRouting")))

    def test_e_what_was_built_on_it_is_closed_not_deleted(self):
        h, router = Iri(FH + "KeywordRouting"), Iri(FH + "KeywordRouter")
        self.assertEqual(len(r.relationships_of(self.g, "operationalizes", router, h, "2026-05-01")), 1)
        self.assertEqual(len(r.relationships_of(self.g, "operationalizes", router, h, "2026-07-15")), 0)
        self.assertEqual(len(r.relationships_of(self.g, "operationalizes", router, h)), 1)

    def test_e_the_successor_builds_on_it(self):
        s, h = Iri(FH + "ContextualRouting"), Iri(FH + "KeywordRouting")
        self.assertEqual(len(r.relationships_of(self.g, "buildsOn", s, h)) + len(r.relationships_of(self.g, "refines", s, h)), 2)
        self.assertEqual(n.current_state(self.g, s)[0], "proposed")

    def test_e_publication_and_falsification_are_separate(self):
        h = Iri(FH + "KeywordRouting")
        self.assertEqual(self.g.objects(h, I("workLifecycleStage")), [Iri(I("Distribute"))])
        self.assertEqual(n.current_state(self.g, h)[0], "falsified")
        self.assertFalse([x for x in n.reexamine(self.g, h) if "began" in x], "a refuted idea is not flagged for new contradicting evidence")

    def test_e_the_agents_early_support_stayed_a_candidate(self):
        a = Iri(FH + "AssessAgent")
        self.assertEqual(r.review_state(self.g, a), "candidate")
        self.assertEqual(self.g.objects(a, n.ASSESSED_STATE), [Iri(I("SupportedState"))])
        self.assertEqual(n.current_state(self.g, Iri(FH + "KeywordRouting"), "2026-03-01")[0], "proposed")

    def test_provenance_is_traceable_for_every_observation_or_evidence(self):
        for a in self.g.members(r.ASSERTION):
            if r.label_of(self.g, a) in ("observation", "evidence"):
                self.assertTrue(self.g.objects(a, r.SOURCE), a.value)


class Aspects(unittest.TestCase):
    def test_demand_evidence_names_eidolons_and_is_evidence(self):
        co = "ex:Co a ifcore:Company ; " + PUB + " .\n"
        base = "ex:D a ifcore:Assertion ; schema:about ex:H ; ifcore:aspect ifcore:DemandEvidenceAspect ; "
        g = graph(idea(co + base + f"ifcore:claimLabel ifcore:EvidenceLabel ; dcterms:source ex:Co ; ifcore:demonstratedBy ex:Co ; {PUB} .\n"))
        self.assertEqual(errors(g), [])
        g = graph(idea(co + base + f"ifcore:claimLabel ifcore:EvidenceLabel ; dcterms:source ex:Co ; {PUB} .\n"))
        self.assertTrue(any(f"from no identifiable {r.FIRST}" in m for m in errors(g)))
        g = graph(idea("ex:App a schema:WebApplication ; " + PUB + " .\n" + base + f"ifcore:claimLabel ifcore:EvidenceLabel ; dcterms:source ex:H ; ifcore:demonstratedBy ex:App ; {PUB} .\n"))
        self.assertTrue(any(f"not an {r.FIRST}" in m for m in errors(g)))
        g = graph(idea(co + base + f"ifcore:claimLabel ifcore:HypothesisLabel ; ifcore:confidenceLevel ifcore:Low ; ifcore:demonstratedBy ex:Co ; {PUB} .\n"))
        self.assertTrue(any("labelled hypothesis" in m for m in errors(g)))

    def test_a_commercial_guess_cannot_pass_as_evidence(self):
        g = graph(idea("ex:D a ifcore:Assertion ; schema:about ex:H ; ifcore:aspect ifcore:CommercialHypothesisAspect ; ifcore:claimLabel ifcore:EvidenceLabel ; dcterms:source ex:H ; " + PUB + " .\n"))
        self.assertTrue(any("a guess of demand is not evidence" in m for m in errors(g)))

    def test_citations_novelty_and_patentability_are_not_demand(self):
        g = graph()
        self.assertEqual([x for x in n.STAGES if x == "validation"], ["validation"])
        names = {g.concept_notation(s) for s in g.by if isinstance(s, Iri) and Iri(n.ASPECT_SCHEME) in g.objects(s, r.IN_SCHEME)}
        self.assertFalse(names & {"citation", "novelty", "patentability", "elegance"})

    def test_revision_and_retraction_derive_from_what_they_change(self):
        for a in ("RevisionAspect", "RetractionAspect"):
            g = graph(idea(f"ex:X a ifcore:Assertion ; schema:about ex:H ; ifcore:aspect ifcore:{a} ; ifcore:claimLabel ifcore:UnknownLabel ; {PUB} .\n"))
            self.assertTrue(any("derived from nothing" in m for m in errors(g)), a)

    def test_an_aspect_is_one_of_the_scheme(self):
        g = graph(idea(f"ex:X a ifcore:Assertion ; schema:about ex:H ; ifcore:aspect ex:Odd ; ifcore:claimLabel ifcore:UnknownLabel ; {PUB} .\n"))
        self.assertTrue(any("exactly one aspect" in m for m in errors(g)))


class Commands(unittest.TestCase):
    """`reflection list` and `reflection show` (0048-noemas FR-032), and the audit (FR-035): reads, with no AI behind them."""

    def test_list_filters_by_kind_state_and_review(self):
        code, doc = run_json(["reflection", "list", "--kind", "noema"])
        self.assertEqual(code, 0, doc)
        rows = doc["data"]["reflections"]
        self.assertGreaterEqual(len(rows), 20)
        self.assertEqual({x["kind"] for x in rows}, {"noema"})
        code, doc = run_json(["reflection", "list", "--state", "falsified"])
        self.assertEqual([x["label"] for x in doc["data"]["reflections"]], ["Keyword routing is enough for triage"])
        code, doc = run_json(["reflection", "list", "--state", "falsified", "--on", "2026-05-02"])
        self.assertEqual(doc["data"]["reflections"], [], "on 2 May it was contested")
        code, doc = run_json(["reflection", "list", "--review", "candidate", "--kind", "noema"])
        self.assertEqual({x["review"] for x in doc["data"]["reflections"]}, {"candidate"})
        self.assertTrue(doc["data"]["count"] >= 2)

    def test_list_can_hold_every_kind(self):
        code, doc = run_json(["reflection", "list"])
        self.assertEqual({x["kind"] for x in doc["data"]["reflections"]}, {EID_K, "ergon", "noema"})
        code, doc = run_json(["reflection", "list", "--kind", "plant"])
        self.assertEqual(code, 2, "a kind outside the choice is refused")

    def test_show_a_noema_gives_what_an_agent_needs_with_sources(self):
        code, doc = run_json(["reflection", "show", NA + "InsightMeetsProblem"])
        self.assertEqual(code, 0, doc)
        d = doc["data"]
        self.assertEqual((d["kind"], d["state"], d["subtypes"]), ("noema", "supported", ["principle"]))
        self.assertEqual((len(d["evidence"]["supports"]), len(d["evidence"]["contradicts"])), (1, 1))
        self.assertEqual(len(d["claims"]), 1)
        self.assertTrue(d["claims"][0]["text"])
        self.assertTrue(d["assumptions"], "its assumption is listed")
        for e in d["evidence"]["supports"]:
            self.assertTrue(e["source"] and e["review"] == "accepted")
        self.assertTrue(d["reexamine"])
        self.assertEqual([k for k, v in d["research_stage"].items() if v["reached"]],
                         ["observation", "conception", "investigation", "relevance", "operationalization", "validation"])
        self.assertEqual(d["research_stage"]["validation"]["reached"], ["Demand1"], "demand evidence is read through the made thing that carries the idea")
        self.assertIn("product-wedge", d["commercial"])

    def test_show_resolves_a_local_name_and_refuses_an_unknown_or_ambiguous_one(self):
        code, doc = run_json(["reflection", "show", "KeywordRouting"])
        self.assertEqual(code, 0, doc)
        self.assertEqual(doc["data"]["state"], "falsified")
        code, doc = run_json(["reflection", "show", "NoSuchSubject"])
        self.assertEqual(code, 2)
        code, doc = run_json(["reflection", "show", "Decomposable", "--on", "2026-01-01"])
        self.assertEqual(code, 0)

    def test_show_an_eidolon_or_an_ergon_gives_its_relationships(self):
        code, doc = run_json(["reflection", "show", AW + "ClaimsWorkforce"])
        self.assertEqual((code, doc["data"]["kind"]), (0, "ergon"))
        self.assertGreaterEqual(len(doc["data"]["relationships"]["to"]), 4)
        code, doc = run_json(["reflection", "show", "https://example.org/reflections/customer-account#MeridianHealth"])
        self.assertEqual((code, doc["data"]["kind"]), (0, EID_K))
        self.assertTrue(doc["data"]["relationships"]["from"])

    def test_the_commands_change_nothing(self):
        before = {f: f.read_bytes() for f in [HOME / "ontology" / "ifcore.ttl", *(HOME / "spec-kit" / "specs" / "0048-noemas" / "examples").glob("*.ttl")]}
        for argv in (["reflection", "list"], ["reflection", "list", "--audit"], ["reflection", "list", "--duplicates"], ["reflection", "show", "KeywordRouting"]):
            self.assertEqual(run_json(argv)[0], 0, argv)
        self.assertEqual(before, {f: f.read_bytes() for f in before})

    def test_the_audit_classifies_every_subject_and_lists_what_needs_review(self):
        code, doc = run_json(["reflection", "list", "--audit"])
        self.assertEqual(code, 0, doc)
        d = doc["data"]
        self.assertTrue({EID_K, "ergon", "noema", "other", "undetermined"} >= set(d["subjects"]))
        self.assertEqual(d["needs_review"], [], "the public root holds no record of the wrong kind")
        self.assertIn("noema", d["types"])
        self.assertIsInstance(d["noema_subjects_without_a_record"], int)

    def test_the_audit_names_a_record_of_an_abstract_subject_made_as_an_ergon_or_an_eidolon(self):
        g = graph(f"ex:Idea a ifcore:IntellectualConstruct ; dcterms:type ifcore:ConceptType ; {PUB} .\n"
                  f"ex:Old a ifcore:Eid ; ifcore:reflects ex:Idea ; {PUB} .\n"
                  f"ex:Old2 a ifcore:Ergon ; ifcore:reflects ex:Idea ; ifcore:purpose \"x\" ; {PUB} .\n")
        a = r.audit(g, {"extra.ttl"})
        self.assertEqual(sorted((x["is"], x["resolves_to"]) for x in a["needs_review"]), [(r.EID_K, "noema"), ("ergon", "noema")])
        self.assertEqual(a["noema_subjects_without_a_record"], 1, "the idea itself has no Noema record yet")
        self.assertEqual(errors(g), [])

    def test_a_repository_that_extends_the_root_is_audited_against_it(self):
        class Extension(TempRepo):
            def runTest(self):
                pass
        v = Extension()
        v.setUp()
        try:
            text = (f"ex:Idea a ifcore:IntellectualConstruct ; dcterms:type ifcore:ConceptType ; {PUB} .\n"
                    f"ex:Old a ifcore:Eid ; ifcore:reflects ex:Idea ; {PUB} .\n")
            v.write("ontology/own.ttl", re.sub(r"ifcore:Eid\b", "ifcore:" + r.FIRST, HEAD + text))
            code, doc = run_json(["reflection", "list", "--audit", "--root", str(v.root)])
            self.assertEqual(code, 0, doc)
            self.assertEqual([x["resolves_to"] for x in doc["data"]["needs_review"]], ["noema"])
            self.assertEqual(doc["data"]["subjects"], {"noema": 1})
        finally:
            v.tmp.cleanup()


if __name__ == "__main__":
    unittest.main()
