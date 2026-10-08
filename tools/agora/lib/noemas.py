"""Noemas (0048-noemas): the checks of what only an idea needs, and the reads an agent or a person asks of one.

The shared mechanisms (kind, identity, relationships, assertions, review) are reflections.py's, and none is repeated here. A Noema's
record adds a statement of the idea, a subtype, claims it states, an epistemic state assessed over time, and evidence for and
against it. Nothing here changes a file or calls an AI; everything derived (the current state, the research stage, what warrants
another look) is computed from the records and never stored, so that it cannot drift from them. Standard library only.
"""
from __future__ import annotations

import re
from typing import Iterable

from agora.core.checks import Finding
from .reflections import (ABOUT, ASSERTION, ATTRIBUTED, CLAIM_LABEL, DCT, DERIVED, EID_K, ERG_K, FIRST, IFCORE, IN_SCHEME, NOEMA, NOEMA_K, OTHER_K,
                          REFLECTION, REFLECTS, REL_FROM, REL_TO, REL_TYPE, SKOS, SOURCE, SOFTWARE_AGENT, VALID_FROM, VALID_THROUGH,
                          Graph, _date, label_of, relationships_of, review_state, short, subject_kind)
from .turtle import Iri, Lit, Node

ASSESSMENT, ASSESSED_STATE = IFCORE + "EpistemicAssessment", IFCORE + "assessedState"
EPISTEMIC_SCHEME, TYPE_SCHEME, ASPECT_SCHEME = (IFCORE + n for n in ("EpistemicStateScheme", "NoemaTypeScheme", "AspectScheme"))
ASPECT, DEMONSTRATED_BY, CONSTRUCT = IFCORE + "aspect", IFCORE + "demonstratedBy", IFCORE + "IntellectualConstruct"
CLAIM, DC_TYPE = "https://schema.org/Claim", DCT + "type"
STATES = ("proposed", "under-investigation", "supported", "contested", "falsified", "superseded")
BASED = {"supported", "contested", "falsified"}          # FR-015: these name their basis
NOT_STATES = {"proven", "true", "verified", "validated", "published", "approved", "draft", "deprecated"}   # FR-013, FR-014
NEEDS_CLAIM = {"hypothesis", "research-finding"}         # FR-008
STAGES = ("observation", "conception", "investigation", "relevance", "experimentation", "operationalization", "validation", "compounding")


def notation(g: Graph, node: Node) -> str | None:
    return g.concept_notation(node) if isinstance(node, Iri) else None


def noema_subjects(g: Graph) -> dict[Node, Node]:
    """Subject -> the Noema record that reflects it."""
    out: dict[Node, Node] = {}
    for rec in g.members(NOEMA):
        for s in g.objects(rec, REFLECTS):
            if isinstance(s, Iri):
                out.setdefault(s, rec)
    return out


def subtypes(g: Graph, subject: Node) -> set[str]:
    """The subtype notations a subject carries (dcterms:type of ifcore:NoemaTypeScheme)."""
    return {n for o in g.objects(subject, DC_TYPE) if Iri(TYPE_SCHEME) in g.objects(o, IN_SCHEME) and (n := notation(g, o))}


def assertions_about(g: Graph, subject: Node) -> list[Node]:
    return [a for a in g.members(ASSERTION) if subject in g.objects(a, ABOUT)]


def assessments(g: Graph, subject: Node) -> list[Node]:
    return [a for a in assertions_about(g, subject) if ASSESSMENT in g.all_types(a)]


def aspects_of(g: Graph, subject: Node, aspect: str | None = None) -> list[Node]:
    """Assertions about the subject with an aspect (by notation), in any review state."""
    return [a for a in assertions_about(g, subject)
            if any(notation(g, o) and (aspect is None or notation(g, o) == aspect) for o in g.objects(a, ASPECT))]


