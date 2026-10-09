"""The vocabulary audit's scan (0019-controlled-vocabulary FR-007, FR-008): every class, property, concept scheme and concept
that the ontologies of one or more repositories declare in the company's own namespaces, and whether each is tied to an
established vocabulary or to a Decision that justifies it.

A term is `reused` when it specializes, or is declared to match, a term of an established vocabulary, directly or through its
own parents. It is `excepted` when a `Decision` names it by `dcterms:subject` (0019 FR-004); a concept takes its scheme's status. Any other term is
`unmapped`: a candidate for the audit's judgment, never a finding of invention by itself, and never renamed by the scan
(0019 FR-008). Standard library only.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from agora.core.checks import Finding
from . import turtle
from .turtle import Iri, Lit

RDFS = "http://www.w3.org/2000/01/rdf-schema#"
OWL = "http://www.w3.org/2002/07/owl#"
SKOS = "http://www.w3.org/2004/02/skos/core#"
DCT = "http://purl.org/dc/terms/"
OWN = ("https://www.intellectualfrontiers.com/ontology/", "https://physia.com/ontology#")
CORE = "https://www.intellectualfrontiers.com/ontology/core#"

CLASS = {OWL + "Class", RDFS + "Class"}
PROPERTY = {OWL + n for n in ("ObjectProperty", "DatatypeProperty", "AnnotationProperty", "FunctionalProperty")} | {turtle.RDF + "Property"}
SCHEME, CONCEPT = SKOS + "ConceptScheme", SKOS + "Concept"
# The predicates that tie a term to another one it is a kind of, or the same as (0019 FR-001, FR-002).
TIES = tuple(RDFS + p for p in ("subClassOf", "subPropertyOf", "isDefinedBy")) \
    + tuple(OWL + p for p in ("equivalentClass", "equivalentProperty")) \
    + tuple(SKOS + p for p in ("exactMatch", "closeMatch", "broadMatch", "narrowMatch", "broader", "inScheme"))
# Parents so general that specializing one names no established equivalent (0019 FR-001): a term whose only external tie is one
# of these stays unmapped, and says so.
GENERIC = {SKOS + "Concept", SKOS + "ConceptScheme", OWL + "Thing", RDFS + "Resource", "https://schema.org/Thing",
           "http://www.w3.org/ns/prov#Entity", "http://www.w3.org/ns/prov#Activity", "http://www.w3.org/ns/prov#Agent"}
LABELS = (RDFS + "label", SKOS + "prefLabel")
COMMENTS = (SKOS + "definition", RDFS + "comment")
# Ontology files that are not the company's schema: a work's generated concepts (checked by `eid check terms`), the work
# records, and SHACL shapes.
SKIP_DIRS = ("works", "shapes")
SKIP_SUFFIX = (".concepts.ttl", ".auto.ttl")


@dataclass
class VTerm:
    repo: str
    curie: str
    iri: str
    kind: str          # class, property, scheme, concept
    label: str
    comment: str
    path: str
    line: int
    scheme: str
    status: str = "unmapped"   # reused, excepted, unmapped
    via: str = ""              # what ties it: the established term, the Decision, or the parent it inherits from


def ontology_files(root: Path) -> list[Path]:
    base = root / "ontology"
    if not base.is_dir():
        return []
    out = []
    for f in sorted(base.rglob("*.ttl")):
        rel = f.relative_to(base)
        if rel.parts[0] in SKIP_DIRS or f.name.endswith(SKIP_SUFFIX):
            continue
        out.append(f)
    return out


def scan(roots: dict[str, Path]) -> list[VTerm]:
    """`roots` maps a repository name to its root. Terms are resolved across all of them, because the vault's ontology builds on the
    public root's."""
    prefixes: dict[str, str] = {}
    triples: list[tuple[Any, str, Any, int, str, str]] = []
    for repo, root in roots.items():
        for f in ontology_files(root):
            pre, tr = turtle.parse(f.read_text(encoding="utf-8"))
            prefixes.update(pre)
            rel = str(f.relative_to(root))
            triples += [(s, p, o, ln, repo, rel) for s, p, o, ln in tr]

    def curie(iri: str) -> str:
        best = ""
        for pre, ns in prefixes.items():
            if iri.startswith(ns) and len(ns) > len(prefixes.get(best, "")) and re.fullmatch(r"[\w.-]*", iri[len(ns):]):
                best = pre
        return f"{best}:{iri[len(prefixes[best]):]}" if best else iri

    by_subject: dict[str, list[tuple[str, Any, int, str, str]]] = {}
    for s, p, o, ln, repo, rel in triples:
        if isinstance(s, Iri):
            by_subject.setdefault(s.value, []).append((p, o, ln, repo, rel))
    decisions: dict[str, str] = {}        # term IRI -> the Decision that names it
    for iri, stmts in by_subject.items():
        types = {o.value for p, o, *_ in stmts if p == turtle.RDF_TYPE and isinstance(o, Iri)}
        if CORE + "Decision" in types:
            for p, o, *_ in stmts:
                if p == DCT + "subject" and isinstance(o, Iri):
                    decisions.setdefault(o.value, iri)

    terms: dict[str, VTerm] = {}
    ties: dict[str, list[str]] = {}
    for iri, stmts in by_subject.items():
        if not iri.startswith(OWN):
            continue
        types = {o.value for p, o, *_ in stmts if p == turtle.RDF_TYPE and isinstance(o, Iri)}
        kind = "class" if types & CLASS else "property" if types & PROPERTY else "scheme" if SCHEME in types or CORE + "ControlCatalog" in types \
            else "concept" if CONCEPT in types else ""
        if not kind:
            continue

        def lit(preds: tuple[str, ...]) -> str:
            for want in preds:
                for p, o, *_ in stmts:
                    if p == want and isinstance(o, Lit):
                        return o.value
            return ""
        scheme = next((o.value for p, o, *_ in stmts if p == SKOS + "inScheme" and isinstance(o, Iri)), "")
        terms[iri] = VTerm(stmts[0][3], curie(iri), iri, kind, lit(LABELS) or re.split(r"[#/]", iri)[-1], " ".join(lit(COMMENTS).split()),
                           stmts[0][4], min(ln for _, _, ln, _, _ in stmts), curie(scheme) if scheme else "")
        ties[iri] = [(p, o.value) for p, o, *_ in stmts if p in TIES and isinstance(o, Iri)]

    state: dict[str, tuple[str, str]] = {}

    def resolve(iri: str, seen: frozenset = frozenset()) -> tuple[str, str]:
        """An external tie makes a term `reused`. A term inherits from its own parent only a `reused` status: a new term under a parent that
        a Decision excepted is a new term. A concept inherits its scheme's status, whichever it is, because the scheme is the term the
        Decision judged."""
        if iri in state:
            return state[iri]
        res = ("unmapped", "")
        generic = [t for _, t in ties.get(iri, []) if t in GENERIC]
        for _, t in ties.get(iri, []):
            if not t.startswith(OWN) and t not in GENERIC:
                res = ("reused", curie(t))
                break
        else:
            for p, t in ties.get(iri, []):
                if t in terms and t not in seen:
                    sub = resolve(t, seen | {iri})
                    if sub[0] == "reused" or (p == SKOS + "inScheme" and sub[0] != "unmapped"):
                        res = (sub[0], curie(t))
                        break
        if res[0] == "unmapped" and iri in decisions:
            res = ("excepted", curie(decisions[iri]))
        if res[0] == "unmapped" and generic:
            res = ("unmapped", "only a generic parent: " + ", ".join(curie(t) for t in generic))
        state[iri] = res
        return res

    for iri, t in terms.items():
        t.status, t.via = resolve(iri)
    return sorted(terms.values(), key=lambda t: (t.kind, t.curie))


