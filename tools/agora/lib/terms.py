"""The ontology's terms for `ontology list` and `ontology show` (0042-agora FR-037): every class, property, individual, concept
scheme and concept of `ontology/ifcore.ttl` and `ontology/ifweb.ttl`, read with the Turtle reader (turtle.py), searched and
ranked, and the requirements that cite each. Standard library only. The JSON shape is shared with every orchestrator that shows
an ontology, so that the editor draws them alike.
"""
from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import specs, turtle
from .turtle import Blank, Iri, Lit

FILES = ("ontology/ifcore.ttl", "ontology/ifweb.ttl")
OWN_PREFIXES = ("ifcore", "ifweb")
WELL_KNOWN = {"rdf": turtle.RDF, "rdfs": "http://www.w3.org/2000/01/rdf-schema#", "owl": "http://www.w3.org/2002/07/owl#",
              "skos": "http://www.w3.org/2004/02/skos/core#", "xsd": turtle.XSD, "dcterms": "http://purl.org/dc/terms/",
              "prov": "http://www.w3.org/ns/prov#", "schema": "https://schema.org/", "sh": "http://www.w3.org/ns/shacl#"}
RDFS, OWL, SKOS = WELL_KNOWN["rdfs"], WELL_KNOWN["owl"], WELL_KNOWN["skos"]
DCT = WELL_KNOWN["dcterms"]

KINDS = ("class", "property", "scheme", "concept", "individual")
KIND_ICON = {"class": "symbol-class", "property": "symbol-property", "scheme": "symbol-enum", "concept": "symbol-enum-member",
             "individual": "symbol-constant"}
CLASS_TYPES = {OWL + "Class", RDFS + "Class"}
PROPERTY_TYPES = {OWL + n for n in ("ObjectProperty", "DatatypeProperty", "AnnotationProperty", "FunctionalProperty", "TransitiveProperty",
                                    "SymmetricProperty", "InverseFunctionalProperty")} | {turtle.RDF + "Property"}
SCHEME_TYPES = {SKOS + "ConceptScheme"}
CONCEPT_TYPES = {SKOS + "Concept"}
LABELS = (RDFS + "label", SKOS + "prefLabel", DCT + "title")
COMMENTS = (RDFS + "comment", SKOS + "definition")
LISTED = 200   # the most rows a table of `show` carries; the count says how many there are


@dataclass
class Term:
    iri: str
    curie: str
    kind: str
    label: str
    comment: str
    notation: str
    scheme: str
    types: list[str]
    audience: str
    path: str
    line: int
    statements: list[tuple[str, Any]] = field(default_factory=list)   # (predicate IRI, object node)

    @property
    def summary(self) -> str:
        return summary_of(self.comment)


def summary_of(comment: str, limit: int = 220) -> str:
    text = " ".join(comment.split())
    cut = len(text)
    for m in re.finditer(r"[.!?](?=\s+[A-Z(`])", text):
        if text[max(0, m.start() - 3):m.start()].lower() in ("e.g", "i.e") or text[max(0, m.start() - 2):m.start()].lower() in ("fr", "sc"):
            continue
        cut = m.start() + 1
        break
    first = text[:cut]
    return first if len(first) <= limit else first[:limit - 1].rstrip() + "…"


