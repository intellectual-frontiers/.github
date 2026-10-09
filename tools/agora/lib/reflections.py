"""Digital reflections (0047-digital-reflections): the kind a subject reflects as, and the checks of reflections, relationships and
assertions in the ontology of a repository.

A reflection is a record of one subject. The record is one of three kinds, Eidolons, Ergons or Noemas; which one is right is decided by
the subject's types through the `ifcore:ClassificationRule` individuals (FR-011, FR-012), never by the record itself and never by
default. Standard library only, over the Turtle reader (turtle.py).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from agora.core.checks import Finding
from . import turtle
from .turtle import Blank, Iri, Lit, Node

IFCORE = "https://www.intellectualfrontiers.com/ontology/core#"
RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"
SKOS = "http://www.w3.org/2004/02/skos/core#"
DCT = "http://purl.org/dc/terms/"
PROV = "http://www.w3.org/ns/prov#"
SCHEMA = "https://schema.org/"

TYPE = turtle.RDF_TYPE
SUBCLASS = RDFS + "subClassOf"
IN_SCHEME = SKOS + "inScheme"

# The first kind's name is built, not written: agora's code names no repository, and one is named for it (0042-agora FR-003).
FIRST = "Eido" + "lon"
EID, ERG, NOEMA, REFLECTION = IFCORE + FIRST, IFCORE + "Ergon", IFCORE + "Noema", IFCORE + "DigitalReflection"
RULE, SUBJECT_CLASS, REFLECTED_AS = IFCORE + "ClassificationRule", IFCORE + "subjectClass", IFCORE + "reflectedAs"
REFLECTS, PURPOSE, AUDIENCE = IFCORE + "reflects", IFCORE + "purpose", IFCORE + "hasAudience"
RELATIONSHIP, ASSERTION = IFCORE + "ReflectionRelationship", IFCORE + "Assertion"
REL_TYPE, REL_FROM, REL_TO = IFCORE + "relationType", IFCORE + "relationFrom", IFCORE + "relationTo"
FAMILY, FROM_KIND, TO_KIND = IFCORE + "relationFamily", IFCORE + "fromKind", IFCORE + "toKind"
KIND_SCHEME, FAMILY_SCHEME, RELATION_SCHEME = (IFCORE + n for n in ("ReflectionKindScheme", "RelationFamilyScheme", "ReflectionRelationScheme"))
CLAIM_LABEL, CONFIDENCE = IFCORE + "claimLabel", IFCORE + "confidenceLevel"
VERIFIED_BY, VERIFIED_ON = IFCORE + "verifiedBy", IFCORE + "verifiedOn"
PERSON = IFCORE + "Person"
SOFTWARE_AGENT = PROV + "SoftwareAgent"
SOURCE, ATTRIBUTED, DERIVED = DCT + "source", PROV + "wasAttributedTo", PROV + "wasDerivedFrom"
ABOUT = SCHEMA + "about"
VALID_FROM, VALID_THROUGH = SCHEMA + "validFrom", SCHEMA + "validThrough"

# Kinds are the notations of ifcore:ReflectionKindScheme (FR-011).
EID_K, ERG_K, NOEMA_K, OTHER_K, UNDETERMINED_K = FIRST.lower(), "ergon", "noema", "other", "undetermined"
KINDS = (EID_K, ERG_K, NOEMA_K, OTHER_K, UNDETERMINED_K)
KIND_CLASS = {EID_K: EID, ERG_K: ERG, NOEMA_K: NOEMA}      # the kinds of reflection the ontology starts with; kind_classes reads the rest
REFLECTION_CLASS = IFCORE + "reflectionClass"
KIND_PHRASE = {EID_K: "an " + FIRST, ERG_K: "an Ergon", NOEMA_K: "a Noema"}
# 0047 FR-038: the review states, and the ones that need a person's name.
REVIEW_SCHEME = IFCORE + "ReviewStateScheme"
REVIEW_STATE, REVIEWED_BY, REVIEWED_ON = IFCORE + "reviewState", IFCORE + "reviewedBy", IFCORE + "reviewedOn"
REVIEW_STATES = ("candidate", "reviewed", "accepted", "rejected")
LABELS = {n: IFCORE + n for n in ("ObservationLabel", "HypothesisLabel", "EvidenceLabel", "InferenceLabel", "RecommendationLabel", "UnknownLabel")}
LABEL_NAME = {v: k[:-len("Label")].lower() for k, v in LABELS.items()}
SOURCED = {"observation", "evidence"}             # FR-023
UNSETTLED = {"hypothesis", "inference", "recommendation", "unknown"}   # FR-024: never verified themselves
NEEDS_CONFIDENCE = {"hypothesis", "inference"}    # FR-019
# FR-017: the relationship types the scheme must define.
REQUIRED_TYPES = ("worksFor", "owns", "inventorOf", "assignsTo", "licensesTo", "develops", "operates", "offers", "purchases", "deploys",
                  "uses", "serves", "dependsOn", "integratesWith", "implements", "intends", "produces", "instantiates", "executes",
                  "evolvesFrom",
                  # 0048-noemas FR-021
                  "buildsOn", "supports", "contradicts", "refines", "generalizes", "specializes", "challenges", "supersedes", "tests",
                  "explains", "motivatedBy", "states", "describes", "informsDesignOf", "operationalizes", "generatesEvidenceFor",
                  "providesEvidenceFor", "proposes", "researches", "adopts")
HIERARCHY = (SKOS + "broader", SKOS + "narrower", SKOS + "broaderTransitive", SKOS + "narrowerTransitive", RDFS + "subPropertyOf",
             RDFS + "subClassOf")


def short(node: Node | str) -> str:
    v = node.value if isinstance(node, (Iri, Lit)) else str(node)
    for ns, pre in ((IFCORE, "ifcore:"), (SCHEMA, "schema:"), (PROV, "prov:"), (SKOS, "skos:"), (DCT, "dcterms:")):
        if v.startswith(ns):
            return pre + v[len(ns):]
    return v.rsplit("/", 1)[-1] if len(v) > 60 else v


@dataclass
class Graph:
    """Triples of one or more ontology files, with the file and line each came from, and the questions the checks ask."""
    triples: list[tuple[Node, str, Node, int, str]] = field(default_factory=list)
    unreadable: list[tuple[str, str]] = field(default_factory=list)
    _by: dict | None = None
    _closure: dict[str, set[str]] = field(default_factory=dict)

    def add(self, text: str, name: str) -> None:
        try:
            _, tr = turtle.parse(text)
        except turtle.TurtleError as e:
            self.unreadable.append((name, str(e)))
            return
        self.triples += [(s, p, o, ln, name) for s, p, o, ln in tr]
        self._by, self._closure = None, {}

    def add_files(self, files: Iterable[Path], base: Path) -> None:
        for f in files:
            self.add(f.read_text(encoding="utf-8"), str(f.relative_to(base)))

    @property
    def by(self) -> dict:
        if self._by is None:
            self._by = {}
            for s, p, o, ln, f in self.triples:
                self._by.setdefault(s, []).append((p, o, ln, f))
        return self._by

    def objects(self, s: Node, p: str) -> list[Node]:
        return [o for q, o, _, _ in self.by.get(s, ()) if q == p]

    def where(self, s: Node) -> str:
        for _, _, ln, f in self.by.get(s, ()):
            return f"{f}:{ln}"
        return "ontology"

    def file(self, s: Node) -> str:
        for _, _, _, f in self.by.get(s, ()):
            return f
        return ""

    def declared_types(self, s: Node) -> set[str]:
        return {o.value for o in self.objects(s, TYPE) if isinstance(o, Iri)}

    def supers(self, cls: str) -> set[str]:
        """The class and every superclass the ontology states for it."""
        if cls not in self._closure:
            seen, stack = set(), [cls]
            while stack:
                c = stack.pop()
                if c in seen:
                    continue
                seen.add(c)
                stack += [o.value for o in self.objects(Iri(c), SUBCLASS) if isinstance(o, Iri)]
            self._closure[cls] = seen
        return self._closure[cls]

    def all_types(self, s: Node) -> set[str]:
        out: set[str] = set()
        for t in self.declared_types(s):
            out |= self.supers(t)
        return out

    def members(self, cls: str) -> list[Node]:
        """Individuals whose declared types reach `cls`, not classes themselves."""
        return [s for s in self.by if isinstance(s, Iri) and cls in self.all_types(s)
                and not self.declared_types(s) & {OWL + "Class", RDFS + "Class"}]

    def concept_notation(self, c: Node) -> str | None:
        for o in self.objects(c, SKOS + "notation"):
            if isinstance(o, Lit):
                return o.value
        return None

    def kind_concept(self, notation: str) -> Node | None:
        for s in self.by:
            if isinstance(s, Iri) and Iri(KIND_SCHEME) in self.objects(s, IN_SCHEME) and self.concept_notation(s) == notation:
                return s
        return None


@dataclass
class Rule:
    iri: Node
    cls: str
    kind: str


def kind_classes(g: Graph) -> dict[str, str]:
    """Kind notation -> the class of reflection records it names, as the ontology declares them (ifcore:reflectionClass). A further
    kind of reflection is added there, with a class and rules, and this module needs no change (0048-noemas FR-037)."""
    out: dict[str, str] = {}
    for s in g.by:
        if isinstance(s, Iri) and Iri(KIND_SCHEME) in g.objects(s, IN_SCHEME):
            n, cls = g.concept_notation(s), [o for o in g.objects(s, REFLECTION_CLASS) if isinstance(o, Iri)]
            if n and len(cls) == 1:
                out[n] = cls[0].value
    return out or dict(KIND_CLASS)


def scheme_kinds(g: Graph) -> set[str]:
    """Every notation of the kind scheme, the further kinds included."""
    return {n for s in g.by if isinstance(s, Iri) and Iri(KIND_SCHEME) in g.objects(s, IN_SCHEME) and (n := g.concept_notation(s))} or set(KINDS)


def rules(g: Graph) -> dict[str, Rule]:
    """Class IRI -> its rule. A rule that names no class or no kind is left to `check` to report."""
    out: dict[str, Rule] = {}
    known = scheme_kinds(g)
    for r in g.members(RULE):
        classes = [o.value for o in g.objects(r, SUBJECT_CLASS) if isinstance(o, Iri)]
        kinds = [g.concept_notation(o) for o in g.objects(r, REFLECTED_AS) if isinstance(o, Iri)]
        if len(classes) == 1 and len(kinds) == 1 and kinds[0] in known:
            out.setdefault(classes[0], Rule(r, classes[0], kinds[0]))
    return out


def resolve_types(g: Graph, types: Iterable[str]) -> tuple[str, str]:
    """(kind, why) for a subject of these types (FR-012). The most specific matching rules decide; if they agree that is the kind;
    if they disagree, or none matches, the kind is `undetermined`, never a default."""
    table = rules(g)
    matched = {c for t in types for c in g.supers(t) if c in table}
    specific = {c for c in matched if not any(d != c and c in g.supers(d) for d in matched)}
    kinds = {table[c].kind for c in specific}
    names = ", ".join(sorted(short(c) for c in specific))
    if not specific:
        return UNDETERMINED_K, "no rule matches its types"
    if len(kinds) > 1:
        return UNDETERMINED_K, f"the rules for {names} disagree ({', '.join(sorted(kinds))})"
    return kinds.pop(), f"rule for {names}"


def subject_kind(g: Graph, subject: Node) -> tuple[str, str]:
    types = g.declared_types(subject)
    if not types:
        return UNDETERMINED_K, "the ontology gives it no type"
    return resolve_types(g, types)


def record_kind(g: Graph, record: Node) -> set[str]:
    """The kinds a reflection record is typed as: one, or more than one (an error)."""
    ts = g.all_types(record)
    return {k for k, cls in kind_classes(g).items() if cls in ts}


def assertion_status(g: Graph, a: Node) -> str:
    """`verified` when a person verified it; else `ai-unverified` when an AI agent stated it; else `unverified`. A hypothesis is
    never `verified` (FR-024)."""
    if g.objects(a, VERIFIED_BY):
        return "verified"
    for o in g.objects(a, ATTRIBUTED):
        if SOFTWARE_AGENT in g.all_types(o):
            return "ai-unverified"
    return "unverified"


def label_of(g: Graph, a: Node) -> str | None:
    labels = [LABEL_NAME[o.value] for o in g.objects(a, CLAIM_LABEL) if isinstance(o, Iri) and o.value in LABEL_NAME]
    return labels[0] if len(labels) == 1 else None


def relationships_of(g: Graph, type: str | None = None, start: Node | None = None, end: Node | None = None,
                     on: str | None = None) -> list[Node]:
    """The relationships of a type (by notation, such as `owns`), from a subject, to a subject, and, with `on` (an ISO date), those
    valid then. A relationship with no `schema:validFrom` has held since before any date; with no `schema:validThrough` it holds
    still (FR-019, FR-020). Nothing is inferred: an `inventorOf` is never an `owns`."""
    out = []
    for r in g.members(RELATIONSHIP):
        t = g.objects(r, REL_TYPE)
        if type is not None and not (t and g.concept_notation(t[0]) == type):
            continue
        if start is not None and g.objects(r, REL_FROM) != [start]:
            continue
        if end is not None and g.objects(r, REL_TO) != [end]:
            continue
        if on is not None:
            first, last = _date(g.objects(r, VALID_FROM)), _date(g.objects(r, VALID_THROUGH))
            if (first and on < first) or (last and on > last):
                continue
        out.append(r)
    return out


def load(root: Path, public: Path) -> tuple[Graph, str]:
    """The public ontology and, when `root` is another repository, its ontology files. Returns the graph and the repository's own
    file prefix: only findings in `root`'s files are reported by `check`."""
    g = Graph()
    if public != root:
        g.add_files(sorted((public / "ontology").glob("*.ttl")), public)
    g.add_files(sorted((root / "ontology").rglob("*.ttl")), root)
    if public == root:
        g.add_files(examples(root), root)
    return g, str(root)


