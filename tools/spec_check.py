#!/usr/bin/env python3
"""Check specs and the enforcement register against 0020-spec-format.

Standard library only, so the public root's CI needs no installs (0020 FR-015),
and the vault imports this same file rather than keeping a second copy of the
rules (0020 FR-016).

    python3 tools/spec_check.py                  # check this repository
    python3 tools/spec_check.py --root ../eidolon --public .
"""
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

NUMBERED = r"\d{4}-[a-z][a-z0-9-]*"
SPEC_DIR = re.compile(rf"^{NUMBERED}$")
KIND_CODE = re.compile(
    r"^ifcore:\w+ a skos:Concept ; skos:inScheme ifcore:DesignSystemKindScheme\b[^\n]*\n\s*skos:notation \"([a-z][a-z0-9-]*)\"",
    re.M,
)


def kind_codes(root: Path) -> list[str]:
    """The design system kind codes (0014-design-systems FR-018) declared in root's ifcore.ttl, longest first."""
    ttl = root / "ontology" / "ifcore.ttl"
    codes = KIND_CODE.findall(ttl.read_text(encoding="utf-8")) if ttl.is_file() else []
    return sorted(set(codes), key=len, reverse=True)


# The public root's kind codes. This file always lives in the public root; the vault imports it
# from there (0020 FR-016), so the codes are the public root's even when checking the vault.
CODES = kind_codes(Path(__file__).resolve().parent.parent)
SLUG = rf"[a-z][a-z0-9-]*-(?:{'|'.join(map(re.escape, CODES))})" if CODES else None
# A spec's name: NNNN-slug, or a design system's slug (0020 FR-018).
SPEC_NAME = rf"(?:{NUMBERED}|{SLUG})" if SLUG else NUMBERED
DS_DIR = re.compile(rf"^{SLUG}$") if SLUG else None
ID_LINE = re.compile(r"^\*\*Spec ID:\*\*\s*(\S+)\s*$", re.M)
STATUS_LINE = re.compile(r"^\*\*Status:\*\*\s*(.+?)\s*$", re.M)
INPUT_LINE = re.compile(r"^\*\*Input:\*\*\s*\S", re.M)
STATUS = re.compile(rf"^(Draft|Adopted|Superseded by ({SPEC_NAME}))$")
ITEM = re.compile(r"^- \*\*((?:FR|SC)-\d{3}|OQ-\d+)\*\*:", re.M)
HEADING = re.compile(r"^## (.+?)\s*$", re.M)
DATED = re.compile(r"\b20\d\d-\d\d-\d\d\b")
NARRATION = re.compile(
    r"\b(previously|used to|renamed from|formerly|changelog|as of (?:january|february|march|april|may|june|"
    r"july|august|september|october|november|december))\b",
    re.I,
)
# A spec name, optionally "(`.github`)", then ids joined by ",", "and", "through", "–" or "-".
REF = re.compile(
    rf"(?P<spec>{SPEC_NAME})\s*(?:\(`?\.?github`?\)\s*)?"
    r"(?P<ids>(?:FR|SC)-\d{3}(?:\s*(?:,|and|through|–|-|to)\s*(?:(?:FR|SC)-\d{3}|(?<![\d-])\d{3}(?![\d-])))*)"
)
ID_IN = re.compile(r"(FR|SC)-(\d{3})")

# 0020 FR-005: the closing sections, in order. "Out of scope" is optional.
CLOSING = [
    "Out of scope",
    "Edge cases",
    "Assumptions",
    "Open questions",
    "Key entities",
    "Success criteria",
    "Review & acceptance checklist",
]
OPTIONAL = {"Out of scope"}

MECHANISMS = {"check", "gate", "review", "none"}  # 0020 FR-012
REQ = re.compile(rf"^(?P<spec>{SPEC_NAME}) (?P<id>FR-\d{{3}})$")
COMMAND = re.compile(r"^(\.github|eidolon|www\.intellectualfrontiers\.com): \S")
REGISTER = Path("spec-kit") / "enforcement.tsv"


@dataclass
class Finding:
    level: str  # "error" or "warning"
    where: str
    message: str

    def __str__(self) -> str:
        return f"{'❎' if self.level == 'error' else '🟡'} {self.where}: {self.message}"