class Ontology:
    def __init__(self, root: Path, files: tuple[str, ...] = FILES) -> None:
        self.root = root
        self.prefixes: dict[str, str] = dict(WELL_KNOWN)
        self.triples: list[tuple[Any, str, Any, int, str]] = []
        for rel in files:
            f = root / rel
            if not f.is_file():
                continue
            pre, tr = turtle.parse(f.read_text(encoding="utf-8"))
            self.prefixes.update(pre)
            self.triples += [(s, p, o, ln, rel) for s, p, o, ln in tr]
        self.own = tuple(self.prefixes[p] for p in OWN_PREFIXES if p in self.prefixes)
        self.terms: dict[str, Term] = {}
        self._build()
        self.by_curie = {t.curie: t for t in self.terms.values()}
        self._index()

    # -- names
    def curie(self, iri: str) -> str:
        best = ""
        for pre, ns in self.prefixes.items():
            if iri.startswith(ns) and len(ns) > len(self.prefixes.get(best, "")) and re.fullmatch(r"[\w.-]*", iri[len(ns):]):
                best = pre
        return f"{best}:{iri[len(self.prefixes[best]):]}" if best else iri

    def resolve(self, value: str) -> Term | None:
        if value in self.by_curie:
            return self.by_curie[value]
        return self.terms.get(value)

    def nearest(self, value: str, n: int = 5) -> list[str]:
        local = value.rsplit(":", 1)[-1].rsplit("/", 1)[-1].rsplit("#", 1)[-1]
        names = sorted(self.by_curie)
        close = difflib.get_close_matches(value, names, n=n, cutoff=0.6)
        by_local = [c for c in names if c.rsplit(":", 1)[-1].lower() == local.lower()]
        return list(dict.fromkeys(by_local + close))[:n]

    # -- building
    def _build(self) -> None:
        by_subject: dict[str, list[tuple[str, Any, int, str]]] = {}
        for s, p, o, ln, rel in self.triples:
            if isinstance(s, Iri) and s.value.startswith(self.own):
                by_subject.setdefault(s.value, []).append((p, o, ln, rel))
        for iri, stmts in by_subject.items():
            types = [o.value for p, o, _, _ in stmts if p == turtle.RDF_TYPE and isinstance(o, Iri)]
            tset = set(types)
            if tset & CLASS_TYPES:
                kind = "class"
            elif tset & PROPERTY_TYPES:
                kind = "property"
            elif tset & SCHEME_TYPES or self.own[0] + "ControlCatalog" in tset:
                kind = "scheme"
            elif tset & CONCEPT_TYPES:
                kind = "concept"
            elif tset - {OWL + "Ontology"} and OWL + "Ontology" not in tset:
                kind = "individual"
            else:
                continue

            def first(preds: tuple[str, ...]) -> str:
                for want in preds:
                    for p, o, _, _ in stmts:
                        if p == want and isinstance(o, Lit):
                            return o.value
                return ""

            def ref(pred: str) -> str:
                for p, o, _, _ in stmts:
                    if p == pred and isinstance(o, Iri):
                        return o.value
                return ""
            local = re.split(r"[#/]", iri)[-1]
            scheme = ref(SKOS + "inScheme")
            audience = ref(self.own[0] + "hasAudience") if self.own else ""
            self.terms[iri] = Term(iri, self.curie(iri), kind, first(LABELS) or local, first(COMMENTS), first((SKOS + "notation",)),
                                   self.curie(scheme) if scheme else "", [self.curie(t) for t in types], self.curie(audience).rsplit(":", 1)[-1] if audience else "",
                                   stmts[0][3], min(ln for _, _, ln, _ in stmts), [(p, o) for p, o, _, _ in stmts])

    def _index(self) -> None:
        self.incoming: dict[str, list[tuple[str, str]]] = {}      # object IRI -> (subject IRI, predicate)
        self.outgoing: dict[str, dict[str, list[str]]] = {}       # predicate IRI -> subject IRI -> object IRIs
        for s, p, o, _, _ in self.triples:
            if isinstance(s, Iri) and isinstance(o, Iri):
                self.incoming.setdefault(o.value, []).append((s.value, p))
                self.outgoing.setdefault(p, {}).setdefault(s.value, []).append(o.value)

    def objects(self, iri: str, pred: str) -> list[str]:
        return self.outgoing.get(pred, {}).get(iri, [])

    def subjects(self, iri: str, pred: str) -> list[str]:
        return [s for s, p in self.incoming.get(iri, []) if p == pred]

    # -- the rows of `list`
    def row(self, t: Term) -> dict[str, Any]:
        return {"curie": t.curie, "iri": t.iri, "label": t.label, "kind": t.kind, "icon": KIND_ICON[t.kind], "summary": t.summary,
                "scheme": t.scheme, "notation": t.notation, "type": ", ".join(t.types)}

    def listing(self, kind: str | None, scheme: str | None, match: str | None) -> list[dict[str, Any]]:
        pool = [t for t in self.terms.values() if (not kind or t.kind == kind) and (not scheme or t.scheme == scheme)]
        order = {k: i for i, k in enumerate(KINDS)}
        if not match or not match.strip():
            return [self.row(t) for t in sorted(pool, key=lambda t: (order[t.kind], t.label.lower(), t.curie))]
        scored = [(rank(t, match), t) for t in pool]
        return [self.row(t) for r, t in sorted(((r, t) for r, t in scored if r), key=lambda x: (-x[0], order[x[1].kind], x[1].label.lower(), x[1].curie))]

    # -- the resource of `show`
    def show(self, t: Term, citing: list[dict[str, Any]]) -> tuple[dict[str, Any], list[tuple[str, str, str]]]:
        """(data, links): a link is (rel, curie, "ontology") or (rel, requirement, "requirement")."""
        links: list[tuple[str, str, str]] = []

        def rows_of(iris: list[str], rel: str) -> list[dict[str, Any]]:
            out = []
            for i in sorted(set(iris), key=lambda i: (self.terms[i].label.lower() if i in self.terms else i)):
                row = {"curie": self.curie(i)}
                if i in self.terms:
                    other = self.terms[i]
                    row.update({"label": other.label, "kind": other.kind})
                    links.append((rel, other.curie, "ontology"))
                out.append(row)
            return out

        def curies(iris: list[str], rel: str) -> list[str]:
            for i in iris:
                if i in self.terms:
                    links.append((rel, self.terms[i].curie, "ontology"))
            return sorted({self.curie(i) for i in iris})

        data: dict[str, Any] = {"curie": t.curie, "iri": t.iri, "label": t.label, "kind": t.kind, "icon": KIND_ICON[t.kind],
                                "summary": t.summary, "types": t.types, "audience": t.audience, "scheme": t.scheme, "notation": t.notation,
                                "path": t.path, "line": t.line}
        if t.comment and t.comment != t.summary and " ".join(t.comment.split()) != t.summary:
            data["comment"] = t.comment
        if t.scheme and t.scheme in self.by_curie:
            links.append(("scheme", t.scheme, "ontology"))
        sub = RDFS + "subClassOf"
        subp = RDFS + "subPropertyOf"
        if t.kind == "class":
            data["superclasses"] = curies(self.objects(t.iri, sub), "superclass")
            data["subclasses"] = rows_of(self.subjects(t.iri, sub), "subclass")
            data["properties"] = rows_of(self.subjects(t.iri, RDFS + "domain"), "property")
            inst = [s for s in self.subjects(t.iri, turtle.RDF_TYPE) if s in self.terms]
            data["individual_count"] = len(inst)
            data["individuals"] = rows_of(inst[:LISTED], "individual")
        elif t.kind == "property":
            data["domain"] = curies(self.objects(t.iri, RDFS + "domain"), "domain")
            data["range"] = curies(self.objects(t.iri, RDFS + "range"), "range")
            data["superproperties"] = curies(self.objects(t.iri, subp), "superproperty")
            data["subproperties"] = rows_of(self.subjects(t.iri, subp), "subproperty")
        elif t.kind == "scheme":
            members = self.subjects(t.iri, SKOS + "inScheme")
            data["member_count"] = len(members)
            data["members"] = rows_of(members[:LISTED], "member")
        data["statements"] = []
        first = {turtle.RDF_TYPE: 0, RDFS + "label": 1, SKOS + "prefLabel": 1, RDFS + "comment": 2, SKOS + "definition": 2}
        for p, o in sorted(t.statements, key=lambda po: (first.get(po[0], 3), po[0], getattr(po[1], "value", ""))):   # the order every orchestrator gives
            if isinstance(o, Iri):
                target = self.terms.get(o.value)
                data["statements"].append({"predicate": self.curie(p), "object": self.curie(o.value), "kind": "term" if target else "iri"})
                if target:
                    links.append(("object", target.curie, "ontology"))
            elif isinstance(o, Lit):
                text = o.value if len(o.value) <= 300 else o.value[:299] + "…"
                data["statements"].append({"predicate": self.curie(p), "object": text, "kind": "literal"})
            else:
                data["statements"].append({"predicate": self.curie(p), "object": "[…]", "kind": "literal"})
        skip = {turtle.RDF_TYPE, sub, subp, SKOS + "inScheme", RDFS + "domain"}
        seen: set[tuple[str, str]] = set()
        ref: list[dict[str, Any]] = []
        for s, p in self.incoming.get(t.iri, []):
            if p in skip or s == t.iri or s not in self.terms or (s, p) in seen:
                continue
            seen.add((s, p))
            other = self.terms[s]
            ref.append({"curie": other.curie, "label": other.label, "kind": other.kind, "predicate": self.curie(p)})
            links.append(("referenced by", other.curie, "ontology"))
        ref.sort(key=lambda r: (r["predicate"], r["label"].lower()))
        data["referenced_count"] = len(ref)
        data["referenced_by"] = ref[:LISTED]
        data["specs_count"] = len(citing)
        data["specs"] = citing[:LISTED // 2]
        for key in [k for k, v in data.items() if v == [] and k != "specs"]:
            del data[key]   # a relation the term has none of is not said
        for c in citing:
            links.append(("requirement", c["requirement"], "requirement"))
        return data, links


_CACHE: dict[tuple, "Ontology"] = {}


def load(root: Path) -> Ontology:
    """The ontology under `root`, read once for as long as its files stay as they are."""
    sig = (str(root), *((f, (root / f).stat().st_mtime_ns) for f in FILES if (root / f).is_file()))
    if sig not in _CACHE:
        _CACHE.clear()
        _CACHE[sig] = Ontology(root)
    return _CACHE[sig]


# -- ranking ---------------------------------------------------------------------------------------------------------
def rank(t: Term, text: str) -> int:
    """How well a term matches the text, without regard to case: 0 is no match; an exact CURIE or local name ranks first, then an
    exact label, then a CURIE or label starting with the text, then one holding it, then the notation and IRI, then the comment; a term
    holding every word of the text in some field comes last (0042 FR-037)."""
    q = " ".join(text.lower().split())
    local = t.curie.rsplit(":", 1)[-1].lower()
    curie, label, comment, notation, iri = t.curie.lower(), t.label.lower(), t.comment.lower(), t.notation.lower(), t.iri.lower()
    if q in (curie, local, iri):
        return 100
    if q == label:
        return 90
    if curie.startswith(q) or local.startswith(q):
        return 80
    if label.startswith(q):
        return 75
    if re.search(rf"\b{re.escape(q)}", label):
        return 65
    if q in label:
        return 60
    if q in curie:
        return 55
    if q == notation:
        return 50
    if q in notation or q in iri:
        return 45
    if q in comment:
        return 30
    words = q.split()
    if len(words) > 1 and all(w in " ".join((curie, label, comment, notation)) for w in words):
        return 10
    return 0


# -- the requirements that cite a term -------------------------------------------------------------------------------------
BACKTICK = re.compile(r"`([^`]+)`")
CITED = re.compile(r"\b(\d{4}(?:-[a-z0-9-]+)?) (FR-\d{3})\b")
TEXT_LEN = 200


def _excerpt(text: str) -> str:
    text = text.replace("`", "")   # a table cell is plain words
    return text if len(text) <= TEXT_LEN else text[:TEXT_LEN - 1].rstrip() + "…"


def citations(root: Path, onto: Ontology, term: Term) -> list[dict[str, Any]]:
    """The requirements, of every spec under `root`, that name the term in backticks (its CURIE, its IRI or its label) or that its own
    comment cites."""
    wanted = {term.curie, term.iri, term.label.lower()}
    wanted.discard("")
    out: dict[str, dict[str, Any]] = {}
    all_specs = specs.find_specs(root)
    for s in all_specs:
        for ident, text in s.requirements():
            for m in BACKTICK.finditer(text):
                tok = m.group(1).strip()
                if tok in wanted or tok.lower() in wanted:
                    out[f"{s.name}/{ident}"] = {"requirement": f"{s.name}/{ident}", "how": "names it", "text": _excerpt(text)}
                    break
    defined = {s.name: s for s in all_specs}
    for m in CITED.finditer(term.comment):
        s = next((x for n, x in defined.items() if n == m.group(1) or n.startswith(m.group(1) + "-")), None)
        if s is None:
            continue
        reqs = dict(s.requirements())
        key = f"{s.name}/{m.group(2)}"
        if m.group(2) in reqs and key not in out:
            out[key] = {"requirement": key, "how": "defines it", "text": _excerpt(reqs[m.group(2)])}
    return sorted(out.values(), key=lambda r: (r["how"] != "defines it", r["requirement"]))
