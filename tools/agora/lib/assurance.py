"""Running each design system's assurance harness (0014-design-systems FR-015, FR-017, FR-039; 0042-agora FR-017).

A design system carries its harness inside its own directory and it runs on its own: `assurance/run.mjs` in a
browser (Node, Playwright and Chromium) and `assurance/run.py` in Python. Node is the one the locked
`nodejs-wheel-binaries` carries (lib/node.py), never the host's. This module finds the harnesses, works out
which run, under which brand and with which programs, runs each as a subprocess of its documented command line and
streams what it prints. It reads nothing from a harness but whether its source accepts `--brand`.

  - every browser harness of a design system a brand themes runs once under every brand here (FR-039), or under the
    one brand asked for; a brand's own browser harness runs once;
  - every Python harness runs once, its own brand loop inside it;
  - a design system with neither fails (FR-015).

Standard library only. The harness's interpreter is this one, which `agora` runs under the group's locked packages.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from agora.core.resource import MISSING, AgoraError
from agora.lib import node

Emit = Callable[[str], None]
KEEP = 60  # lines of a harness's output kept for a failure's finding
LEAK = ("PYTHONPATH", "AGORA_PLAN_GROUP", "AGORA_TESTING")  # agora's own, kept out of a harness that runs on its own


@dataclass
class Harness:
    slug: str
    kind: str  # "browser" or "python"
    script: str  # relative to the root
    argv: list[str]
    brand: str | None = None  # the brand a themed browser harness runs under
    toolchain: list[str] = field(default_factory=list)  # entries it needs: fetched on first use; what cannot be had skips it

    @property
    def label(self) -> str:
        return f"{self.slug}, themed by {self.brand}" if self.brand else f"{self.slug} ({self.kind})"


@dataclass
class Outcome:
    harness: Harness
    status: str  # passed, failed, skipped
    seconds: float = 0.0
    code: int | None = None
    tail: list[str] = field(default_factory=list)
    reason: str = ""

    def to_dict(self) -> dict[str, Any]:
        h = self.harness
        d: dict[str, Any] = {"design_system": h.slug, "runner": h.kind, "brand": h.brand, "script": h.script,
                             "status": self.status, "seconds": round(self.seconds, 1)}
        if self.code is not None:
            d["exit"] = self.code
        if self.reason:
            d["reason"] = self.reason
        if self.status == "failed":
            d["tail"] = self.tail
        return d


def design_systems(root: Path) -> list[str]:
    d = root / "design-systems"
    return sorted(p.name for p in d.iterdir() if p.is_dir()) if d.is_dir() else []


def brands(root: Path) -> list[str]:
    """A brand is a design system with a brand.css (0014 FR-028, FR-038)."""
    return [s for s in design_systems(root) if (root / "design-systems" / s / "brand.css").is_file()]


def accepts_brand(script: Path) -> bool:
    """Whether a Python harness takes `--brand`: it says so in its own source."""
    try:
        return '"--brand"' in script.read_text(encoding="utf-8")
    except OSError:
        return False


def _needs(manifest: dict[str, Any], slug: str, kind: str) -> list[str]:
    """The toolchain entries a harness needs: its kind's, and its own (the manifest's `runners` and `harnesses`)."""
    runner = manifest.get("runners", {}).get(kind, {})
    own = manifest.get("harnesses", {}).get(f"{slug}:{kind}", {})
    return list(dict.fromkeys([*runner.get("toolchain", []), *own.get("toolchain", [])]))


def plan(root: Path, manifest: dict[str, Any], scope: str | None = None, brand: str | None = None,
         runner: str | None = None) -> tuple[list[Harness], list[str]]:
    """The harnesses to run, and the design systems that have none (a finding each)."""
    known = brands(root)
    out: list[Harness] = []
    missing: list[str] = []
    for slug in [scope] if scope else design_systems(root):
        base = root / "design-systems" / slug / "assurance"
        py, mjs = base / "run.py", base / "run.mjs"
        if not py.is_file() and not mjs.is_file():
            missing.append(slug)
            continue
        if py.is_file() and runner in (None, "python"):
            argv = [sys.executable, str(py.relative_to(root))]
            if brand and accepts_brand(py):
                argv += ["--brand", brand]
            out.append(Harness(slug, "python", str(py.relative_to(root)), argv, None, _needs(manifest, slug, "python")))
        if mjs.is_file() and runner in (None, "browser"):
            need = _needs(manifest, slug, "browser")
            rel = str(mjs.relative_to(root))
            if slug in known:
                out.append(Harness(slug, "browser", rel, ["node", rel], None, need))
            else:
                for b in [brand] if brand else known:
                    out.append(Harness(slug, "browser", rel, ["node", rel, "--brand", b], b, need))
    return out, missing


def harness_env(env: dict[str, str], extra: dict[str, str] | None = None) -> dict[str, str]:
    """What a harness runs under: the process's environment without agora's own variables, and with the locked node
    first on PATH, so a harness that starts `node` finds it."""
    out = {k: v for k, v in env.items() if k not in LEAK}
    out.update(extra or {})
    return out


def _node_problem(env: dict[str, str]) -> str:
    """Why no node can run, or an empty string."""
    if node.node_path(env):
        return ""
    return "needs node, an entry of the toolchain that ws-host installs: `ws-host toolchain ensure node --provider agora`"


def _argv(h: Harness, env: dict[str, str]) -> list[str]:
    """The harness's command line, with `node` replaced by the node it runs on."""
    return [node.node_path(env) or "node", *h.argv[1:]] if h.argv[0] == "node" else h.argv