def examples(root: Path) -> list[Path]:
    """The worked examples next to a spec; checked with the ontology so that they cannot drift from it."""
    d = root / "spec-kit" / "specs"
    return sorted(d.glob("*/examples/*.ttl")) if d.is_dir() else []


def check(root: Path, public: Path) -> list[Finding]:
    """0047-digital-reflections FR-001, FR-002, FR-008, FR-011, FR-012, FR-016 to FR-025, FR-031, FR-036."""
    g, _ = load(root, public)
    own = {str(f.relative_to(root)) for f in (root / "ontology").rglob("*.ttl")} if (root / "ontology").is_dir() else set()
    if public == root:
        own |= {str(f.relative_to(root)) for f in examples(root)}
    findings = check_graph(g, own)
    findings += [Finding("warning", name, f"cannot be read, so its reflections are not checked: {why}") for name, why in g.unreadable if name in own]
    return findings


def check_graph(g: Graph, own: set[str] | None = None) -> list[Finding]:
    """Every finding of the graph; with `own`, only those at subjects declared in those files."""
    out: list[Finding] = []

    def add(level: str, s: Node | None, msg: str, where: str | None = None) -> None:
        if s is not None and own is not None and g.file(s) not in own:
            return
        out.append(Finding(level, where or (g.where(s) if s is not None else "ontology"), msg))

    _check_model(g, add)
    _check_rules(g, add)
    _check_relation_types(g, add)
    _check_reflections(g, add)
    _check_relationships(g, add)
    _check_assertions(g, add)
    _check_review(g, add)
    from . import noemas
    noemas.check(g, add)
    from . import platforms
    platforms.check(g, add)
    return out


