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
ALLOWED_STEP = re.compile(r"ws-host\s+system\s+ensure\b")  # the documented one-time setup, the only place `sudo` is allowed
HOST_PROGRAMS = tuple("""git convert identify magick pdftotext pdfinfo pdffonts pdfimages pdftoppm rsvg-convert potrace latexmk
                         xelatex lualatex pdflatex node npm npx chromium chrome java asciidoctor""".split())
HOST_CALL = re.compile(r"subprocess\.\w+\(\s*\[\s*[\"'](" + "|".join(re.escape(p) for p in HOST_PROGRAMS) + r")[\"']")
WHICH_CALL = re.compile(r"shutil\.which\(\s*[\"']([\w.-]+)[\"']")
# uv and python3 come from the provider's environment, and ws-host is the prerequisite that supplies it (0025 FR-014).
WHICH_ALLOWED = ("uv", "python3", "ws-host", "node")
# Where a download may be made: nowhere in agora; `ws-host` fetches and verifies what a provider pins (0025 FR-004, FR-017).
NETWORK_IMPORT = re.compile(r"^\s*(?:import|from)\s+(?:urllib\.request|http\.client|requests|httpx|ftplib|socket)\b")
NETWORK_ALLOWED: tuple[str, ...] = ()
INSTALLERS = "apt-get apt dpkg brew yum dnf pip pip3 pipx npm npx gem cargo".split()
INSTALL_CALL = re.compile(r"subprocess\.\w+\(\s*\[\s*[\"'](" + "|".join(INSTALLERS) + r")[\"']")
SELF = "tools/agora/lib/toolchain_rules.py"


def entry_findings(declared: dict[str, dict[str, Any]], registry: Any) -> list[Finding]:
    """That every toolchain a command, section, generator, runner or harness names is an entry (or a group of entries), and that every entry's
    `needs` names an entry. The fields of an entry are `ws-host`'s to check (`generated_findings`)."""
    out: list[Finding] = []
    names = set(declared) | set(tcore.GROUPS)

    def named(where: str, wanted: Any) -> None:
        for n in wanted:
            if n not in names:
                out.append(Finding("error", where, f"names toolchain entry {n!r}, which is not declared in .workspaces-host/toolchain.d "
                                   "(0041-command-line FR-066)"))

    for n, e in declared.items():
        for need in e.get("needs", []):
            if need not in declared:
                out.append(Finding("error", f".workspaces-host/toolchain.d/{n}.toml", f"needs {need!r}, which is not an entry"))
    for c in registry.commands.values():
        named(f"command {c.id}", c.toolchain + c.toolchain_optional)
    for s in registry.sections.values():
        named(f"section {s.name}", s.toolchain + s.toolchain_optional)
    for g in registry.generators.values():
        named(f"generator {g.name}", g.toolchain)
    for group in registry.groups.values():
        for kind in ("runners", "harnesses"):
            for key, spec in group.manifest.get(kind, {}).items():
                named(f"group {group.name}'s {kind} {key}", spec.get("toolchain", []))
    return out


def generated_findings(home: Path, env: Any = None) -> list[Finding]:
    """What `ws-host` finds wrong with the declarations, and the generated mise files that are not what the entries say now (0008-providers FR-005, FR-006)."""
    doc = tcore.ask(["toolchain", "generate", "--root", str(home), "--dry-run"], env)
    data = doc.get("data", {})
    if doc.get("_exit", 0) != 0:
        return [Finding("error", ".workspaces-host", data.get("plain") or data.get("message") or "ws-host could not read the declarations")]
    return [Finding("error", f, "is not what the entries say now; run `ws-host toolchain generate agora` and commit it") for f in data.get("stale", [])]


def lock_findings(home: Path, registry: Any) -> list[Finding]:
    """The hashed locks: each group's `agora.lock` carries a hash for every file of every package (0025 FR-013), and Chromium is the build of the Playwright
    that is pinned (0025 FR-009)."""
    from agora.core import plan

    out = [Finding("error", f"tools/agora/groups/{g.name}", p) for g in registry.groups.values() for p in plan.lock_problems(g)]
    declared = tcore.declared(home)
    chrome, play = declared.get("chromium", {}).get("version"), declared.get("playwright", {}).get("version")
    if chrome and play and chrome != play:
        out.append(Finding("error", ".workspaces-host/toolchain.d/chromium.toml",
                           f"Chromium is Playwright {chrome}'s build and the pinned Playwright is {play}; they move together (0025 FR-009)"))
    return out


def workflow_findings(home: Path) -> list[Finding]:
    """No workflow installs a program with a package manager, fetches one outside the launcher or runs in an image (FR-022);
    `./agora system ensure` is the one documented step that may use `sudo`, and may only be run through the launcher."""
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
    return out
