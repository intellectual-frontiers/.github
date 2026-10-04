"""agora's own layout and boundaries (0042-agora FR-001 to FR-003, FR-007, FR-013, FR-014; 0041-command-line FR-045).

Constants here restate what 0042 declares, so that a manifest that drifts from the spec fails `check commands`.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from agora.core.checks import Finding
from .register import known_repositories

NAME = "agora"  # 0042 FR-002
DECISIONS = {"spec set", "ink record", "proposal advance"}  # 0042 FR-007
# 0042 FR-013: the check sections, and FR-014: the suites, as `sections` plus `planned`.
SECTIONS = {"specs", "register", "controls", "ontology", "environment", "commands", "ui", "design-systems", "imagery", "openedx",
            "figures", "voice", "slides", "email", "course", "media", "signage", "merchandise"}
SUITES = {"spec": {"specs", "register", "controls", "ontology", "environment", "commands", "ui"},
          "browser": {"design-systems --runner browser", "openedx"},
          "python": {"design-systems --runner python"},
          "images": {"imagery"}}


def check_layout(home: Path, registry) -> list[Finding]:
    f: list[Finding] = []
    launcher = home / NAME
    if not launcher.is_file():
        f.append(Finding("error", NAME, "the launcher is missing at the repository root (0042 FR-001)"))
    else:
        if not os.access(launcher, os.X_OK):
            f.append(Finding("error", NAME, "the launcher is not executable (0041 FR-001)"))
        if launcher.read_text(encoding="utf-8").splitlines()[:1] != ["#!/bin/sh"]:
            f.append(Finding("error", NAME, "the launcher must be POSIX sh: its first line is #!/bin/sh (0041 FR-001)"))
    if registry.name != NAME:
        f.append(Finding("error", "tools/agora/agora.toml", f"the command line's name is {registry.name!r}; it must be {NAME!r} (0042 FR-002)"))
    if registry.audience != "public":
        f.append(Finding("error", "tools/agora/agora.toml", f"the audience is {registry.audience!r}; it must be 'public' (0042 FR-001)"))
    for name, g in registry.groups.items():
        if not (g.path / "agora.toml").is_file():
            f.append(Finding("error", f"tools/agora/groups/{name}", "a group has an agora.toml (0042 FR-001)"))
        if g.lock.is_file() and not g.packages:
            f.append(Finding("error", str(g.lock.relative_to(home)), "a group holds a lock only where it pins packages (0041 FR-007)"))
    logs = registry.root_manifest.get("logs")
    gi = home / ".gitignore"
    if not logs or not gi.is_file() or f"{logs.rstrip('/')}/" not in gi.read_text(encoding="utf-8").split():
        f.append(Finding("error", ".gitignore", f"must list the log directory {logs or '(none named)'}/ (0042 FR-021)"))
    # FR-007: exactly the three decision commands; FR-013, FR-014: the sections and suites the spec declares.
    decisions = {c.id for c in registry.commands.values() if c.category == "decision"}
    if decisions != DECISIONS:
        f.append(Finding("error", "tools/agora", f"the decision commands are {sorted(decisions)}; 0042 FR-007 names {sorted(DECISIONS)}"))
    declared = set(registry.sections)
    if declared != SECTIONS:
        f.append(Finding("error", "tools/agora", f"the check sections differ from 0042 FR-013: missing {sorted(SECTIONS - declared)}, "
                         f"extra {sorted(declared - SECTIONS)}"))
    for suite, want in SUITES.items():
        s = registry.suites.get(suite)
        have = set(s["sections"]) | set(s["planned"]) if s else set()
        # a section with options is named with them in `planned`; compare by section name
        norm = lambda names: {n.split(" ")[0] for n in names}
        if norm(have) != norm(want):
            f.append(Finding("error", "tools/agora/agora.toml", f"suite {suite} is {sorted(have)}; 0042 FR-014 says {sorted(want)}"))
    extra = set(registry.suites) - set(SUITES)
    if extra:
        f.append(Finding("error", "tools/agora/agora.toml", f"suites {sorted(extra)} are not in 0042 FR-014"))
    return f


def check_boundaries(home: Path, own_repo: str | None) -> list[Finding]:
    """0042 FR-003, 0041 FR-045: no other repository's name as a literal in agora's launcher, code, manifests or specs. The
    names are data, from the workspace's register of repositories."""
    names = sorted(known_repositories(home) - {own_repo or ""})
    if not names:
        return []
    files = [home / NAME] + [p for p in sorted((home / "tools" / NAME).rglob("*")) if p.is_file()
                             and "__pycache__" not in p.parts and p.suffix in ("", ".py", ".toml", ".lock", ".md", ".js", ".css", ".html")]
    files += [home / "spec-kit" / "specs" / s / "spec.md" for s in ("0041-command-line", "0042-agora")]
    out: list[Finding] = []
    for f in files:
        if not f.is_file() or "tests" in f.relative_to(home).parts:
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            for name in names:
                if re.search(rf"(?<![\w./-]){re.escape(name)}(?![\w-])", line):
                    out.append(Finding("error", f"{f.relative_to(home)}:{n}", f"names another repository, {name} (0042 FR-003, 0041 FR-045)"))
    return out


def check_workflows(home: Path) -> list[Finding]:
    """0042 FR-022: every workflow calls agora, and no other tool of this repository's own (a path under tools/ but agora's)."""
    out: list[Finding] = []
    d = home / ".github" / "workflows"
    for f in sorted(d.glob("*.y*ml")) if d.is_dir() else []:
        text = f.read_text(encoding="utf-8")
        rel = str(f.relative_to(home))
        if not re.search(r"(?<![\w/-])\./agora(?![\w-])", text):
            out.append(Finding("error", rel, f"a workflow calls {NAME}, as ./{NAME} (0042 FR-022)"))
        for n, line in enumerate(text.splitlines(), 1):
            if line.lstrip().startswith("#"):
                continue
            for m in re.finditer(r"(?<![\w.-])tools/(?!agora(?:/|\b))[\w./-]+", line):
                out.append(Finding("error", f"{rel}:{n}", f"calls {m.group(0)}, a tool of this repository other than {NAME} (0042 FR-022)"))
    return out