def current_state(g: Graph, subject: Node, on: str | None = None) -> tuple[str, Node | None]:
    """(state, the assessment that gives it). Only an accepted assessment in force on `on` counts, the latest by `schema:validFrom`;
    a candidate, reviewed or rejected one never changes the state, so an AI cannot promote an idea. None gives `proposed` (FR-012)."""
    best: tuple[str, Node, str] | None = None
    for a in assessments(g, subject):
        if review_state(g, a) != "accepted":
            continue
        start, end = _date(g.objects(a, VALID_FROM)), _date(g.objects(a, VALID_THROUGH))
        if start is None or (on and (on < start or (end and on > end))):
            continue
        st = [notation(g, o) for o in g.objects(a, ASSESSED_STATE)]
        if len(st) == 1 and st[0] in STATES and (best is None or start >= best[0]):
            best = (start, a, st[0])
    return (best[2], best[1]) if best else ("proposed", None)


def evidence(g: Graph, subject: Node, on: str | None = None) -> dict[str, list[Node]]:
    """The relationships bearing on a Noema's subject, by type: for it and against it at once (FR-016). Each carries its own source,
    label, confidence and dates; nothing is netted off."""
    out: dict[str, list[Node]] = {}
    for t in ("supports", "contradicts", "challenges", "tests", "providesEvidenceFor", "generatesEvidenceFor", "explains"):
        out[t] = relationships_of(g, t, None, subject, on) if t != "explains" else relationships_of(g, t, subject, None, on)
    return out


def claims_of(g: Graph, subject: Node, on: str | None = None) -> list[Node]:
    return [c for r in relationships_of(g, "states", subject, None, on) for c in g.objects(r, REL_TO)]


def _accepted(g: Graph, nodes: Iterable[Node]) -> list[Node]:
    return [n for n in nodes if review_state(g, n) == "accepted"]


def trace(g: Graph, subject: Node) -> dict[str, dict[str, list[Node]]]:
    """How far an idea has travelled from an observation toward a validated, compounding advantage (FR-025). Derived: a stage is
    `reached` only by accepted records, the ones still candidates are listed apart, and no stage is required (commercialization is one
    possible consequence, FR-025). Demand counts only as demand evidence from Eidolons (FR-027): citations and novelty are not."""
    rel = lambda t, a=None, b=None: relationships_of(g, t, a, b)       # noqa: E731
    linked = [r for t in ("operationalizes", "implements") for r in rel(t, None, subject)] + rel("informsDesignOf", subject, None)
    ergons = {x for r in linked for x in (*g.objects(r, REL_FROM), *g.objects(r, REL_TO)) if x != subject}
    ev = evidence(g, subject)
    raw: dict[str, list[Node]] = {
        "observation": rel("motivatedBy", subject, None) + rel("explains", subject, None),
        "conception": [subject],
        "investigation": [x for t in ("supports", "contradicts", "challenges", "tests") for x in ev[t]] + assessments(g, subject),
        "relevance": aspects_of(g, subject, "problem-addressed") + aspects_of(g, subject, "existing-workflow"),
        "experimentation": ev["tests"] + ev["generatesEvidenceFor"] + aspects_of(g, subject, "experimental-design"),
        "operationalization": linked,
        "validation": [a for who in (subject, *ergons) for a in aspects_of(g, who, "demand-evidence")
                       if label_of(g, a) in ("observation", "evidence") and g.objects(a, DEMONSTRATED_BY)],
        "compounding": [a for a in aspects_of(g, subject, "native-alpha-source") if label_of(g, a) in ("observation", "evidence")],
    }
    out: dict[str, dict[str, list[Node]]] = {}
    for st in STAGES:
        items = raw[st]
        done = items if st == "conception" else _accepted(g, items)
        out[st] = {"reached": done, "pending": [n for n in items if n not in done]}
    return out