def _check_model(g: Graph, add) -> None:
    kc = kind_classes(g)
    names = {k: (FIRST if k == EID_K else k.capitalize()) for k in kc}
    pairs = [(x, y) for i, x in enumerate(sorted(kc)) for y in sorted(kc)[i + 1:]]
    for x, y in pairs:
        cx, cy = Iri(kc[x]), Iri(kc[y])
        if cy not in g.objects(cx, OWL + "disjointWith") and cx not in g.objects(cy, OWL + "disjointWith"):
            add("error", cx, f"ifcore:{names[x]} and ifcore:{names[y]} are not declared owl:disjointWith (0047-digital-reflections FR-001)")
    for k, cls in kc.items():
        if REFLECTION not in g.supers(cls):
            add("error", Iri(cls), f"ifcore:{names[k]} is not a subclass of ifcore:DigitalReflection (0047-digital-reflections FR-001)")
    for k in KINDS:
        if g.kind_concept(k) is None:
            add("error", Iri(KIND_SCHEME), f"has no concept with the notation {k!r} (0047-digital-reflections FR-011)")
    for k in KIND_CLASS:
        if k not in kc:
            add("error", Iri(KIND_SCHEME), f"the {k!r} concept names no class of reflection records (ifcore:reflectionClass) (0047-digital-reflections FR-001)")


