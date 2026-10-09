"""Platforms (0049-platforms): what must be true of a made system before it is called a platform.

A platform is an Ergon that provides the nine capabilities of the kernel, each realized by a named module. This module reads the
records and reports a platform that lacks a capability, a module with no or several layers, a module code that breaks the naming
rule or repeats, a dependency that skips a layer, a runtime dependency on the assurance environment, and a made thing built on
something that is not a platform. Nothing here changes a file or decides for a person; whether a platform is accepted is the review
state of its record (0047-digital-reflections FR-038). Standard library only.
"""
from __future__ import annotations

import re

from .reflections import IFCORE, IN_SCHEME, RDFS, Graph, relationships_of, short
from .turtle import Iri, Lit, Node

PLATFORM, MODULE, SUITE = IFCORE + "Platform", IFCORE + "PlatformModule", IFCORE + "Suite"
ARTIFACT, STATUS = IFCORE + "artifactName", IFCORE + "codeStatus"
CAPABILITY_SCHEME, LAYER_SCHEME = IFCORE + "PlatformCapabilityScheme", IFCORE + "PlatformLayerScheme"
LAYER, CODE, ORDER = IFCORE + "platformLayer", IFCORE + "moduleCode", IFCORE + "layerOrder"
LABEL = RDFS + "label"
KERNEL = ("governed-store", "ontology-model", "integration-seam", "programmatic-interface", "assurance-environment",
          "commitment-ledger", "authoritative-catalog", "extension-contract", "governed-access")
ASSURANCE, ORTHOGONAL = "assurance-environment", "orthogonal"
INTERFACE, FLAVOR_SCHEME, OFFERS = "programmatic-interface", IFCORE + "InterfaceFlavorScheme", IFCORE + "offersInterface"
FLAVORS = ("resource-api", "graph-api", "virtual-sql", "mcp")


def _label(g: Graph, node: Node) -> str:
    for o in g.objects(node, LABEL):
        if isinstance(o, Lit):
            return o.value
    return short(node)


def modules_of(g: Graph, platform: Node) -> list[Node]:
    """The modules that state `partOf` the platform."""
    return [r_from for r in relationships_of(g, "partOf", end=platform) for r_from in g.objects(r, IFCORE + "relationFrom")]


def capabilities_realized(g: Graph, module: Node) -> set[str]:
    """The kernel capabilities a module states it `implements`, by notation."""
    out = set()
    for r in relationships_of(g, "implements", start=module):
        for c in g.objects(r, IFCORE + "relationTo"):
            if isinstance(c, Iri) and Iri(CAPABILITY_SCHEME) in g.objects(c, IN_SCHEME) and (n := g.concept_notation(c)):
                out.add(n)
    return out


def layer_of(g: Graph, module: Node) -> tuple[str | None, int | None]:
    ls = [o for o in g.objects(module, LAYER) if isinstance(o, Iri) and Iri(LAYER_SCHEME) in g.objects(o, IN_SCHEME)]
    if len(ls) != 1:
        return None, None
    order = [int(o.value) for o in g.objects(ls[0], ORDER) if isinstance(o, Lit) and str(o.value).lstrip("-").isdigit()]
    return g.concept_notation(ls[0]), (order[0] if order else None)


def expected_code(platform_label: str, module_label: str) -> str | None:
    """The first letter of the platform's name and the first letters of the two words after it, or None if the name does not follow the rule."""
    if not module_label.startswith(platform_label + " "):
        return None
    words = module_label[len(platform_label):].split()
    if len(words) != 2 or not platform_label:
        return None
    return (platform_label[0] + words[0][0] + words[1][0]).upper()


def _artifact(platform_label: str, module_label: str) -> str | None:
    if not module_label.startswith(platform_label + " "):
        return None
    return "-".join(w.lower() for w in module_label.split())


def conformance(g: Graph, platform: Node) -> dict[str, list[str]]:
    """Per kernel capability, the labels of the modules that realize it (empty when none does)."""
    out: dict[str, list[str]] = {k: [] for k in KERNEL}
    for m in modules_of(g, platform):
        for c in capabilities_realized(g, m):
            if c in out:
                out[c].append(_label(g, m))
    return out