def spec_files(root: Path) -> list[Path]:
    """Numbered specs, then design system specs (0020 FR-018)."""
    d = root / "spec-kit" / "specs"
    numbered = sorted(d.glob("[0-9][0-9][0-9][0-9]-*/spec.md")) if d.is_dir() else []
    ds = root / "design-systems"
    return numbered + (sorted(ds.glob("*/spec.md")) if ds.is_dir() else [])


def _is_design_system(f: Path) -> bool:
    return f.parent.parent.name == "design-systems"


def _strip_code(text: str) -> str:
    return re.sub(r"```.*?```", "", text, flags=re.S)


def index_of(*roots: Path | None) -> dict[str, set[str]]:
    """Spec name -> the FR and SC ids it defines, across every root given."""
    index: dict[str, set[str]] = {}
    for root in roots:
        if root is None:
            continue
        for f in spec_files(root):
            ids = {i for i in ITEM.findall(f.read_text(encoding="utf-8")) if not i.startswith("OQ")}
            index.setdefault(f.parent.name, set()).update(ids)
    return index


def _expand(ids: str) -> list[str]:
    """'FR-001 through FR-004' or 'FR-014 – FR-016' -> each id it names."""
    out: list[str] = []
    prefix = "FR"
    tokens = re.findall(r"(?:(FR|SC)-)?(\d{3})|(through|–|-|to)", ids)
    pending_range = False
    for pre, num, sep in tokens:
        if sep:
            pending_range = True
            continue
        prefix = pre or prefix
        n = int(num)
        if pending_range and out:
            last = int(out[-1][3:])
            out.extend(f"{prefix}-{k:03d}" for k in range(last + 1, n + 1))
        else:
            out.append(f"{prefix}-{n:03d}")
        pending_range = False
    return out


def check_shape(root: Path, public: Path | None = None) -> list[Finding]:
    """0020 FR-005 (sections) and FR-009 (status), for every spec under root.

    The vault calls this directly: its own checker already covers identity,
    numbering, dated provenance, and cross-references.
    """
    findings: list[Finding] = []
    names = set(index_of(public, root))
    for f in spec_files(root):
        rel = str(f.relative_to(root))
        text = f.read_text(encoding="utf-8")
        s = STATUS_LINE.search(text)
        if not s:
            findings.append(Finding("error", rel, "missing **Status:** line"))
        else:
            sm = STATUS.match(s.group(1))
            if not sm:
                findings.append(Finding("error", rel, f"status {s.group(1)!r} is not Draft, Adopted, or 'Superseded by <spec>' (0020 FR-009)"))
            elif sm.group(2) and sm.group(2) not in names:
                findings.append(Finding("error", rel, f"superseded by {sm.group(2)}, which does not exist (0020 FR-009)"))
        findings += _check_sections(rel, text)
    return findings


def check_format(root: Path, public: Path | None = None, cross_refs: bool = True) -> list[Finding]:
    """0020 FR-005, FR-008, FR-009, and 0001 FR-034, for every spec under root."""
    findings: list[Finding] = check_shape(root, public)
    own = spec_files(root)
    index = index_of(public, root)
    for f in own:
        rel = str(f.relative_to(root))
        text = f.read_text(encoding="utf-8")
        name = f.parent.name
        if _is_design_system(f):
            if not (DS_DIR and DS_DIR.match(name)):
                findings.append(Finding("error", rel, f"design system slug must end with its kind's code, one of {CODES} (0014-design-systems FR-003)"))
        elif not SPEC_DIR.match(name):
            findings.append(Finding("error", rel, "spec directory must be NNNN-slug (0020 FR-018)"))
        m = ID_LINE.search(text)
        if not m:
            findings.append(Finding("error", rel, "missing **Spec ID:** line"))
        elif m.group(1) != name:
            findings.append(Finding("error", rel, f"Spec ID {m.group(1)} does not match its directory {name}"))
        if not INPUT_LINE.search(text):
            findings.append(Finding("error", rel, "missing **Input:** line"))
        seen: set[str] = set()
        for ident in ITEM.findall(text):
            if ident in seen:
                findings.append(Finding("error", rel, f"{ident} is defined twice (0020 FR-008)"))
            seen.add(ident)
        prose = _strip_code(text)
        for lineno, line in enumerate(prose.splitlines(), 1):
            if DATED.search(line):
                findings.append(Finding("error", f"{rel}:{lineno}", "dated provenance does not belong in a spec (0001 FR-034)"))
            elif NARRATION.search(line):
                findings.append(Finding("warning", f"{rel}:{lineno}", "reads as change narration (0001 FR-034)"))
            if cross_refs:
                for r in REF.finditer(line):
                    spec = r.group("spec")
                    if spec not in index:
                        findings.append(Finding("error", f"{rel}:{lineno}", f"cites {spec}, which does not exist"))
                        continue
                    for ident in _expand(r.group("ids")):
                        if ident not in index[spec]:
                            findings.append(Finding("error", f"{rel}:{lineno}", f"cites {spec} {ident}, which does not exist"))
    return findings


