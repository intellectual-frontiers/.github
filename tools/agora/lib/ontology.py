"""The ontology's checks (0001-eidolon-architecture FR-007; 0014-design-systems FR-003, FR-010, FR-020, FR-022,
FR-032 to FR-052) and a reader for its SKOS concepts and command individuals.

Ported from the public root's former spec checker, with the same findings and messages.
"""
from __future__ import annotations

import re
from pathlib import Path

from agora.core.checks import Finding
from .names import names

DS_IDENTIFIER = re.compile(r"^ifcore:\w+ a ifcore:DesignSystem ;\s*\n\s*dcterms:identifier \"([^\"]+)\"", re.M)


def check_design_systems(root: Path, public: Path) -> list[Finding]:
    """0014-design-systems FR-003, FR-010 and FR-022: each design system's slug ends with a kind code, it is
    registered in ifcore.ttl by that slug (and nothing registered is missing), and it has a spec."""
    findings: list[Finding] = []
    n = names(public)
    ds = root / "design-systems"
    if not ds.is_dir():
        return findings
    ttl = root / "ontology" / "ifcore.ttl"
    registered = set(DS_IDENTIFIER.findall(ttl.read_text(encoding="utf-8"))) if ttl.is_file() else set()
    dirs = {p.name for p in ds.iterdir() if p.is_dir()}
    for slug in sorted(registered - dirs):
        findings.append(Finding("error", "ontology/ifcore.ttl", f"design system {slug} is registered but design-systems/{slug}/ does not exist (0014-design-systems FR-010)"))
    findings += _check_web_classification(ttl.read_text(encoding="utf-8") if ttl.is_file() else "")
    findings += _check_derivation(ttl.read_text(encoding="utf-8") if ttl.is_file() else "")
    for d in sorted(p for p in ds.iterdir() if p.is_dir()):
        if d.name not in registered:
            findings.append(Finding("error", str(d.relative_to(root)), "is not registered in ifcore.ttl as an ifcore:DesignSystem with this dcterms:identifier (0014-design-systems FR-010)"))
        rel = str(d.relative_to(root))
        if not (n.ds_dir and n.ds_dir.match(d.name)):
            findings.append(Finding("error", rel, f"design system slug must end with its kind's code, one of {list(n.codes)} (0014-design-systems FR-003)"))
        if not (d / "spec.md").is_file():
            findings.append(Finding("warning", rel, "has no spec.md stating its house rules (0014-design-systems FR-022)"))
    return findings




def _concepts(ttl: str, scheme: str) -> set[str]:
    """Local names of the skos:Concepts in `scheme`."""
    return set(re.findall(rf"^ifcore:(\w+) a skos:Concept ; skos:inScheme ifcore:{scheme}\b", ttl, re.M))