def _check_rules(g: Graph, add) -> None:
    seen: dict[str, Node] = {}
    for r in g.members(RULE):
        classes = g.objects(r, SUBJECT_CLASS)
        kinds = g.objects(r, REFLECTED_AS)
        if len(classes) != 1 or not isinstance(classes[0], Iri):
            add("error", r, f"{short(r)} names {len(classes)} subject classes; a rule names exactly one (0047-digital-reflections FR-011)")
            continue
        kind_ok = len(kinds) == 1 and isinstance(kinds[0], Iri) and Iri(KIND_SCHEME) in g.objects(kinds[0], IN_SCHEME) \
            and g.concept_notation(kinds[0]) in scheme_kinds(g)
        if not kind_ok:
            add("error", r, f"{short(r)} does not name exactly one kind of ifcore:ReflectionKindScheme (0047-digital-reflections FR-011)")
        cls = classes[0].value
        if cls in seen:
            add("error", r, f"{short(r)} and {short(seen[cls])} both classify {short(cls)}; at most one rule names a class (0047-digital-reflections FR-011)")
        seen[cls] = r
        if not g.objects(r, RDFS + "comment"):
            add("error", r, f"{short(r)} states no reason (rdfs:comment): which of identity, purpose, abstraction level or lifecycle decides (0047-digital-reflections FR-010)")
        if not g.objects(r, AUDIENCE):
            add("error", r, f"{short(r)} declares no audience (0001-eidolon-architecture FR-011)")