def reexamine(g: Graph, subject: Node) -> list[str]:
    """Why a Noema warrants another look (FR-034): evidence against it, or a challenge, that came into force after its latest accepted
    assessment; an assessment awaiting a person's review; a hypothesis with no falsification criterion."""
    reasons: list[str] = []
    state, current = current_state(g, subject)
    since = _date(g.objects(current, VALID_FROM)) if current else None
    if state in ("supported", "proposed", "under-investigation", "contested"):
        for t in ("contradicts", "challenges"):
            for r in relationships_of(g, t, None, subject):
                start = _date(g.objects(r, VALID_FROM))
                if since and start and start > since:
                    reasons.append(f"{short(r)} ({t}) began {start}, after the {state} assessment of {since}")
    for a in assessments(g, subject):
        if review_state(g, a) == "candidate":
            reasons.append(f"{short(a)} is an assessment awaiting a person's review")
    if "hypothesis" in subtypes(g, subject) and not aspects_of(g, subject, "falsification-criterion"):
        reasons.append("it is a hypothesis with no falsification criterion")
    return reasons


def candidates(g: Graph) -> list[Node]:
    """Assertions and records of Noemas still awaiting a person's review."""
    pool = {*g.members(ASSERTION), *g.members(NOEMA)}
    return sorted((n for n in pool if review_state(g, n) == "candidate"), key=lambda n: n.value)


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def labels(g: Graph, subject: Node) -> set[str]:
    out = set()
    for p in (SKOS + "prefLabel", SKOS + "altLabel", "http://www.w3.org/2000/01/rdf-schema#label"):
        out |= {_norm(o.value) for o in g.objects(subject, p) if isinstance(o, Lit) and _norm(o.value)}
    return out


def possible_duplicates(g: Graph) -> list[tuple[Node, Node, str]]:
    """Pairs of Noema subjects that share a normalized label (FR-033). Reported to a person, never merged."""
    seen: dict[str, Node] = {}
    out = []
    for s in sorted(noema_subjects(g), key=lambda n: n.value):
        for lab in sorted(labels(g, s)):
            if lab in seen and seen[lab] != s:
                out.append((seen[lab], s, lab))
            seen.setdefault(lab, s)
    return out


def check(g: Graph, add) -> None:
    """0048-noemas FR-001, FR-005, FR-008, FR-012 to FR-015, FR-017, FR-018, FR-027, FR-033."""
    _check_scheme(g, add)
    subjects = noema_subjects(g)
    for subject, rec in subjects.items():
        _check_subject(g, add, subject, rec)
    for a in g.members(ASSESSMENT):
        _check_assessment(g, add, a)
    for a in g.members(ASSERTION):
        if g.objects(a, ASPECT):
            _check_aspect(g, add, a)
    for one, two, lab in possible_duplicates(g):
        add("warning", two, f"{short(two)} and {short(one)} share the label {lab!r}: possible duplicates, for a person to merge or to tell apart (0048-noemas FR-033)")


def _check_scheme(g: Graph, add) -> None:
    scheme = Iri(EPISTEMIC_SCHEME)
    members = [s for s in g.by if isinstance(s, Iri) and scheme in g.objects(s, IN_SCHEME)]
    have = {notation(g, m) for m in members}
    if not set(STATES) <= have:
        add("error", scheme, f"the epistemic scheme lacks {', '.join(sorted(set(STATES) - have))} (0048-noemas FR-011)")
    for m in members:
        if notation(g, m) in NOT_STATES:
            add("error", m, f"{short(m)} is not an epistemic state: supported is not proven, and publication and lifecycle states are kept apart (0048-noemas FR-013, FR-014)")