def _check_web_classification(ttl: str) -> list[Finding]:
    """0014-design-systems FR-041, FR-042 and FR-046: every web design system names one or more interaction models, exactly
    one expression and one or more densities, every print design system one or more print document types, and every
    merchandise design system one or more decoration methods and product categories, every figure design system
    one or more figure types, by dcterms:type; and every web and print design system names its figure design system
    (FR-048)."""
    findings: list[Finding] = []
    models, expressions, densities = (_concepts(ttl, s) for s in ("WebInteractionModelScheme", "DesignExpressionScheme", "DesignDensityScheme"))
    for block in re.split(r"\n\s*\n", ttl):
        m = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[\s\S]*?dcterms:identifier "([^"]+)"', block, re.M)
        types = re.search(r"dcterms:type ([^;]+);", block)
        if not m or not types or "ifcore:WebDesignSystemKind" not in types.group(1):
            continue
        named = set(re.findall(r"ifcore:(\w+)", types.group(1)))
        where = f"ontology/ifcore.ttl ({m.group(1)})"
        if not named & models:
            findings.append(Finding("error", where, "a web design system names no interaction model (0014-design-systems FR-041)"))
        if len(named & expressions) != 1:
            findings.append(Finding("error", where, "a web design system names exactly one expression, productive or expressive (0014-design-systems FR-041)"))
        if not named & densities:
            findings.append(Finding("error", where, "a web design system names no density (0014-design-systems FR-041)"))
    doc_types = _concepts(ttl, "PrintDocumentTypeScheme")
    for block in re.split(r"\n\s*\n", ttl):
        m = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[\s\S]*?dcterms:identifier "([^"]+)"', block, re.M)
        types = re.search(r"dcterms:type ([^;]+);", block)
        if m and types and "ifcore:PrintDesignSystemKind" in types.group(1) and not set(re.findall(r"ifcore:(\w+)", types.group(1))) & doc_types:
            findings.append(Finding("error", f"ontology/ifcore.ttl ({m.group(1)})", "a print design system names no print document type (0014-design-systems FR-042)"))
    figure_types = _concepts(ttl, "FigureTypeScheme")
    for block in re.split(r"\n\s*\n", ttl):
        m = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[\s\S]*?dcterms:identifier "([^"]+)"', block, re.M)
        types = re.search(r"dcterms:type ([^;]+);", block)
        if not (m and types):
            continue
        where = f"ontology/ifcore.ttl ({m.group(1)})"
        named = set(re.findall(r"ifcore:(\w+)", types.group(1)))
        if "EmailDesignSystemKind" in named and not named & _concepts(ttl, "EmailTypeScheme"):
            findings.append(Finding("error", where, "an email design system names no email type (0014-design-systems FR-051)"))
        if "MediaDesignSystemKind" in named and not named & _concepts(ttl, "MediaAssetTypeScheme"):
            findings.append(Finding("error", where, "a media design system names no media asset type (0014-design-systems FR-050)"))
        if "CourseDesignSystemKind" in named and not all(named & _concepts(ttl, s) for s in ("CourseFormatScheme", "AssessmentItemTypeScheme", "CourseDeliveryTargetScheme")):
            findings.append(Finding("error", where, "a course design system names no course format, assessment item type or delivery target (0014-design-systems FR-052)"))
        if "SlidesDesignSystemKind" in named and not named & _concepts(ttl, "DeckTypeScheme"):
            findings.append(Finding("error", where, "a slides design system names no deck type (0014-design-systems FR-049)"))
        if "FigureDesignSystemKind" in named and not named & figure_types:
            findings.append(Finding("error", where, "a figure design system names no figure type (0014-design-systems FR-032)"))
        if named & {"WebDesignSystemKind", "PrintDesignSystemKind", "SlidesDesignSystemKind", "CourseDesignSystemKind"} and "ifcore:drawsFiguresWith" not in block:
            findings.append(Finding("error", where, "a web, print, slides or course design system names no figure design system by ifcore:drawsFiguresWith (0014-design-systems FR-048)"))
    methods, categories = _concepts(ttl, "DecorationMethodScheme"), _concepts(ttl, "ProductCategoryScheme")
    for block in re.split(r"\n\s*\n", ttl):
        m = re.search(r'^ifcore:\w+ a ifcore:DesignSystem ;[\s\S]*?dcterms:identifier "([^"]+)"', block, re.M)
        types = re.search(r"dcterms:type ([^;]+);", block)
        if m and types and "ifcore:MerchandiseDesignSystemKind" in types.group(1):
            named = set(re.findall(r"ifcore:(\w+)", types.group(1)))
            where = f"ontology/ifcore.ttl ({m.group(1)})"
            if not named & methods:
                findings.append(Finding("error", where, "a merchandise design system names no decoration method (0014-design-systems FR-046)"))
            if not named & categories:
                findings.append(Finding("error", where, "a merchandise design system names no product category (0014-design-systems FR-046)"))
    return findings


def _check_derivation(ttl: str) -> list[Finding]:
    """0014-design-systems FR-020 and FR-034: a design system derives (prov:wasDerivedFrom) only from registered
    design systems, never from a brand and never in a cycle, and every spoken-voice design system derives from a
    written-voice one."""
    findings: list[Finding] = []
    kinds: dict[str, set[str]] = {}
    parents: dict[str, list[str]] = {}
    for block in re.split(r"\n\s*\n", ttl):
        m = re.search(r"^ifcore:(\w+) a ifcore:DesignSystem ;", block, re.M)
        if not m:
            continue
        types = re.search(r"dcterms:type ([^;]+);", block)
        kinds[m.group(1)] = set(re.findall(r"ifcore:(\w+)", types.group(1))) if types else set()
        derived = re.search(r"prov:wasDerivedFrom ([^;]+);", block)
        parents[m.group(1)] = re.findall(r"ifcore:(\w+)", derived.group(1)) if derived else []
    for ds, ps in parents.items():
        where = f"ontology/ifcore.ttl: ifcore:{ds}"
        for p in ps:
            if p not in kinds:
                findings.append(Finding("error", where, f"derives from ifcore:{p}, which is not a registered design system (0014-design-systems FR-020)"))
            elif "BrandDesignSystemKind" in kinds[p]:
                findings.append(Finding("error", where, f"derives from the brand ifcore:{p}; a brand themes a design system, nothing derives from one (0014-design-systems FR-020)"))
        if "SpokenVoiceDesignSystemKind" in kinds[ds] and not any("WrittenVoiceDesignSystemKind" in kinds.get(p, set()) for p in ps):
            findings.append(Finding("error", where, "a spoken-voice design system must derive from a written-voice one (0014-design-systems FR-034)"))
        seen, stack = set(), list(ps)
        while stack:
            p = stack.pop()
            if p == ds:
                findings.append(Finding("error", where, "its derivation forms a cycle (0014-design-systems FR-020)"))
                break
            if p not in seen:
                seen.add(p)
                stack += parents.get(p, [])
    return findings