def _check_relation_types(g: Graph, add) -> None:
    scheme = Iri(RELATION_SCHEME)
    types = [s for s in g.by if isinstance(s, Iri) and scheme in g.objects(s, IN_SCHEME)]
    present = {g.concept_notation(t) for t in types}
    for name in REQUIRED_TYPES:
        if name not in present:
            add("error", scheme, f"the relationship scheme has no type {name} (0047-digital-reflections FR-017)")
    kinds_ok = scheme_kinds(g) - {UNDETERMINED_K}
    for t in types:
        fam = g.objects(t, FAMILY)
        if len(fam) != 1 or not (isinstance(fam[0], Iri) and Iri(FAMILY_SCHEME) in g.objects(fam[0], IN_SCHEME)):
            add("error", t, f"{short(t)} does not belong to exactly one family (0047-digital-reflections FR-017)")
        for prop, label in ((FROM_KIND, "fromKind"), (TO_KIND, "toKind")):
            ks = {g.concept_notation(o) for o in g.objects(t, prop)}
            if not ks or not ks <= kinds_ok:
                add("error", t, f"{short(t)} must name at least one of {", ".join(sorted(kinds_ok))} as {label} (0047-digital-reflections FR-017)")
        for prop in HIERARCHY:
            if g.objects(t, prop):
                add("error", t, f"{short(t)} is arranged under another term by {short(prop)}; relationship types are flat, so none is inferred from another (0047-digital-reflections FR-018)")


def _check_reflections(g: Graph, add) -> None:
    for r in g.members(REFLECTION):
        kinds = record_kind(g, r)
        name = short(r)
        if len(kinds) != 1:
            add("error", r, f"{name} is typed both {FIRST} and Ergon; a reflection is exactly one (0047-digital-reflections FR-001)")
            continue
        mine = next(iter(kinds))
        subjects = g.objects(r, REFLECTS)
        if len(subjects) != 1 or not isinstance(subjects[0], Iri):
            add("error", r, f"{name} must reflect exactly one subject, named by its identifier (ifcore:reflects) (0047-digital-reflections FR-002)")
            continue
        if not g.objects(r, AUDIENCE):
            add("error", r, f"{name} declares no audience (0047-digital-reflections FR-004)")
        if mine == ERG_K and not g.objects(r, PURPOSE):
            add("error", r, f"{name} is an Ergon with no ifcore:purpose (0047-digital-reflections FR-008)")
        if mine == NOEMA_K and not [o for o in g.objects(r, SKOS + "definition") if isinstance(o, Lit)]:
            add("error", r, f"{name} is a Noema with no skos:definition: what the idea is (0048-noemas FR-001)")
        if SCHEMA + "Claim" in g.all_types(subjects[0]):
            add("error", r, f"{name} reflects {short(subjects[0])}, a claim; a claim has no reflection, a Noema states it (0048-noemas FR-008)")
        for newer in g.objects(r, DCT + "isReplacedBy"):
            if g.objects(newer, REFLECTS) != subjects or r not in g.objects(newer, DERIVED):
                add("error", r, f"{name} is replaced by {short(newer)}, which must reflect the same subject and be derived (prov:wasDerivedFrom) from it (0047-digital-reflections FR-032)")
        theirs, why = subject_kind(g, subjects[0])
        if theirs != mine:
            add("warning", r, f"{name} is {KIND_PHRASE.get(mine, 'a ' + mine)} but its subject {short(subjects[0])} resolves to {theirs} ({why}): needs review, not changed (0047-digital-reflections FR-031)")