def summary(terms: list[VTerm]) -> dict[str, Any]:
    out: dict[str, Any] = {"terms": len(terms)}
    for st in ("reused", "excepted", "unmapped"):
        out[st] = sum(t.status == st for t in terms)
    out["by kind"] = {k: {st: sum(1 for t in terms if t.kind == k and t.status == st) for st in ("reused", "excepted", "unmapped")}
                      for k in ("class", "property", "scheme", "concept")}
    return out


def rows(terms: list[VTerm], status: str | None = None) -> list[dict[str, Any]]:
    return [{"repository": t.repo, "term": t.curie, "kind": t.kind, "label": t.label, "status": t.status, "via": t.via, "scheme": t.scheme,
             "definition": t.comment[:300], "where": f"{t.path}:{t.line}"} for t in terms if not status or t.status == status]


def findings(terms: list[VTerm]) -> list[Finding]:
    """One warning per ontology file with unmapped classes, properties or schemes (0019 FR-007); `--json` lists each term. A report,
    never a gate: the audit judges (FR-008)."""
    by_file: dict[str, list[VTerm]] = {}
    for t in terms:
        if t.status == "unmapped" and t.kind != "concept":
            by_file.setdefault(t.path, []).append(t)
    return [Finding("warning", path, f"{len(ts)} classes, properties and schemes name neither an established term nor a Decision, "
                    f"for example {', '.join(t.curie for t in ts[:3])} (0019-controlled-vocabulary FR-009)") for path, ts in sorted(by_file.items())]
