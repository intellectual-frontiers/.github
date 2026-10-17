#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.1.4"]
# ///
"""Generate the role and permission table from the identity ontology (commons 0005-identity-and-roles).

    uv run commons/tools/generate-identity.py            write commons/generated/identity.auto.toml
    uv run commons/tools/generate-identity.py --check    exit 1, writing nothing, where the file is not what the ontology makes

The ontology (commons/ontology/identity/*.ttl) is the source; the table is never edited by hand. The ontology is checked first: a rule it breaks (FR-004, FR-005, FR-018) stops the run
with every finding named.
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

from rdflib import RDF, RDFS, Graph, Literal, Namespace, URIRef
from rdflib.namespace import DCTERMS, OWL, SKOS

COMMONS = Path(__file__).resolve().parent.parent
ONTOLOGY = COMMONS / "ontology" / "identity"
OUT = COMMONS / "generated" / "identity.auto.toml"
IDN = Namespace("https://www.intellectualfrontiers.com/ontology/identity#")
SCHEMA_VERSION = 1
ROLE_ID = re.compile(r"^[a-z]+(-[a-z]+)*$")
SLUG = re.compile(r"^[a-z0-9][a-z0-9:.-]*$")
KINDS = ("visitor", "member", "staff")
DEPTHS = ("answer", "reader", "own", "connect", "team")


def load() -> tuple[Graph, str]:
    g = Graph()
    digest = hashlib.sha256()
    for f in sorted(ONTOLOGY.glob("*.ttl")):
        data = f.read_bytes()
        digest.update(f.name.encode() + b"\0" + data)
        g.parse(data=data, format="turtle")
    return g, digest.hexdigest()


def one(g: Graph, s: URIRef, p: URIRef) -> str | None:
    vals = sorted(str(o) for o in g.objects(s, p))
    return vals[0] if vals else None


def model(g: Graph) -> tuple[dict, list[str]]:
    """The whole table, and every rule of the ontology it breaks."""
    bad: list[str] = []
    for kind in (OWL.Class, OWL.DatatypeProperty, OWL.ObjectProperty):
        for term in sorted(g.subjects(RDF.type, kind)):
            if str(term).startswith(str(IDN)) and not one(g, term, SKOS.definition):
                bad.append(f"the term {str(term)[len(str(IDN)):]} has no definition")
    kinds = {s: one(g, s, SKOS.notation) for s in g.subjects(RDF.type, IDN.RoleKind)}
    permissions: dict[str, dict] = {}
    perm_iri: dict[URIRef, str] = {}
    for p in sorted(g.subjects(RDF.type, IDN.Permission)):
        slug = one(g, p, IDN.slug) or ""
        if not SLUG.match(slug) or len(slug) > 40:
            bad.append(f"the permission slug {slug!r} must be lower-case letters, digits and - : . at most 40 characters")
        if slug in permissions:
            bad.append(f"two permissions have the slug {slug}")
        if not one(g, p, RDFS.label) or not one(g, p, SKOS.definition):
            bad.append(f"the permission {slug} needs a label and a definition")
        perm_iri[p] = slug
        permissions[slug] = {"label": one(g, p, RDFS.label) or "", "definition": one(g, p, SKOS.definition) or ""}
    roles: dict[str, dict] = {}
    granted: set[str] = set()
    for r in sorted(g.subjects(RDF.type, IDN.Role)):
        rid = one(g, r, DCTERMS.identifier) or ""
        if not ROLE_ID.match(rid) or len(rid) > 32:
            bad.append(f"the role identifier {rid!r} must be lower-case words joined by hyphens, at most 32 characters")
        if rid in roles:
            bad.append(f"two roles are called {rid}")
        kind_iris = list(g.objects(r, IDN.roleKind))
        kind = kinds.get(kind_iris[0]) if len(kind_iris) == 1 else None
        if kind not in KINDS:
            bad.append(f"the role {rid} must have exactly one kind of {', '.join(KINDS)}")
        if not one(g, r, RDFS.label) or not one(g, r, SKOS.definition):
            bad.append(f"the role {rid} needs a label and a definition")
        grants: list[str] = []
        for p in g.objects(r, IDN.grants):
            if p not in perm_iri:
                bad.append(f"the role {rid} grants {p}, which is not a defined permission")
            else:
                grants.append(perm_iri[p])
        if not grants:
            bad.append(f"the role {rid} grants no permission")
        granted.update(grants)
        roles[rid] = {"label": one(g, r, RDFS.label) or "", "kind": kind or "", "definition": one(g, r, SKOS.definition) or "", "grants": sorted(grants),
                      "publishing": one(g, r, IDN.knownInPublishingAs) or "", "research": one(g, r, IDN.knownInResearchAs) or ""}
    for slug in sorted(set(permissions) - granted):
        bad.append(f"the permission {slug} is granted by no role")
    depth: dict[str, dict] = {}
    for d in sorted(g.subjects(RDF.type, IDN.DepthLevel)):
        name = one(g, d, SKOS.notation) or ""
        order = one(g, d, IDN.depthOrder)
        if not one(g, d, SKOS.definition):
            bad.append(f"the depth level {name} has no definition")
        depth[name] = {"order": int(order) if order and order.isdigit() else 0, "definition": one(g, d, SKOS.definition) or ""}
    if sorted(depth, key=lambda n: depth[n]["order"]) != list(DEPTHS) or [depth[n]["order"] for n in DEPTHS if n in depth] != list(range(1, len(DEPTHS) + 1)):
        bad.append(f"the depth levels must be {', '.join(DEPTHS)}, numbered 1 to {len(DEPTHS)} in that order")
    return {"roles": roles, "permissions": permissions, "depth": depth}, bad


def q(s: str) -> str:
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def toml(t: dict, digest: str) -> str:
    out = ["# AUTO-GENERATED by commons/tools/generate-identity.py from commons/ontology/identity/ (commons 0005-identity-and-roles FR-023). Do not edit: change the ontology.",
           f"schema = {SCHEMA_VERSION}", f"source_sha256 = {q(digest)}", ""]
    for slug, p in sorted(t["permissions"].items()):
        out += [f"[permissions.{q(slug)}]", f"label = {q(p['label'])}", f"definition = {q(p['definition'])}", ""]
    for rid, r in sorted(t["roles"].items()):
        out += [f"[roles.{rid}]", f"label = {q(r['label'])}", f"kind = {q(r['kind'])}", f"definition = {q(r['definition'])}",
                "grants = [" + ", ".join(q(x) for x in r["grants"]) + "]"]
        if r["publishing"]:
            out.append(f"publishing = {q(r['publishing'])}")
        if r["research"]:
            out.append(f"research = {q(r['research'])}")
        out.append("")
    for name in DEPTHS:
        d = t["depth"][name]
        out += [f"[depth.{name}]", f"order = {d['order']}", f"definition = {q(d['definition'])}", ""]
    return "\n".join(out).rstrip("\n") + "\n"


def main(argv: list[str]) -> int:
    g, digest = load()
    t, bad = model(g)
    if bad:
        print("the identity ontology breaks its own rules:", file=sys.stderr)
        for b in bad:
            print(f"  - {b}", file=sys.stderr)
        return 2
    text = toml(t, digest)
    if "--check" in argv:
        if not OUT.exists() or OUT.read_text() != text:
            print(f"{OUT.relative_to(COMMONS.parent)} is not what the ontology makes; run: uv run commons/tools/generate-identity.py", file=sys.stderr)
            return 1
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)
    print(f"wrote {OUT.relative_to(COMMONS.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