def _check_relationships(g: Graph, add) -> None:
    for r in g.members(RELATIONSHIP):
        name = short(r)
        types = g.objects(r, REL_TYPE)
        t = types[0] if len(types) == 1 and isinstance(types[0], Iri) else None
        if t is None or Iri(RELATION_SCHEME) not in g.objects(t, IN_SCHEME):
            add("error", r, f"{name} must have exactly one type from ifcore:ReflectionRelationScheme (0047-digital-reflections FR-016)")
        ends = {}
        for prop, label in ((REL_FROM, "relationFrom"), (REL_TO, "relationTo")):
            vs = g.objects(r, prop)
            if len(vs) != 1 or not isinstance(vs[0], Iri):
                add("error", r, f"{name} must have exactly one {label}, a subject identifier and not a name (0047-digital-reflections FR-016, FR-002)")
            else:
                ends[label] = vs[0]
                if REFLECTION in g.all_types(vs[0]):
                    add("error", r, f"{name} is stated between records, {short(vs[0])} being a reflection; a relationship is between the subjects (0047-digital-reflections FR-021)")
        if t is not None:
            for label, prop in (("relationFrom", FROM_KIND), ("relationTo", TO_KIND)):
                if label in ends:
                    allowed = {g.concept_notation(o) for o in g.objects(t, prop)}
                    got, why = subject_kind(g, ends[label])
                    if got != UNDETERMINED_K and allowed and got not in allowed:
                        add("error", r, f"{name}: {g.concept_notation(t)} cannot {'start from' if label == 'relationFrom' else 'point to'} {short(ends[label])}, whose kind is {got} ({why}); it allows {', '.join(sorted(allowed))} (0047-digital-reflections FR-017)")
        label = label_of(g, r)
        if label is None:
            continue   # reported once by _check_assertions
        if label not in ("hypothesis", "unknown") and not g.objects(r, SOURCE):
            add("error", r, f"{name} has no source (dcterms:source) and is labelled {label}; without a source it is a hypothesis or unknown (0047-digital-reflections FR-019)")
        if label in NEEDS_CONFIDENCE and not g.objects(r, CONFIDENCE):
            add("error", r, f"{name} is a {label} with no ifcore:confidenceLevel (0047-digital-reflections FR-019)")
        start, end = (_date(g.objects(r, p)) for p in (VALID_FROM, VALID_THROUGH))
        if start and end and end < start:
            add("error", r, f"{name} ends ({end}) before it starts ({start}) (0047-digital-reflections FR-020)")


def _date(values: list[Node]) -> str | None:
    for v in values:
        if isinstance(v, Lit) and re.match(r"\d{4}-\d{2}-\d{2}", v.value):
            return v.value[:10]
    return None


def _check_assertions(g: Graph, add) -> None:
    for a in g.members(ASSERTION):
        name = short(a)
        label = label_of(g, a)
        if label is None:
            add("error", a, f"{name} must carry exactly one ifcore:claimLabel of the closed set (0047-digital-reflections FR-022)")
            continue
        is_rel = RELATIONSHIP in g.all_types(a)
        if not is_rel and not [o for o in g.objects(a, ABOUT) if isinstance(o, Iri)]:
            add("error", a, f"{name} says nothing about a subject (schema:about, by identifier) (0047-digital-reflections FR-022)")
        if label in SOURCED and not g.objects(a, SOURCE):
            add("error", a, f"{name} is an {label} with no source (dcterms:source) (0047-digital-reflections FR-023)")
        by, on = g.objects(a, VERIFIED_BY), g.objects(a, VERIFIED_ON)
        if bool(by) != bool(on):
            add("error", a, f"{name} needs both ifcore:verifiedBy and ifcore:verifiedOn, or neither (0047-digital-reflections FR-024)")
        for who in by:
            ts = g.all_types(who) if isinstance(who, Iri) else set()
            if SOFTWARE_AGENT in ts or (ts and PERSON not in ts):
                add("error", a, f"{name} is verified by {short(who)}, which is not a person; an AI agent never verifies (0047-digital-reflections FR-024)")
        if by and label in UNSETTLED:
            add("error", a, f"{name} is a {label} and cannot carry verification; record the person's confirmation as a new observation or evidence derived from it (0047-digital-reflections FR-024)")
        if label == "recommendation" and not g.objects(a, DERIVED):
            add("error", a, f"{name} is a recommendation derived from nothing (prov:wasDerivedFrom) (0047-digital-reflections FR-025)")


