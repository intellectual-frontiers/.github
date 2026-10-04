"""What `check toolchain` reads (0041-command-line FR-068; 0025-tooling-environment FR-014, FR-016, FR-020, FR-022, FR-025;
0042-agora FR-013): the toolchain lock is complete, https, pinned and hashed; no workflow installs a program or runs in an
image; nothing requires a host program or a workspace. Standard library only.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from agora.core import toolchain as tcore
from agora.core.checks import Finding

# A workflow step that installs, fetches or containerizes something outside the launcher (0025 FR-011, FR-022).
FORBIDDEN_STEP = re.compile(
    r"(?<![\w/.-])(?:apt-get|apt|aptitude|dpkg|brew|yum|dnf|pacman|apk|snap|choco|winget|pip3?|pipx|npm|npx|yarn|pnpm|corepack|"
    r"gem|bundle|cargo|go\s+install|curl|wget|docker|podman|sudo)(?![\w/.-])"
    r"|uses:\s*actions/setup-(?:node|java|ruby|go|dotnet)|uses:\s*docker://|^\s*(?:-\s*)?(?:container|services|image):")
ALLOWED_STEP = re.compile(r"\./agora\s+system\s+add\b")  # the documented one-time setup, the only place `sudo` is allowed
HOST_PROGRAMS = tuple("""git convert identify magick pdftotext pdfinfo pdffonts pdfimages pdftoppm rsvg-convert potrace latexmk
                         xelatex lualatex pdflatex node npm npx chromium chrome java asciidoctor""".split())
HOST_CALL = re.compile(r"subprocess\.\w+\(\s*\[\s*[\"'](" + "|".join(re.escape(p) for p in HOST_PROGRAMS) + r")[\"']")
WHICH_CALL = re.compile(r"shutil\.which\(\s*[\"']([\w.-]+)[\"']")
WHICH_ALLOWED = ("uv", "python3")
# Where a download may be made: only the toolchain machinery, which verifies what it fetches (0025 FR-004, FR-017).
NETWORK_IMPORT = re.compile(r"^\s*(?:import|from)\s+(?:urllib\.request|http\.client|requests|httpx|ftplib|socket)\b")
NETWORK_ALLOWED = ("tools/agora/core/toolchain.py",)
INSTALLERS = "apt-get apt dpkg brew yum dnf pip pip3 pipx npm npx gem cargo".split()
INSTALL_CALL = re.compile(r"subprocess\.\w+\(\s*\[\s*[\"'](" + "|".join(INSTALLERS) + r")[\"']")
WORKSPACE_WORDS = re.compile(r"workspaces[-]host|ws[-]host\.env|reference environment", re.I)
SELF = "tools/agora/lib/toolchain_rules.py"


def entry_findings(entries: dict[str, tcore.Entry], registry: Any) -> list[Finding]:
    """Every entry's fields (FR-016, FR-020), and that every toolchain a command, section, generator, runner or harness
    names is an entry."""
    out = [Finding("error", "tools/agora/toolchain", p) for p in tcore.problems(entries)]
    names = set(entries)

    def named(where: str, wanted: Any) -> None:
        for n in wanted:
            if n not in names:
                out.append(Finding("error", where, f"names toolchain entry {n!r}, which is not declared in tools/agora/toolchain "
                                   "(0041-command-line FR-066)"))

    for c in registry.commands.values():
        named(f"command {c.id}", c.toolchain)
    for s in registry.sections.values():
        named(f"section {s.name}", s.toolchain)
    for g in registry.generators.values():
        named(f"generator {g.name}", g.toolchain)
    for group in registry.groups.values():
        for kind in ("runners", "harnesses"):
            for key, spec in group.manifest.get(kind, {}).items():
                named(f"group {group.name}'s {kind} {key}", spec.get("toolchain", []))
    return out


def lock_findings(home: Path, registry: Any) -> list[Finding]:
    """The hashed locks: each group's `agora.lock` carries a hash for every file of every package (0025 FR-013, FR-015), and
    the npm lock agrees with the entries (FR-015)."""
    from agora import toolchain as declared  # noqa: F401  (the package: its entries are what the npm lock must agree with)
    from agora.core import plan
    from agora.toolchain import chromium, npm_packages, vsce

    out = [Finding("error", f"tools/agora/groups/{g.name}", p) for g in registry.groups.values() for p in plan.lock_problems(g)]
    out += [Finding("error", "tools/agora/npm", p) for p in npm_packages.lock_problems()]
    out += [Finding("error", "tools/if-console", p) for p in vsce.lock_problems()]
    if chromium.PLAYWRIGHT_VERSION != npm_packages.PLAYWRIGHT_VERSION:
        out.append(Finding("error", "tools/agora/toolchain/chromium.py",
                           f"Chromium is Playwright {chromium.PLAYWRIGHT_VERSION}'s build and the npm lock's Playwright is "
                           f"{npm_packages.PLAYWRIGHT_VERSION}; they move together (0025 FR-009)"))
    return out


def workflow_findings(home: Path) -> list[Finding]:
    """No workflow installs a program with a package manager, fetches one outside the launcher or runs in an image (FR-022);
    `./agora system add` is the one documented step that may use `sudo`, and may only be run through the launcher."""
    out: list[Finding] = []
    d = home / ".github" / "workflows"
    for f in sorted(d.glob("*.y*ml")) if d.is_dir() else []:
        rel = f.relative_to(home).as_posix()
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            text = line.split("#", 1)[0] if not line.lstrip().startswith("uses:") else line
            if not text.strip() or ALLOWED_STEP.search(text):
                continue
            m = FORBIDDEN_STEP.search(text)
            if m:
                out.append(Finding("error", f"{rel}:{n}", f"`{m.group(0).strip()}` installs, fetches or containerizes something "
                                   "outside the launcher; a job runs `./agora`, which fetches what it needs (0025 FR-022)"))
    return out


def code_findings(home: Path) -> list[Finding]:
    """No command names a host program as something it needs or looks one up on PATH (0025 FR-002, FR-014), and no code,
    message or hint names a reference environment as a requirement (FR-012, FR-025)."""
    out: list[Finding] = []
    for path in sorted((home / "tools" / "agora").rglob("*.py")):
        rel = path.relative_to(home).as_posix()
        if "/tests/" in rel or "__pycache__" in rel or rel == SELF:
            continue
        text = path.read_text(encoding="utf-8")
        for n, line in enumerate(text.splitlines(), 1):
            for m in HOST_CALL.finditer(line):
                out.append(Finding("error", f"{rel}:{n}", f"runs the host's {m.group(1)}; a program comes from a package or a "
                                   "toolchain entry (0041-command-line FR-006)"))
            if NETWORK_IMPORT.match(line) and rel not in NETWORK_ALLOWED:
                out.append(Finding("error", f"{rel}:{n}", "reaches the network; only the toolchain machinery downloads, and it "
                                   "verifies what it fetches (0025 FR-004, FR-017)"))
            for m in INSTALL_CALL.finditer(line):
                out.append(Finding("error", f"{rel}:{n}", f"calls {m.group(1)}, a package manager; a program comes from a package "
                                   "or a toolchain entry (0025 FR-007)"))
            for m in WHICH_CALL.finditer(line):
                if m.group(1) not in WHICH_ALLOWED:
                    out.append(Finding("error", f"{rel}:{n}", f"looks for {m.group(1)} on PATH; only python3 and uv come "
                                       "from the host (0025 FR-014)"))
            if WORKSPACE_WORDS.search(line):
                out.append(Finding("error", f"{rel}:{n}", "names a reference environment; no tool, message or hint may "
                                   "(0025-tooling-environment FR-012)"))
    return out
