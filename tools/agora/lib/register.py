"""The enforcement register and the control map (0020-spec-format FR-011 to FR-014; 0028-compliance-controls FR-005, FR-006).

A `check` or `gate` row names a repository and a command. The repositories come from the workspace's own register
(`.devcontainer/ws-repos.json`), as data, never from this code (0041 FR-045). A row of this repository's own register
name must be a command of this command line's registry (0020 FR-013): the caller passes `command_problem`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Callable

from agora.core.checks import Finding
from .names import MECHANISMS, expand, names
from .specs import index_of

REGISTER = Path("spec-kit") / "enforcement.tsv"
CONTROL_MAP = Path("spec-kit") / "controls.tsv"
ROW_COMMAND = re.compile(r"^([A-Za-z0-9_.-]+): (\S.*)$")


def known_repositories(public: Path) -> set[str]:
    """The names of the repositories the workspace register lists (the last segment of each `repo`)."""
    f = public / ".devcontainer" / "ws-repos.json"
    try:
        return {r["repo"].rstrip("/").rsplit("/", 1)[-1] for r in json.loads(f.read_text(encoding="utf-8")).get("repos", [])}
    except (OSError, ValueError, KeyError, AttributeError):
        return set()


def rows(path: Path) -> list[tuple[int, list[str]]]:
    out = []
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip() or raw.startswith("#") or raw.startswith("requirement\t"):
            continue
        out.append((lineno, raw.split("\t")))
    return out


CommandProblem = Callable[[str], "str | None"]


def row_problem(spec_index: dict[str, set[str]], every: dict[str, set[str]], public: Path, req: str, mech: str, by: str,
                own_repo: str | None, command_problem: CommandProblem | None) -> str | None:
    """Why a row (as `requirement set` would write it) is not well formed, or None. Does not test existence of `req`."""
    n = names(public)
    if mech not in MECHANISMS:
        return f"mechanism {mech!r} is not one of {sorted(MECHANISMS)} (0020 FR-012)"
    if mech in ("check", "gate"):
        m = ROW_COMMAND.match(by)
        repos = known_repositories(public)
        if not m or (repos and m.group(1) not in repos):
            ex = sorted(repos)[:2] or ["<repository>"]
            return (f"a {mech} row names its repository and command, e.g. '{ex[0]}: <command>' "
                    f"(repositories: {', '.join(sorted(repos)) or 'any'}) (0020 FR-013)")
        if own_repo and m.group(1) == own_repo and command_problem is not None:
            problem = command_problem(m.group(2))
            if problem:
                return f"{problem} (0020 FR-013)"
    elif mech == "review":
        r = n.ref.fullmatch(by)
        ids = expand(r.group("ids")) if r else []
        if not r or r.group("spec") not in every or any(i not in every[r.group("spec")] for i in ids):
            return f"a review row cites the requirement that defines the review; {by!r} does not resolve (0020 FR-013)"
    return None


def check_register(root: Path, public: Path, own_repo: str | None = None, command_problem: CommandProblem | None = None,
                   only: str | None = None) -> tuple[list[Finding], list[tuple[str, str]], dict[str, int]]:
    """0020 FR-011 to FR-014. Returns findings, the rows enforced by nothing, and counts by mechanism."""
    findings: list[Finding] = []
    nones: list[tuple[str, str]] = []
    counts = {m: 0 for m in sorted(MECHANISMS)}
    n = names(public)
    own = index_of(root)
    every = index_of(public, root)
    path = root / REGISTER
    rel = str(REGISTER)
    if not path.is_file():
        findings.append(Finding("error", rel, "missing enforcement register (0020 FR-011)"))
        return findings, nones, counts
    seen: set[str] = set()
    for lineno, cols in rows(path):
        where = f"{rel}:{lineno}"
        if len(cols) < 3:
            findings.append(Finding("error", where, "a row is requirement, mechanism, by[, note], tab-separated"))
            continue
        req, mech, by = cols[0].strip(), cols[1].strip(), cols[2].strip()
        m = n.req.match(req)
        if not m:
            findings.append(Finding("error", where, f"{req!r} is not '<spec> FR-NNN' (0020 FR-018)"))
            continue
        if only and m.group("spec") != only:
            continue
        if m.group("id") not in own.get(m.group("spec"), set()):
            findings.append(Finding("error", where, f"{req} does not exist in this repository's specs (0020 FR-011)"))
        if req in seen:
            findings.append(Finding("error", where, f"{req} has more than one row (0020 FR-011)"))
        seen.add(req)
        problem = row_problem(own, every, public, req, mech, by, own_repo, command_problem)
        if problem:
            findings.append(Finding("error", where, problem))
        if mech not in MECHANISMS:
            continue
        counts[mech] += 1
        if mech == "none" and not problem:
            nones.append((req, cols[3].strip() if len(cols) > 3 else ""))
    for spec, ids in sorted(own.items()):
        if only and spec != only:
            continue
        for ident in sorted(i for i in ids if i.startswith("FR")):
            if f"{spec} {ident}" not in seen:
                findings.append(Finding("error", rel, f"{spec} {ident} has no row (0020 FR-011)"))
    return findings, nones, counts


def register_rows(root: Path) -> dict[str, dict[str, str]]:
    """requirement -> {mechanism, by, note}."""
    path = root / REGISTER
    out: dict[str, dict[str, str]] = {}
    if path.is_file():
        for _, c in rows(path):
            if len(c) >= 3:
                out[c[0].strip()] = {"mechanism": c[1].strip(), "by": c[2].strip(), "note": c[3].strip() if len(c) > 3 else ""}
    return out


def control_rows(root: Path) -> list[dict[str, str]]:
    path = root / CONTROL_MAP
    out = []
    if path.is_file():
        for _, c in rows(path):
            if len(c) >= 2:
                out.append({"requirement": c[0].strip(), "control": c[1].strip(), "note": c[2].strip() if len(c) > 2 else ""})
    return out


def set_row(text: str, req: str, mech: str, by: str, note: str) -> str:
    """The register's text with `req`'s row replaced, or added after the last row of its spec (or at the end)."""
    new = "\t".join([req, mech, by] + ([note] if note else []))
    lines = text.split("\n")
    spec = req.rsplit(" ", 1)[0]
    last = None
    for i, l in enumerate(lines):
        if l.startswith(req + "\t"):
            lines[i] = new
            return "\n".join(lines)
        if l.startswith(spec + " FR-"):
            last = i
    if last is None:
        end = len(lines) - 1 if lines and lines[-1] == "" else len(lines)
        lines.insert(end, new)
    else:
        lines.insert(last + 1, new)
    return "\n".join(lines)


def add_control_row(text: str, req: str, control: str, note: str) -> str:
    new = "\t".join([req, control] + ([note] if note else []))
    if not text.endswith("\n"):
        text += "\n"
    return text + new + "\n"