def check(g: Graph, add) -> None:
    """0049-platforms FR-001, FR-002, FR-006 to FR-008, FR-010 to FR-013, FR-039, FR-050."""
    platforms = set(g.members(PLATFORM))
    module_of: dict[Node, Node] = {}
    for p in platforms:
        for m in modules_of(g, p):
            if m in module_of and module_of[m] != p:
                add("error", m, f"{short(m)} is part of two platforms; a module belongs to exactly one (0049-platforms FR-007)")
            module_of[m] = p
        lack = [k for k, ms in conformance(g, p).items() if not ms]
        if lack:
            add("error", p, f"{short(p)} is typed ifcore:Platform but no module of it realizes {', '.join(lack)}: a thing without the whole kernel is a product or a suite, not a platform (0049-platforms FR-001, FR-002)")
    suites = set(g.members(SUITE))
    for s in platforms & suites:
        add("error", s, f"{short(s)} is typed both ifcore:Platform and ifcore:Suite; a subject is one or the other (0049-platforms FR-039)")
    for s in suites:
        members = [r for r in relationships_of(g, "partOf", end=s)]
        if len(members) < 2:
            add("error", s, f"{short(s)} is a suite with {len(members)} member(s); a suite has at least two products, each related by partOf (0049-platforms FR-039)")
        for m in g.members(MODULE):
            if any(s in g.objects(r, IFCORE + "relationTo") for r in relationships_of(g, "partOf", start=m)):
                add("error", m, f"{short(m)} is a module of the suite {short(s)}; a suite has no modules (0049-platforms FR-039)")
    for r in relationships_of(g, "partOf"):
        for frm in g.objects(r, IFCORE + "relationFrom"):
            for to in g.objects(r, IFCORE + "relationTo"):
                if to in suites and MODULE not in g.all_types(frm):
                    continue
                if MODULE in g.all_types(frm) and to not in platforms:
                    add("error", r, f"{short(frm)} is a platform module but is part of {short(to)}, which is not typed ifcore:Platform (0049-platforms FR-007)")
    for r in relationships_of(g, "builtOn"):
        for to in g.objects(r, IFCORE + "relationTo"):
            if to in suites:
                add("error", r, f"builtOn names the suite {short(to)}; nothing is built on a suite as a whole (0049-platforms FR-039)")
            elif to not in platforms:
                add("error", r, f"builtOn names {short(to)}, which is not typed ifcore:Platform; a made thing is built on a platform that has the whole kernel, or it integrates with a system (0049-platforms FR-006)")
    for m in g.members(MODULE):
        if INTERFACE in capabilities_realized(g, m):
            offered = {g.concept_notation(o) for o in g.objects(m, OFFERS) if isinstance(o, Iri) and Iri(FLAVOR_SCHEME) in g.objects(o, IN_SCHEME)}
            missing = [f for f in FLAVORS if f not in offered]
            if missing:
                add("error", m, f"{short(m)} realizes the programmatic interface but does not offer {', '.join(missing)}; a platform offers all four flavors (0049-platforms FR-050)")
    codes: dict[tuple[Node, str], Node] = {}
    for m in g.members(MODULE):
        layer, order = layer_of(g, m)
        if layer is None:
            add("error", m, f"{short(m)} must name exactly one layer of ifcore:PlatformLayerScheme with ifcore:platformLayer (0049-platforms FR-007)")
        if layer not in (None, ORTHOGONAL) and order is None:
            add("error", m, f"the layer {layer!r} of {short(m)} has no ifcore:layerOrder (0049-platforms FR-008)")
        p = module_of.get(m)
        code = [o.value for o in g.objects(m, CODE) if isinstance(o, Lit)]
        if p is None:
            if capabilities_realized(g, m):
                add("warning", m, f"{short(m)} realizes a kernel capability but is part of no platform (0049-platforms FR-007)")
            continue
        if len(code) != 1 or not re.fullmatch(r"[A-Z]{3}", code[0]):
            add("error", m, f"{short(m)} must carry one ifcore:moduleCode of three capital letters (0049-platforms FR-012)")
            continue
        want = expected_code(_label(g, p), _label(g, m))
        if want is None:
            add("error", m, f"the name {_label(g, m)!r} must be the platform's name {_label(g, p)!r} followed by two plain words (0049-platforms FR-011)")
        elif want != code[0]:
            add("error", m, f"the code {code[0]} of {_label(g, m)!r} must be {want}: the platform's first letter and the first letters of the two words (0049-platforms FR-012)")
        art = [o.value for o in g.objects(m, ARTIFACT) if isinstance(o, Lit)]
        wantart = _artifact(_label(g, p), _label(g, m))
        if len(art) != 1 or (wantart and art[0] != wantart):
            add("error", m, f"{short(m)} must carry one ifcore:artifactName, {wantart!r}: the platform's name and the module's full name in lowercase words joined by hyphens, never the code (0049-platforms FR-013)")
        st = [o.value for o in g.objects(m, STATUS) if isinstance(o, Lit)]
        if st not in (["confirmed"], ["proposed"]):
            add("error", m, f"{short(m)} must state ifcore:codeStatus as confirmed or proposed (0049-platforms FR-012)")
        if (p, code[0]) in codes and codes[(p, code[0])] != m:
            add("error", m, f"the code {code[0]} is also the code of {short(codes[(p, code[0])])}; a code is unique within its platform (0049-platforms FR-012)")
        codes[(p, code[0])] = m
    for r in relationships_of(g, "dependsOn"):
        for a in g.objects(r, IFCORE + "relationFrom"):
            for b in g.objects(r, IFCORE + "relationTo"):
                if a not in module_of or module_of.get(b) != module_of[a]:
                    continue
                if ASSURANCE in capabilities_realized(g, b):
                    add("error", r, f"{short(a)} depends on {short(b)}, the assurance environment; no module depends on it at runtime (0049-platforms FR-010)")
                    continue
                (la, oa), (lb, ob) = layer_of(g, a), layer_of(g, b)
                if None in (la, lb, oa, ob):
                    continue
                if oa is None or ob is None or la == ORTHOGONAL or lb == ORTHOGONAL:
                    continue
                if ob not in (oa, oa - 1):
                    add("error", r, f"{short(a)} (layer {la}) depends on {short(b)} (layer {lb}): a module depends only on its own layer or the one directly below it (0049-platforms FR-008)")