def review_state(g: Graph, node: Node) -> str:
    """The review state of an assertion or a reflection record: the one it states, else `candidate` (0047 FR-038)."""
    for o in g.objects(node, REVIEW_STATE):
        n = g.concept_notation(o) if isinstance(o, Iri) else None
        if n in REVIEW_STATES:
            return n
    return "candidate"


def _check_review(g: Graph, add) -> None:
    for a in {*g.members(ASSERTION), *g.members(REFLECTION)}:
        name = short(a)
        states = g.objects(a, REVIEW_STATE)
        if len(states) > 1 or (states and not (isinstance(states[0], Iri) and Iri(REVIEW_SCHEME) in g.objects(states[0], IN_SCHEME)
                                                and g.concept_notation(states[0]) in REVIEW_STATES)):
            add("error", a, f"{name} must have at most one review state of ifcore:ReviewStateScheme (0047-digital-reflections FR-038)")
            continue
        by, on = g.objects(a, REVIEWED_BY), g.objects(a, REVIEWED_ON)
        if bool(by) != bool(on):
            add("error", a, f"{name} needs both ifcore:reviewedBy and ifcore:reviewedOn, or neither (0047-digital-reflections FR-038)")
        for who in by:
            ts = g.all_types(who) if isinstance(who, Iri) else set()
            if SOFTWARE_AGENT in ts or (ts and PERSON not in ts):
                add("error", a, f"{name} is reviewed by {short(who)}, which is not a person; an AI agent never reviews (0047-digital-reflections FR-038)")
        if review_state(g, a) != "candidate" and not by:
            ai = any(SOFTWARE_AGENT in g.all_types(o) for o in g.objects(a, ATTRIBUTED))
            add("error", a, f"{name} is {review_state(g, a)} with no reviewer{', and an AI agent stated it' if ai else ''}: only a person's review moves a candidate on (0047-digital-reflections FR-038)")


def audit(g: Graph, own: set[str] | None = None, top: int = 12) -> dict:
    """The classification audit (0048-noemas FR-035): how the subjects of a repository resolve, each reflection whose kind disagrees with
    its subject's, and the abstract subjects that have no Noema record. Reads only; changes nothing. `own` limits it to those files."""
    counts: dict[str, int] = {}
    by_type: dict[str, dict[str, int]] = {}
    unreflected: list[str] = []
    reflected = {o for rec in g.members(NOEMA) for o in g.objects(rec, REFLECTS)}     # by a Noema record: a record of the wrong kind does not count
    skip = {OWL + "Class", RDFS + "Class", OWL + "ObjectProperty", OWL + "DatatypeProperty", OWL + "Ontology"}
    for s in g.by:
        if not isinstance(s, Iri) or (own is not None and g.file(s) not in own):
            continue
        ts = g.declared_types(s)
        if not ts or ts & skip or g.all_types(s) & set(kind_classes(g).values()):
            continue
        k, _ = resolve_types(g, ts)
        counts[k] = counts.get(k, 0) + 1
        label = ", ".join(sorted(short(t) for t in ts))
        by_type.setdefault(k, {})[label] = by_type.get(k, {}).get(label, 0) + 1
        if k == NOEMA_K and s not in reflected:
            unreflected.append(s.value)
    records = []
    for rec in sorted(g.members(REFLECTION), key=lambda n: n.value):
        if own is not None and g.file(rec) not in own:
            continue
        mine, subj = record_kind(g, rec), [o for o in g.objects(rec, REFLECTS) if isinstance(o, Iri)]
        if len(mine) == 1 and len(subj) == 1:
            theirs, why = subject_kind(g, subj[0])
            if theirs not in mine:
                records.append({"record": rec.value, "is": next(iter(mine)), "subject": subj[0].value, "resolves_to": theirs, "why": why})
    return {"subjects": dict(sorted(counts.items())),
            "types": {k: dict(sorted(v.items(), key=lambda kv: -kv[1])[:top]) for k, v in sorted(by_type.items())},
            "needs_review": records, "noema_subjects_without_a_record": len(unreflected), "sample": sorted(unreflected)[:5]}