def run_one(tc: Any, h: Harness, root: Path, env: dict[str, str], emit: Emit) -> Outcome:
    """Run one harness, streaming its output through `emit`. The toolchain entries it needs are obtained first (fetched on
    first use unless offline); what cannot be had skips it, naming the entry and the command that fixes it, which makes the
    run exit 3 (0041 FR-004, FR-006; 0025-tooling-environment FR-017, FR-018, FR-021)."""
    emit(f"── {h.label}")
    resolved = None
    problem = ""
    if h.toolchain:
        try:
            resolved = tc.use(h.toolchain)
        except AgoraError as e:
            problem = e.message
    no_node = _node_problem(env) if h.argv[0] == "node" else ""
    if problem or no_node:
        reason = "; ".join(x for x in (problem, no_node) if x)
        emit(f"⏭️  {h.label}: skipped, {reason}")
        return Outcome(h, "skipped", reason=reason)
    run_env = harness_env(resolved.env() if resolved else tc.clean_env())
    start = time.monotonic()
    tail: deque[str] = deque(maxlen=KEEP)
    try:
        proc = subprocess.Popen(_argv(h, env), cwd=root, env=run_env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, errors="replace")
    except OSError as e:
        emit(f"❎ {h.label}: could not start: {e}")
        return Outcome(h, "failed", time.monotonic() - start, None, [f"could not start {h.argv[0]}: {e}"])
    assert proc.stdout is not None
    for line in proc.stdout:
        line = line.rstrip("\n")
        tail.append(line)
        emit(line)
    code = proc.wait()
    if code == MISSING:
        return _skipped_by_harness(h, start, code, tail)
    return Outcome(h, "passed" if code == 0 else "failed", time.monotonic() - start, code, list(tail))


def _skipped_by_harness(h: Harness, start: float, code: int, tail: Any) -> Outcome:
    """A harness's own word for a program the host lacks is exit 3, with a `skipped ...` line saying which (0041 FR-006)."""
    reason = "; ".join(l.strip().removeprefix("skipped ") for l in tail if l.strip().startswith("skipped ")) or "needs a program the host lacks"
    return Outcome(h, "skipped", time.monotonic() - start, code, list(tail), reason=reason)


def summarize(outcomes: list[Outcome]) -> list[str]:
    notes = []
    for o in outcomes:
        if o.status == "passed":
            notes.append(f"✅ {o.harness.label}  ({o.seconds:.1f}s)")
        elif o.status == "skipped":
            notes.append(f"⏭️  {o.harness.label}: skipped, {o.reason}")
        else:
            notes.append(f"❎ {o.harness.label}: exit {o.code}  ({o.seconds:.1f}s)")
    return notes


def failure_message(o: Outcome) -> str:
    if o.code is None:
        return f"{o.harness.label}: {o.tail[0] if o.tail else 'did not run'}"
    last = " | ".join(l.strip() for l in [l for l in o.tail if l.strip()][-3:])
    return f"{o.harness.label} failed (exit {o.code}): {last}"[:600]


# Open edX ---------------------------------------------------------------------------------------------------------
def openedx_brands(root: Path) -> list[str]:
    """The brands that carry an Open edX package (an openedx/ directory)."""
    return [b for b in brands(root) if (root / "design-systems" / b / "openedx").is_dir()]


def run_openedx(brand: str, root: Path, env: dict[str, str], paragon: Path | None, emit: Emit) -> Outcome:
    """The brand's own Open edX harness, assurance/run.py, with PARAGON set when Paragon's CLI is available. `env` is what
    the harness runs under: the toolchain's environment, with the locked node first on PATH."""
    script = root / "design-systems" / brand / "assurance" / "run.py"
    h = Harness(brand, "openedx", str(script.relative_to(root)), [sys.executable, str(script.relative_to(root))])
    extra = {"PARAGON": str(paragon)} if paragon else {}
    no_node = _node_problem(env) if paragon else ""
    emit(f"── {brand}'s Open edX package" + (f", rebuilt with {paragon}" if paragon else ""))
    if no_node:
        emit(f"⏭️  {brand}'s Open edX package: skipped, {no_node}")
        return Outcome(h, "skipped", reason=no_node)
    start = time.monotonic()
    tail: deque[str] = deque(maxlen=KEEP)
    proc = subprocess.Popen(h.argv, cwd=root, env=harness_env(env, extra), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, errors="replace")
    assert proc.stdout is not None
    for line in proc.stdout:
        tail.append(line.rstrip("\n"))
        emit(line.rstrip("\n"))
    code = proc.wait()
    if code == MISSING:
        return _skipped_by_harness(h, start, code, tail)
    return Outcome(h, "passed" if code == 0 else "failed", time.monotonic() - start, code, list(tail))


def paragon_path(option: str | None) -> Path | None:
    """Paragon's CLI the person named with --paragon, a program of their own (the locked one is the default)."""
    return Path(option).expanduser().resolve() if option else None