def _check_sections(rel: str, text: str) -> list[Finding]:
    """0020 FR-005: requirement sections, then the closing sections in order, none empty."""
    findings: list[Finding] = []
    heads = [(m.group(1), m.end()) for m in HEADING.finditer(text)]
    titles = [h for h, _ in heads]
    first = next((i for i, h in enumerate(titles) if h in CLOSING), len(titles))
    if first == 0 or not ITEM.search(text):
        findings.append(Finding("error", rel, "no requirement section before the closing sections (0020 FR-005)"))
    tail = titles[first:]
    stray = [h for h in tail if h not in CLOSING]
    if stray:
        findings.append(Finding("error", rel, f"section(s) {stray} come after the closing sections begin (0020 FR-005)"))
    present = [h for h in tail if h in CLOSING]
    expected = [h for h in CLOSING if h in present]
    if present != expected:
        findings.append(Finding("error", rel, f"closing sections out of order: {present} (0020 FR-005)"))
    for h in CLOSING:
        if h not in OPTIONAL and h not in titles:
            findings.append(Finding("error", rel, f"missing '## {h}' (0020 FR-005)"))
    for i, (h, end) in enumerate(heads):
        nxt = text.find("\n## ", end)
        body = text[end: nxt if nxt != -1 else len(text)]
        if h in CLOSING and not body.strip():
            findings.append(Finding("error", rel, f"'## {h}' is empty; say so in one line (0020 FR-005)"))
        if h == "Edge cases":
            for bullet in re.split(r"\n(?=- )", "\n" + body.strip())[1:]:
                if not re.search(r"\b(?:FR|SC)-\d{3}\b", bullet):
                    first_line = bullet.strip().splitlines()[0][:60]
                    findings.append(Finding("error", rel, f"edge case cites no requirement: {first_line!r} (0020 FR-006)"))
    return findings


def check_register(root: Path, public: Path | None = None) -> tuple[list[Finding], list[tuple[str, str]], dict[str, int]]:
    """0020 FR-011 – FR-014. Returns findings, the rows enforced by nothing, and counts by mechanism."""
    findings: list[Finding] = []
    nones: list[tuple[str, str]] = []
    counts = {m: 0 for m in sorted(MECHANISMS)}
    own = index_of(root)
    every = index_of(public, root)
    path = root / REGISTER
    rel = str(REGISTER)
    if not path.is_file():
        findings.append(Finding("error", rel, "missing enforcement register (0020 FR-011)"))
        return findings, nones, counts
    seen: set[str] = set()
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip() or raw.startswith("#") or raw.startswith("requirement\t"):
            continue
        where = f"{rel}:{lineno}"
        cols = raw.split("\t")
        if len(cols) < 3:
            findings.append(Finding("error", where, "a row is requirement, mechanism, by[, note], tab-separated"))
            continue
        req, mech, by = cols[0].strip(), cols[1].strip(), cols[2].strip()
        m = REQ.match(req)
        if not m:
            findings.append(Finding("error", where, f"{req!r} is not '<spec> FR-NNN' (0020 FR-018)"))
            continue
        if m.group("id") not in own.get(m.group("spec"), set()):
            findings.append(Finding("error", where, f"{req} does not exist in this repository's specs (0020 FR-011)"))
        if req in seen:
            findings.append(Finding("error", where, f"{req} has more than one row (0020 FR-011)"))
        seen.add(req)
        if mech not in MECHANISMS:
            findings.append(Finding("error", where, f"mechanism {mech!r} is not one of {sorted(MECHANISMS)} (0020 FR-012)"))
            continue
        counts[mech] += 1
        if mech in ("check", "gate") and not COMMAND.match(by):
            findings.append(Finding("error", where, f"a {mech} row names its repository and command, e.g. 'eidolon: make check' or 'www.intellectualfrontiers.com: cargo test' (0020 FR-013)"))
        elif mech == "review":
            r = REF.fullmatch(by)
            ids = _expand(r.group("ids")) if r else []
            if not r or r.group("spec") not in every or any(i not in every[r.group("spec")] for i in ids):
                findings.append(Finding("error", where, f"a review row cites the requirement that defines the review; {by!r} does not resolve (0020 FR-013)"))
        elif mech == "none":
            nones.append((req, cols[3].strip() if len(cols) > 3 else ""))
    for spec, ids in sorted(own.items()):
        for ident in sorted(i for i in ids if i.startswith("FR")):
            if f"{spec} {ident}" not in seen:
                findings.append(Finding("error", rel, f"{spec} {ident} has no row (0020 FR-011)"))
    return findings, nones, counts