def _check_subject(g: Graph, add, subject: Node, rec: Node) -> None:
    name = short(subject)
    types = g.all_types(subject)
    if CONSTRUCT in types:
        found = [o for o in g.objects(subject, DC_TYPE)]
        if not found:
            add("error", rec, f"{name} is an intellectual construct with no subtype (dcterms:type of ifcore:NoemaTypeScheme) (0048-noemas FR-005)")
        for o in found:
            if Iri(TYPE_SCHEME) not in g.objects(o, IN_SCHEME):
                add("error", rec, f"{name}: {short(o)} is not a Noema subtype of ifcore:NoemaTypeScheme (0048-noemas FR-005)")
    if (subtypes(g, subject) & NEEDS_CLAIM) and not claims_of(g, subject):
        add("error", rec, f"{name} is a {'/'.join(sorted(subtypes(g, subject) & NEEDS_CLAIM))} and states no claim (a 'states' relationship) (0048-noemas FR-008)")
    if "hypothesis" in subtypes(g, subject) and not aspects_of(g, subject, "falsification-criterion"):
        add("warning", rec, f"{name} is a hypothesis with no falsification criterion (0048-noemas FR-017)")


def _check_assessment(g: Graph, add, a: Node) -> None:
    name = short(a)
    states = g.objects(a, ASSESSED_STATE)
    st = notation(g, states[0]) if len(states) == 1 else None
    if st not in STATES or Iri(EPISTEMIC_SCHEME) not in g.objects(states[0], IN_SCHEME):
        add("error", a, f"{name} must name exactly one state of ifcore:EpistemicStateScheme (0048-noemas FR-012)")
        return
    subjects = [o for o in g.objects(a, ABOUT) if isinstance(o, Iri)]
    if not _date(g.objects(a, VALID_FROM)):
        add("error", a, f"{name} says from when it holds (schema:validFrom): a state is assessed at a time (0048-noemas FR-012)")
    if st in BASED and not g.objects(a, SOURCE):
        add("error", a, f"{name} assesses {st} with no basis (dcterms:source) (0048-noemas FR-015)")
    for s in subjects:
        kind, _ = subject_kind(g, s)
        if kind in (EID_K, ERG_K, OTHER_K):
            add("error", a, f"{name} assesses {short(s)}, whose kind is {kind}; an epistemic state belongs to an idea (0048-noemas FR-012)")
        if st == "superseded" and not relationships_of(g, "supersedes", None, s):
            add("error", a, f"{name} assesses {short(s)} superseded but nothing supersedes it (0048-noemas FR-015)")


def _check_aspect(g: Graph, add, a: Node) -> None:
    name = short(a)
    asp = g.objects(a, ASPECT)
    n = notation(g, asp[0]) if len(asp) == 1 else None
    if n is None or Iri(ASPECT_SCHEME) not in g.objects(asp[0], IN_SCHEME):
        add("error", a, f"{name} must name exactly one aspect of ifcore:AspectScheme (0048-noemas FR-017)")
        return
    label = label_of(g, a)
    if n in ("revision", "retraction") and not g.objects(a, DERIVED):
        add("error", a, f"{name} is a {n} derived from nothing (prov:wasDerivedFrom); what it revises or retracts stays (0048-noemas FR-018)")
    if n == "commercial-hypothesis" and label in ("observation", "evidence"):
        add("error", a, f"{name} is a commercial hypothesis labelled {label}: a guess of demand is not evidence of it (0048-noemas FR-027)")
    if n == "demand-evidence":
        if label not in ("observation", "evidence"):
            add("error", a, f"{name} is demand evidence labelled {label}; it is an observation or evidence, or it is a commercial hypothesis (0048-noemas FR-027)")
        who = g.objects(a, DEMONSTRATED_BY)
        if not who:
            add("error", a, f"{name} is demand evidence from no identifiable {FIRST} (ifcore:demonstratedBy) (0048-noemas FR-027)")
        for w in who:
            kind = subject_kind(g, w)[0] if isinstance(w, Iri) else "a literal"
            if kind != EID_K:
                add("error", a, f"{name}: {short(w)} demonstrates demand but is {kind}, not an {FIRST} (0048-noemas FR-027)")
