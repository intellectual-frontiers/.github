"""Design systems as the ontology registers them and the directory holds them (0014-design-systems FR-003, FR-006, FR-010,
FR-022; 0042-agora FR-006, FR-009). Standard library only."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from . import ontology, register, specs
from .names import kind_codes

HARNESS = ("run.mjs", "run.py", "index.html")


def slugs(root: Path) -> list[str]:
    d = root / "design-systems"
    return sorted(p.name for p in d.iterdir() if p.is_dir()) if d.is_dir() else []


def _ttl(root: Path) -> str:
    f = root / "ontology" / "ifcore.ttl"
    return f.read_text(encoding="utf-8") if f.is_file() else ""


def entries(root: Path) -> dict[str, dict[str, Any]]:
    """Each ifcore:DesignSystem individual by its slug: iri, label, status, kind code, the slugs it derives from, comment."""
    ttl = _ttl(root)
    notation = {t["id"]: t["notation"] for t in ontology.terms(ttl) if t["kind"] == "concept" and t["scheme"] == "DesignSystemKindScheme"}
    blocks = [(subj, text) for subj, text in ontology.statements(ttl) if re.search(r"\ba\s+ifcore:DesignSystem\b", text.split(";", 1)[0])]
    by_iri = {subj[len("ifcore:"):]: ontology._one(text, "dcterms:identifier") for subj, text in blocks}
    out: dict[str, dict[str, Any]] = {}
    for subj, text in blocks:
        slug = ontology._one(text, "dcterms:identifier")
        if not slug:
            continue
        types = re.findall(r"ifcore:(\w+)", (re.search(r"dcterms:type ([^;]+);", text) or [None, ""])[1])
        derived = re.findall(r"ifcore:(\w+)", (re.search(r"prov:wasDerivedFrom ([^;]+);", text) or [None, ""])[1])
        status = ontology._ref(text, "ifcore:designSystemStatus") or ""
        out[slug] = {"iri": subj, "label": ontology._one(text, "rdfs:label"),
                     "status": status.removesuffix("DesignSystem") if status else "",
                     "kind": next((notation[t] for t in types if t in notation), None),
                     "derives from": [by_iri.get(d, d) for d in derived], "comment": ontology._one(text, "rdfs:comment")}
    return out


def harness_files(root: Path, slug: str) -> list[str]:
    base = root / "design-systems" / slug / "assurance"
    return [f"assurance/{n}" for n in HARNESS if (base / n).is_file()]


def row(root: Path, slug: str, entry: dict[str, Any] | None) -> dict[str, Any]:
    s = specs.resolve_spec(root, slug)
    return {"slug": slug, "kind": (entry or {}).get("kind") or "", "status": (entry or {}).get("status") or "unregistered",
            "spec": s.status if s else "none", "requirements": len(s.requirements()) if s else 0,
            "harness": ", ".join(n.removeprefix("assurance/") for n in harness_files(root, slug)) or "none"}


def detail(root: Path, slug: str) -> dict[str, Any]:
    entry = entries(root).get(slug)
    d = root / "design-systems" / slug
    s = specs.resolve_spec(root, slug)
    counts: dict[str, int] = {}
    for req, r in register.register_rows(root).items():
        if req.startswith(slug + " "):
            counts[r["mechanism"]] = counts.get(r["mechanism"], 0) + 1
    derived_by = sorted(k for k, e in entries(root).items() if slug in e["derives from"])
    return {**row(root, slug, entry), "path": f"design-systems/{slug}", "label": (entry or {}).get("label") or "",
            "registered": entry is not None, "derives from": (entry or {}).get("derives from", []), "derived by": derived_by,
            "readme": (d / "README.md").is_file(), "spec title": s.title if s else "", "enforcement": counts,
            "description": (entry or {}).get("comment") or ""}


README = """# {label}: design system

> **Canonical and public.** Governed by [`spec.md`](spec.md) and
> [`0014-design-systems`](../../spec-kit/specs/0014-design-systems/spec.md). Its kind and its status are the ontology's, not
> this file's (0014-design-systems FR-010, FR-011).

Scaffolded by `agora design-system new`. Say here what it is for, what it holds and how to use it
(0014-design-systems FR-006, FR-013).

## Assurance

`python3 assurance/run.py` runs its harness on its own (0014-design-systems FR-015). It has no tests yet, so it fails until
it does: a harness never reports a test it did not run as passed.
"""

HARNESS_PY = '''#!/usr/bin/env python3
"""The assurance harness of {slug} (0014-design-systems FR-015, FR-027).

It runs on its own: `python3 assurance/run.py`. It has no tests yet, so it fails; it covers, at minimum, every
requirement of spec.md whose register row is `check`. Replace this stub with the tests, and keep the rule that it
never reports a test it did not run as passed.
"""
import sys


def main() -> int:
    print("{slug}: the harness has no tests yet; write them (0014-design-systems FR-015, FR-027)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
'''


def scaffold(root: Path, slug: str, label: str) -> dict[Path, str]:
    """The files `design-system new` creates when they are missing (0042 FR-009)."""
    d = root / "design-systems" / slug
    out = {d / "README.md": README.format(label=label)}
    if not harness_files(root, slug):  # a harness it has already, of whatever kind, is not replaced by a stub
        out[d / "assurance" / "run.py"] = HARNESS_PY.format(slug=slug)
    return out
