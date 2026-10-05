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
PREREQUISITES = {"workspaces-host"}  # the one repository agora may name: its program, `ws-host`, is the prerequisite (0042 FR-003; 0025 FR-005)
# 0042 FR-013: the check sections, and FR-014: the suites, as `sections`.
SECTIONS = {"specs", "register", "controls", "ontology", "toolchain", "commands", "help", "design-systems", "imagery", "openedx",
            "figures", "voice", "slides", "email", "course", "media", "signage", "merchandise"}
SUITES = {"spec": {"specs", "register", "controls", "ontology", "toolchain", "commands", "help"},
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
    decl = home / ".workspaces-host" / "provider.toml"  # 0042 FR-032: the repository's own declaration of its launcher, for ws-host and the Workspaces Console
    try:
        import tomllib

        spec = tomllib.loads(decl.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        spec = {}
    if spec.get("name") != NAME or spec.get("launcher") != f"./{NAME}" or spec.get("protocol") != 1:
        f.append(Finding("error", ".workspaces-host/provider.toml", f"must declare name = \"{NAME}\", launcher = \"./{NAME}\" and protocol = 1 (0042 FR-032)"))
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
        have = set(s["sections"]) if s else set()
        # a section with options is named with them; compare by section name
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
    names = sorted(known_repositories(home) - {own_repo or ""} - PREREQUISITES)
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
            if line.lstrip().startswith("#") or "paths:" in line or "hashFiles(" in line:  # a trigger or a cache key names files; it calls nothing
                continue
            for m in re.finditer(r"(?<![\w.-])tools/(?!agora(?:/|\b))[\w./-]+", line):
                out.append(Finding("error", f"{rel}:{n}", f"calls {m.group(0)}, a tool of this repository other than {NAME} (0042 FR-022)"))
    return out


SCRIPT_SUFFIXES = (".py", ".sh", ".bash", ".js", ".mjs", ".cjs", ".ts")
SKIP_DIRS = (".git", "node_modules", "__pycache__", ".agora", ".venv")


def check_scripts(home: Path) -> list[Finding]:
    """0042 FR-016: no script of this repository's own outside a design system's directory, tools/agora/ and the IF Console's own
    directory (0043 FR-002; SC-003)."""
    out: list[Finding] = []
    for dirpath, dirs, names in os.walk(home):
        here = Path(dirpath).relative_to(home)
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and (here / d).parts not in (("design-systems",), ("tools", NAME), ("tools", "if-console")))
        for n in sorted(names):
            if n.endswith(SCRIPT_SUFFIXES):
                out.append(Finding("error", str(here / n), f"a script outside design-systems/, tools/{NAME}/ and tools/if-console/: delete it once {NAME} "
                                   "provides its function, and rewrite every reference to it (0042 FR-016)"))
    return out


def repository_files(home: Path) -> list[str]:
    out: list[str] = []
    for dirpath, dirs, names in os.walk(home):
        here = Path(dirpath).relative_to(home)
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        out += [(here / n).as_posix() for n in sorted(names)]
    return out


def check_watched(registry) -> list[Finding]:
    """0041 FR-032, 0042 FR-013: every section and every generator declares watched paths, so that `check --changed` and
    `fresh --changed` run what a change can affect. (That each pattern matches a file is a test of this repository.)"""
    out: list[Finding] = []
    declared = [(f"section {s.name}", s.watch, "tools/agora/groups/%s/agora.toml" % s.group) for s in registry.sections.values()]
    declared += [(f"generator {g.name}", g.watch, "tools/agora/groups/%s/agora.toml" % g.group) for g in registry.generators.values()]
    for what, watch, where in declared:
        if not watch:
            out.append(Finding("error", where, f"{what} declares no watched paths, so --changed would always run it (0041 FR-032)"))
    return out


GUIDE_URL = "https://intellectual-frontiers.github.io/.github/"  # 0042 FR-035
README_MAX_LINES = 120  # 0042 FR-036


def check_readme(home: Path, registry) -> list[Finding]:
    """0042 FR-036: the README is the short way in: it links to the guide, names the one-time `system ensure` and `help`, and stays short."""
    readme = home / "README.md"
    if not readme.is_file():
        return [Finding("error", "README.md", "is missing (0042 FR-036)")]
    text = readme.read_text(encoding="utf-8")
    out = []
    if GUIDE_URL not in text:
        out.append(Finding("error", "README.md", f"does not link to the guide, {GUIDE_URL} (0042 FR-036)"))
    for needle, why in (("agora system ensure", "the one-time system ensure"), ("agora help", "the help command")):
        if needle not in text:
            out.append(Finding("error", "README.md", f"does not name {why}, `{needle}` (0042 FR-036)"))
    n = len(text.splitlines())
    if n > README_MAX_LINES:
        out.append(Finding("error", "README.md", f"is {n} lines; the README is short and the rest belongs in the guide, at most {README_MAX_LINES} (0042 FR-036)"))
    return out


def check_guide_files(home: Path) -> list[Finding]:
    """0042 FR-035: docs/index.html is the one hand-written page and uses only the brand's own assets, which `docs build` copies beside
    it; pages.yml builds the guide with the launcher."""
    out: list[Finding] = []
    from . import guide

    index = home / "docs" / "index.html"
    extra = sorted(p.name for p in (home / "docs").iterdir()) if (home / "docs").is_dir() else []
    if extra != ["index.html"]:
        out.append(Finding("error", "docs", f"holds {extra}; docs/index.html is the one hand-written page and nothing else lives there (0042 FR-035)"))
    if index.is_file():
        for n, line in enumerate(index.read_text(encoding="utf-8").splitlines(), 1):
            for ref in re.findall(r"""(?:src|srcset|href)=["']assets/([^\s"']+)""", line):
                if ref not in guide.ASSETS:
                    out.append(Finding("error", f"docs/index.html:{n}", f"uses assets/{ref}, which is not one of the brand's assets `docs build` copies (0042 FR-035)"))
    for name, src in guide.ASSETS.items():
        if not (home / src).is_file():
            out.append(Finding("error", "tools/agora/lib/guide.py", f"the guide's asset {name} comes from {src}, which does not exist (0042 FR-035)"))
    wf = home / ".github" / "workflows" / "pages.yml"
    if not wf.is_file():
        out.append(Finding("error", ".github/workflows/pages.yml", "is missing: the guide is published to GitHub Pages by this workflow (0042 FR-035)"))
    elif "./agora docs build" not in wf.read_text(encoding="utf-8"):
        out.append(Finding("error", ".github/workflows/pages.yml", "does not build the guide with `./agora docs build` (0042 FR-035)"))
    return out


def check_proposals(ctx) -> list[Finding]:
    """0042 FR-029: each proposal is well formed, and an open one still replays."""
    from . import proposals
    return [Finding("error", f"{ctx.registry.root_manifest.get('proposals', '.agora/proposals')}/{pid}.json", why)
            for pid in proposals.ids(ctx) for why in proposals.problems(ctx, pid)]


# 0042 FR-016: the scripts agora replaced. No file of this repository may refer to one, except the spec that names them.
REMOVED = ("tools/spec_check.py", "tools/run_assurance.sh", "tools/brand_decoration.py", "tools/brand_imagery.py", "tools/brand_openedx.py",
           "tools/brand_specimen.py", "tools/brand_theme.py", "spec_check.py", "run_assurance.sh")
TEXT_SUFFIXES = (".md", ".py", ".toml", ".yml", ".yaml", ".json", ".ttl", ".tsv", ".html", ".js", ".mjs", ".css", ".txt", ".tex", "")


def check_removed_scripts(home: Path) -> list[Finding]:
    out: list[Finding] = []
    for rel in repository_files(home):
        if rel.startswith("tools/agora/tests/") or rel in ("spec-kit/specs/0042-agora/spec.md", "tools/agora/lib/layout.py") or not rel.endswith(TEXT_SUFFIXES):
            continue
        try:
            text = (home / rel).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for n, line in enumerate(text.splitlines(), 1):
            for name in REMOVED:
                if name in line:
                    out.append(Finding("error", f"{rel}:{n}", f"refers to {name}, which agora replaced: name the agora command instead (0042 FR-016)"))
                    break
    return out
