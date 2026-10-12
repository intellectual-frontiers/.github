"""Specs: finding them, indexing their requirements, and checking their format.

Ported from the public root's former spec checker, with the same findings and messages (0020-spec-format FR-005,
FR-006, FR-008, FR-009, FR-018; 0001-eidolon-architecture FR-034).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from agora.core.checks import Finding
from .names import (CLOSING, DATED, HEADING, ID_LINE, INPUT_LINE, ITEM, NARRATION, OPTIONAL, SPEC_DIR, STATUS_LINE,
                    expand, names, strip_code)


def spec_files(root: Path) -> list[Path]:
    """Numbered specs, then design system specs (0020 FR-018)."""
    d = root / "spec-kit" / "specs"
    numbered = sorted(d.glob("[0-9][0-9][0-9][0-9]-*/spec.md")) if d.is_dir() else []
    ds = root / "design-systems"
    return numbered + (sorted(ds.glob("*/spec.md")) if ds.is_dir() else [])


def is_design_system(f: Path) -> bool:
    return f.parent.parent.name == "design-systems"


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


def check_shape(root: Path, public: Path) -> list[Finding]:
    """0020 FR-005 (sections) and FR-009 (status), for every spec under root."""
    findings: list[Finding] = []
    n = names(public)
    known = set(index_of(public, root))
    for f in spec_files(root):
        rel = str(f.relative_to(root))
        text = f.read_text(encoding="utf-8")
        s = STATUS_LINE.search(text)
        if not s:
            findings.append(Finding("error", rel, "missing **Status:** line"))
        else:
            sm = n.status.match(s.group(1))
            if not sm:
                findings.append(Finding("error", rel, f"status {s.group(1)!r} is not Draft, Adopted, or 'Superseded by <spec>' (0020 FR-009)"))
            elif sm.group(2) and sm.group(2) not in known:
                findings.append(Finding("error", rel, f"superseded by {sm.group(2)}, which does not exist (0020 FR-009)"))
        findings += check_sections(rel, text)
    return findings


def check_format(root: Path, public: Path, cross_refs: bool = True) -> list[Finding]:
    """0020 FR-005, FR-008, FR-009, and 0001 FR-034, for every spec under root."""
    findings: list[Finding] = check_shape(root, public)
    n = names(public)
    index = index_of(public, root)
    for f in spec_files(root):
        rel = str(f.relative_to(root))
        text = f.read_text(encoding="utf-8")
        name = f.parent.name
        if is_design_system(f):
            if not (n.ds_dir and n.ds_dir.match(name)):
                findings.append(Finding("error", rel, f"design system slug must end with its kind's code, one of {list(n.codes)} (0014-design-systems FR-003)"))
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
        for lineno, line in enumerate(strip_code(text).splitlines(), 1):
            if DATED.search(line):
                findings.append(Finding("error", f"{rel}:{lineno}", "dated provenance does not belong in a spec (0001 FR-034)"))
            elif NARRATION.search(line):
                findings.append(Finding("warning", f"{rel}:{lineno}", "reads as change narration (0001 FR-034)"))
            if cross_refs:
                for r in n.ref.finditer(line):
                    spec = r.group("spec")
                    if spec not in index:
                        findings.append(Finding("error", f"{rel}:{lineno}", f"cites {spec}, which does not exist"))
                        continue
                    for ident in expand(r.group("ids")):
                        if ident not in index[spec]:
                            findings.append(Finding("error", f"{rel}:{lineno}", f"cites {spec} {ident}, which does not exist"))
        findings += check_loose_ids(strip_code(text), rel, seen, n)
    return findings


LOOSE_ID = re.compile(r"\b(FR|SC|OQ)-(\d{3})\b")
# How far before a bare identifier a spec name still claims it ("... FR-016 of that spec").
CLAIM_WINDOW = 220


def check_loose_ids(prose: str, rel: str, defined: set[str], n) -> list[Finding]:
    """0020 FR-019: a bare `FR-NNN` is this spec's own unless a spec is named just before it."""
    spans = [m.span() for m in n.ref.finditer(prose)]
    claim = re.compile(n.spec_name)
    out: list[Finding] = []
    for m in LOOSE_ID.finditer(prose):
        if any(a <= m.start() < b for a, b in spans):
            continue
        ident = f"{m.group(1)}-{m.group(2)}"
        if ident in defined or claim.search(prose[max(0, m.start() - CLAIM_WINDOW):m.start()]):
            continue
        line = prose.count("\n", 0, m.start()) + 1
        out.append(Finding("warning", f"{rel}:{line}", f"{ident} is not defined in this spec; name the spec it belongs to (0020 FR-019)"))
    return out


def check_sections(rel: str, text: str) -> list[Finding]:
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
    for h, end in heads:
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


# Reading one spec (for `spec show`, `requirement show`, `context`) ----------------------------------------------
@dataclass
class Spec:
    name: str
    path: Path
    root: Path
    text: str

    @property
    def rel(self) -> str:
        return str(self.path.relative_to(self.root))

    @property
    def design_system(self) -> bool:
        return is_design_system(self.path)

    @property
    def status(self) -> str:
        m = STATUS_LINE.search(self.text)
        return m.group(1) if m else ""

    @property
    def title(self) -> str:
        m = re.match(r"#\s*(?:Feature Specification:\s*)?(.+)", self.text)
        return m.group(1).strip() if m else self.name

    def requirements(self) -> list[tuple[str, str]]:
        """(id, text) for every FR, in order; text is the item's paragraph, unwrapped."""
        out: list[tuple[str, str]] = []
        ms = list(ITEM.finditer(self.text))
        for i, m in enumerate(ms):
            if not m.group(1).startswith("FR"):
                continue
            end = ms[i + 1].start() if i + 1 < len(ms) else len(self.text)
            body = self.text[m.end() + 1:end]
            body = re.split(r"\n(?=## )", body)[0]
            out.append((m.group(1), " ".join(body.split())))
        return out


def line_of(spec: "Spec", ident: str) -> int | None:
    """The 1-based line of the item that states a requirement or criterion, where the spec says it."""
    for n, line in enumerate(spec.text.splitlines(), 1):
        m = ITEM.match(line)
        if m and m.group(1) == ident:
            return n
    return None


def find_specs(root: Path) -> list[Spec]:
    return [Spec(f.parent.name, f, root, f.read_text(encoding="utf-8")) for f in spec_files(root)]


def resolve_spec(root: Path, value: str) -> Spec | None:
    """NNNN-slug, NNNN, or a design system's slug."""
    specs = find_specs(root)
    for s in specs:
        if s.name == value:
            return s
    if re.fullmatch(r"\d{4}", value):
        hits = [s for s in specs if s.name.startswith(value + "-")]
        if len(hits) == 1:
            return hits[0]
    return None
