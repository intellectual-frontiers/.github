"""0028-compliance-controls FR-005, FR-006: every row of a repository's control map names a requirement in its own
specs and a control in a catalog, once. The catalogs are public, so they are read from the public root."""
from __future__ import annotations

import re
from pathlib import Path

from agora.core.checks import Finding
from .names import names
from .register import CONTROL_MAP, rows
from .specs import index_of

CATALOG = re.compile(r"^ifcore:(\w+) a ifcore:ControlCatalog ;[^\n]*\n(?:[^\n]*\n)*?\s*skos:notation \"([^\"]+)\"", re.M)
CONTROL = re.compile(r"^ifcore:[\w-]+ a skos:Concept ; skos:inScheme ifcore:(\w+) ; skos:notation \"([^\"]+)\"", re.M)


def controls_of(ttl: str) -> set[str]:
    """Every control as '<catalog notation>:<control notation>' (0028-compliance-controls FR-001, FR-005)."""
    catalogs = dict(CATALOG.findall(ttl))
    return {f"{catalogs[scheme]}:{code}" for scheme, code in CONTROL.findall(ttl) if scheme in catalogs}


def public_controls(public: Path) -> set[str]:
    ttl = public / "ontology" / "ifcore.ttl"
    return controls_of(ttl.read_text(encoding="utf-8")) if ttl.is_file() else set()


def check_control_map(root: Path, public: Path) -> tuple[list[Finding], int]:
    """Returns findings and the number of rows. A repository whose specs address no control has no control map."""
    findings: list[Finding] = []
    path = root / CONTROL_MAP
    rel = str(CONTROL_MAP)
    if not path.is_file():
        return findings, 0
    n = names(public)
    controls = public_controls(public)
    own = index_of(root)
    seen: set[tuple[str, str]] = set()
    for lineno, cols in rows(path):
        where = f"{rel}:{lineno}"
        if len(cols) < 2:
            findings.append(Finding("error", where, "a row is requirement, control[, note], tab-separated (0028 FR-005)"))
            continue
        req, ctl = cols[0].strip(), cols[1].strip()
        m = n.req.match(req)
        if not m:
            findings.append(Finding("error", where, f"{req!r} is not '<spec> FR-NNN' (0028 FR-005)"))
        elif m.group("id") not in own.get(m.group("spec"), set()):
            findings.append(Finding("error", where, f"{req} does not exist in this repository's specs (0028 FR-006)"))
        if ctl not in controls:
            findings.append(Finding("error", where, f"{ctl!r} is not '<catalog>:<control>' for a control in a catalog (0028 FR-006)"))
        if (req, ctl) in seen:
            findings.append(Finding("error", where, f"{req} and {ctl} have more than one row (0028 FR-005)"))
        seen.add((req, ctl))
    return findings, len(seen)
