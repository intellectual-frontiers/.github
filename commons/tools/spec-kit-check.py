#!/usr/bin/env python3
"""Check a spec-kit folder against the format every Intellectual Frontiers harness keeps (commons 0003-spec-kit).

    python3 commons/tools/spec-kit-check.py                 check commons/spec-kit
    python3 commons/tools/spec-kit-check.py --root DIR      check DIR (a folder holding registry.tsv, enforcement.tsv and specs/)

Standard library only, so any harness can run it, and `import`ed by a harness that wants the findings as data (`check(root)` gives a list of `(where, message)`). It checks the
register of numbers, the form of each specification, that edge cases cite requirements that exist, and that the enforcement register has one well-formed row for every requirement.
It does not read a harness's ontology: who owns a specification, and what a command is, are the harness's to check.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

SECTIONS = ("**Input:**", "## Out of scope", "## Edge cases", "## Assumptions", "## Open questions", "## Key entities", "## Success criteria", "## Review & acceptance checklist")
OPTIONAL = {"## Out of scope"}
STATUSES = ("Draft", "Adopted", "Superseded")
MECHANISMS = ("check", "gate", "review", "none")
REGISTRY_HEADER = "number\tslug\tstate"
STATES = ("in force", "retired")
FOLDER = re.compile(r"^(\d{4,})-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$")
ITEM = re.compile(r"^- \*\*(FR-\d{3}|SC-\d{3}|OQ-\d+)\*\*", re.M)
ROW_COMMAND = re.compile(r"^[A-Za-z0-9_.-]+: \S.*$")
type Finding = tuple[str, str]


def _registry(root: Path) -> tuple[list[tuple[int, str, str, str]], list[Finding]]:
    path = root / "registry.tsv"
    if not path.is_file():
        return [], [("registry.tsv", "the register of specification numbers is missing")]
    lines = path.read_text(encoding="utf-8").splitlines()
    found: list[Finding] = []
    if not lines or lines[0] != REGISTRY_HEADER:
        found.append(("registry.tsv:1", f"the header must be {REGISTRY_HEADER!r}"))
    rows: list[tuple[int, str, str, str]] = []
    for n, line in enumerate(lines[1:], 2):
        c = line.split("\t")
        if len(c) != 3 or not re.fullmatch(r"\d{4,}", c[0]) or c[2] not in STATES or not re.fullmatch(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*", c[1]):
            found.append((f"registry.tsv:{n}", f"a row is a number of four or more digits, a slug and one of {list(STATES)}"))
            continue
        rows.append((n, c[0], c[1], c[2]))
    return rows, found


def _requirements(text: str) -> list[str]:
    return [m for m in ITEM.findall(text) if m.startswith("FR-")]


def check(root: Path) -> list[Finding]:
    found: list[Finding] = []
    rows, bad = _registry(root)
    found += bad
    folder = root / "specs"
    present = {d.name: d for d in sorted(folder.iterdir()) if d.is_dir()} if folder.is_dir() else {}
    seen: dict[int, int] = {}
    for n, num, slug, state in rows:
        k = int(num)
        if k in seen:
            found.append((f"registry.tsv:{n}", f"number {num} is assigned twice, also on line {seen[k]}"))
            continue
        seen[k] = n
        name = f"{num}-{slug}"
        if state == "in force" and name not in present:
            found.append((f"registry.tsv:{n}", f"{name} is in force but its specification does not exist"))
        if state == "retired" and name in present:
            found.append((f"registry.tsv:{n}", f"{name} is retired but still exists"))
    for k in sorted(set(range(1, max(seen, default=0) + 1)) - set(seen)):
        found.append(("registry.tsv", f"the sequence has a gap at {k:04d}; a number is never skipped"))
    registered = {f"{num}-{slug}" for _, num, slug, _ in rows}
    requirements: dict[str, list[str]] = {}
    for name, d in present.items():
        if not FOLDER.match(name):
            found.append((f"specs/{name}", "a spec folder is named NNNN-slug"))
            continue
        if name not in registered:
            found.append((f"specs/{name}", "has no row in registry.tsv"))
        spec = d / "spec.md"
        if not spec.is_file():
            found.append((f"specs/{name}", "spec.md is missing"))
            continue
        found += _spec(name, spec.read_text(encoding="utf-8"), present, requirements)
    found += _enforcement(root, requirements)
    return found


def _spec(name: str, text: str, present: dict[str, Path], requirements: dict[str, list[str]]) -> list[Finding]:
    found: list[Finding] = []
    where = f"specs/{name}"
    if not text.startswith("# Feature Specification: "):
        found.append((where, "must begin with '# Feature Specification: <title>'"))
    for label, rx in (("Spec ID", rf"^\*\*Spec ID:\*\*\s*{re.escape(name)}\s*$"), ("Owner", r"^\*\*Owner:\*\*\s*\S"), ("Domain", r"^\*\*Domain:\*\*\s*\S")):
        if not re.search(rx, text, re.M):
            found.append((where, f"has no **{label}:** line" + (f" naming {name}" if label == "Spec ID" else "")))
    m = re.search(r"^\*\*Status:\*\*\s*(.+?)\s*$", text, re.M)
    if not m or m.group(1) not in STATUSES:
        found.append((where, f"**Status:** must be one of {list(STATUSES)}"))
    at = [((m.start() if (m := re.search(rf"^{re.escape(h)}", text, re.M)) else -1), h) for h in SECTIONS]
    for pos, h in at:
        if pos < 0 and h not in OPTIONAL:
            found.append((where, f"has no {h} section"))
    order = [p for p, _ in at if p >= 0]
    if order != sorted(order):
        found.append((where, "its sections are out of the order " + ", ".join(h for _, h in at)))
    ids = ITEM.findall(text)
    if len(ids) != len(set(ids)):
        found.append((where, "a requirement, criterion or question number is used twice"))
    frs = _requirements(text)
    requirements[name] = frs
    if frs != sorted(frs):
        found.append((where, "requirement numbers are out of order"))
    edge, assume = re.search(r"^## Edge cases", text, re.M), re.search(r"^## Assumptions", text, re.M)
    if edge and assume and edge.end() < assume.start():
        block = text[edge.end():assume.start()].strip()
        for item in (b.replace("\n  ", " ") for b in re.split(r"\n(?=- )", block) if b.strip().startswith("-")):
            cited = re.findall(r"FR-\d{3}", item)
            if not cited:
                found.append((where, f"an edge case cites no requirement: {item[:60]}"))
            elif not set(cited) <= set(frs):
                found.append((where, f"an edge case cites a requirement that is not here: {item[:60]}"))
    # a specification of another repository is cited as `<repo> NNNN-slug`; a bare one is in this folder
    for cite in sorted(set(re.findall(r"(?<![\w-])(?<!\w )(\d{4}-[a-z][a-z0-9]*(?:-[a-z0-9]+)*)", re.sub(r"\b[A-Za-z0-9_.-]+ \d{4}-[a-z][a-z0-9-]*", "", text)))):
        if cite not in present:
            found.append((where, f"cites {cite}, which is not a specification here; name the repository before the number of another's (for example `archon 0002-specs`)"))
    return found


def _enforcement(root: Path, requirements: dict[str, list[str]]) -> list[Finding]:
    path = root / "enforcement.tsv"
    if not path.is_file():
        return [("enforcement.tsv", "the enforcement register is missing")]
    found: list[Finding] = []
    want = {f"{spec} {fr}" for spec, frs in requirements.items() for fr in frs}
    have: dict[str, int] = {}
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line or line.startswith("#") or line.startswith("requirement\t"):
            continue
        c = line.split("\t")
        where = f"enforcement.tsv:{n}"
        if len(c) != 4:
            found.append((where, "a row is a requirement, a mechanism, who enforces it and a note"))
            continue
        req, mech, by, note = c
        if req in have:
            found.append((where, f"{req} has two rows, also on line {have[req]}"))
        have[req] = n
        if req not in want:
            found.append((where, f"{req} is not a requirement of any specification here"))
        if mech not in MECHANISMS:
            found.append((where, f"{req}: the mechanism must be one of {list(MECHANISMS)}"))
        elif mech in ("check", "gate") and not ROW_COMMAND.match(by):
            found.append((where, f"{req}: who enforces it is '<repository>: <command>'"))
        elif mech == "none" and (by != "-" or not note.strip()):
            found.append((where, f"{req}: a requirement nothing enforces has '-' for who and says why in the note"))
        elif mech == "review" and by not in want:
            found.append((where, f"{req}: a review names the requirement that defines it"))
    for req in sorted(want - set(have)):
        found.append(("enforcement.tsv", f"{req} has no row"))
    return found


def main(argv: list[str]) -> int:
    root = Path(argv[argv.index("--root") + 1]) if "--root" in argv else Path(__file__).resolve().parent.parent / "spec-kit"
    found = check(root)
    for where, message in found:
        print(f"{where}: {message}", file=sys.stderr)
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