def check_prefixes(root: Path) -> list[Finding]:
    """0001 FR-007: no ontology file uses a bare if: prefix."""
    findings: list[Finding] = []
    bare = re.compile(r"^@prefix\s+if:|(?<![\w:/#-])if:[A-Za-z]", re.M)
    for f in sorted((root / "ontology").rglob("*.ttl")) if (root / "ontology").is_dir() else []:
        for lineno, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if bare.search(line):
                findings.append(Finding("error", f"{f.relative_to(root)}:{lineno}", "bare if: prefix; use ifcore:, ifweb:, or ifpriv: (0001 FR-007)"))
    return findings




# A reader for the ontology's SKOS terms and command individuals --------------------------------------------------
STRING = r'"((?:[^"\\]|\\.)*)"'
SUBJECT = re.compile(r"^([A-Za-z][\w-]*):([\w-]+)\s")


def statements(ttl: str) -> list[tuple[str, str]]:
    """(prefixed subject, its text) for each statement: a line at column 0 starts one, a blank line or comment ends it."""
    out: list[tuple[str, str]] = []
    cur: list[str] = []
    subj = ""
    for line in ttl.splitlines():
        m = SUBJECT.match(line + " ")
        if m and not line.startswith("@") and not line.startswith(" "):
            if cur:
                out.append((subj, "\n".join(cur)))
            subj, cur = f"{m.group(1)}:{m.group(2)}", [line]
        elif line.strip() and not line.lstrip().startswith("#") and cur:
            cur.append(line)
        elif cur:
            out.append((subj, "\n".join(cur)))
            cur = []
    if cur:
        out.append((subj, "\n".join(cur)))
    return out


def _one(text: str, prop: str) -> str | None:
    m = re.search(rf"{re.escape(prop)}\s+{STRING}", text)
    return m.group(1).replace('\\"', '"') if m else None


def _ref(text: str, prop: str) -> str | None:
    m = re.search(rf"{re.escape(prop)}\s+ifcore:([\w-]+)", text)
    return m.group(1) if m else None


def terms(ttl: str) -> list[dict[str, str | None]]:
    """Every skos:Concept and skos:ConceptScheme (and ifcore:ControlCatalog) of the ontology."""
    out = []
    for subj, text in statements(ttl):
        if not subj.startswith("ifcore:"):
            continue
        head = text.split(";", 1)[0]
        if re.search(r"\ba\s+skos:Concept\b", head):
            kind = "concept"
        elif re.search(r"\ba\s+(skos:ConceptScheme|ifcore:ControlCatalog)\b", head):
            kind = "scheme"
        else:
            continue
        out.append({"id": subj[len("ifcore:"):], "kind": kind, "scheme": _ref(text, "skos:inScheme"),
                    "label": _one(text, "skos:prefLabel") or _one(text, "rdfs:label"),
                    "notation": _one(text, "skos:notation"), "definition": _one(text, "skos:definition")})
    return out


def command_individuals(ttl: str) -> dict[str, dict[str, str | None]]:
    """Each ifcore:Command: its words (dcterms:identifier) -> noun, verb and category notations (0042 FR-004)."""
    notation = {t["id"]: t["notation"] for t in terms(ttl) if t["kind"] == "concept"}
    out: dict[str, dict[str, str | None]] = {}
    for subj, text in statements(ttl):
        if not re.search(r"\ba\s+ifcore:Command\b", text.split(";", 1)[0]):
            continue
        words = _one(text, "dcterms:identifier")
        if words is None:
            continue
        noun, verb, cat = (_ref(text, p) for p in ("ifcore:commandNoun", "ifcore:commandVerb", "ifcore:commandCategory"))
        out[words] = {"iri": subj, "noun": notation.get(noun) if noun else None, "verb": notation.get(verb) if verb else None,
                      "category": notation.get(cat) if cat else None}
    return out