DS_IDENTIFIER = re.compile(r"^ifcore:\w+ a ifcore:DesignSystem ;\s*\n\s*dcterms:identifier \"([^\"]+)\"", re.M)


def check_design_systems(root: Path) -> list[Finding]:
    """0014-design-systems FR-003, FR-010 and FR-022: each design system's slug ends with a kind code, it is
    registered in ifcore.ttl by that slug (and nothing registered is missing), and it has a spec."""
    findings: list[Finding] = []
    ds = root / "design-systems"
    if not ds.is_dir():
        return findings
    ttl = root / "ontology" / "ifcore.ttl"
    registered = set(DS_IDENTIFIER.findall(ttl.read_text(encoding="utf-8"))) if ttl.is_file() else set()
    dirs = {p.name for p in ds.iterdir() if p.is_dir()}
    for slug in sorted(registered - dirs):
        findings.append(Finding("error", "ontology/ifcore.ttl", f"design system {slug} is registered but design-systems/{slug}/ does not exist (0014-design-systems FR-010)"))
    findings += _check_web_classification(ttl.read_text(encoding="utf-8") if ttl.is_file() else "")
    for d in sorted(p for p in ds.iterdir() if p.is_dir()):
        if d.name not in registered:
            findings.append(Finding("error", str(d.relative_to(root)), "is not registered in ifcore.ttl as an ifcore:DesignSystem with this dcterms:identifier (0014-design-systems FR-010)"))
        rel = str(d.relative_to(root))
        if not (DS_DIR and DS_DIR.match(d.name)):
            findings.append(Finding("error", rel, f"design system slug must end with its kind's code, one of {CODES} (0014-design-systems FR-003)"))
        if not (d / "spec.md").is_file():
            findings.append(Finding("warning", rel, "has no spec.md stating its house rules (0014-design-systems FR-022)"))
    return findings


def _concepts(ttl: str, scheme: str) -> set[str]:
    """Local names of the skos:Concepts in `scheme`."""
    return set(re.findall(rf"^ifcore:(\w+) a skos:Concept ; skos:inScheme ifcore:{scheme}\b", ttl, re.M))


def _check_web_classification(ttl: str) -> list[Finding]:
    """0014-design-systems FR-041 and FR-042: every web design system names one or more interaction models, exactly
    one expression and one or more densities, and every print design system one or more print document types,
    by dcterms:type."""
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


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    ap.add_argument("--public", type=Path, default=None, help="the public root, when checking the vault")
    ap.add_argument("--list-none", action="store_true", help="list every requirement enforced by nothing")
    args = ap.parse_args(argv)
    root = args.root.resolve()
    public = args.public.resolve() if args.public else None
    findings = check_format(root, public) + check_prefixes(root) + check_design_systems(root)
    reg, nones, counts = check_register(root, public)
    findings += reg
    for f in findings:
        print(f)
    total = sum(counts.values())
    print(f"enforcement: {total} requirements — " + ", ".join(f"{counts[m]} {m}" for m in ("check", "gate", "review", "none")))
    # 0020 FR-014: every run reports what nothing enforces.
    if nones:
        by_spec: dict[str, list[str]] = {}
        for req, _ in nones:
            spec, ident = req.split(" ")
            by_spec.setdefault(spec, []).append(ident[3:])
        print("enforced by nothing (0020 FR-014):")
        for spec, ids in by_spec.items():
            print(f"  {spec}: FR-" + ", ".join(ids))
        if args.list_none:
            for req, note in nones:
                print(f"    {req}" + (f" — {note}" if note else ""))
    errors = sum(1 for f in findings if f.level == "error")
    print("✅ specs" if not errors else f"❎ specs: {errors} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
