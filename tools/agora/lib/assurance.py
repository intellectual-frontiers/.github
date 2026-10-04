"""Running each design system's assurance harness (0014-design-systems FR-015, FR-017, FR-039; 0042-agora FR-017).

A design system carries its harness inside its own directory and it runs on its own: `assurance/run.mjs` in a
browser (Node, Playwright and Chromium) and `assurance/run.py` in Python. This module finds the harnesses, works out
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

from agora.core.checks import find_program

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
    programs: list[str] = field(default_factory=list)  # needed: its absence skips the harness
    optional: list[str] = field(default_factory=list)  # the harness checks without them and says so

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


def _needs(manifest: dict[str, Any], slug: str, kind: str) -> tuple[list[str], list[str]]:
    runner = manifest.get("runners", {}).get(kind, {})
    own = manifest.get("harnesses", {}).get(f"{slug}:{kind}", {})
    return (list(dict.fromkeys([*runner.get("programs", []), *own.get("programs", [])])), list(own.get("optional", [])))


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
            need, opt = _needs(manifest, slug, "python")
            argv = [sys.executable, str(py.relative_to(root))]
            if brand and accepts_brand(py):
                argv += ["--brand", brand]
            out.append(Harness(slug, "python", str(py.relative_to(root)), argv, None, need, opt))
        if mjs.is_file() and runner in (None, "browser"):
            need, opt = _needs(manifest, slug, "browser")
            rel = str(mjs.relative_to(root))
            if slug in known:
                out.append(Harness(slug, "browser", rel, ["node", rel], None, need, opt))
            else:
                for b in [brand] if brand else known:
                    out.append(Harness(slug, "browser", rel, ["node", rel, "--brand", b], b, need, opt))
    return out, missing


def harness_env(env: dict[str, str], extra: dict[str, str] | None = None) -> dict[str, str]:
    out = {k: v for k, v in env.items() if k not in LEAK}
    out.update(extra or {})
    return out


def run_one(registry: Any, h: Harness, root: Path, env: dict[str, str], emit: Emit) -> Outcome:
    """Run one harness, streaming its output through `emit`; a program it needs and the host lacks skips it (0041 FR-006)."""
    gone = [p for p in h.programs if find_program(registry, p, env) is None]
    emit(f"── {h.label}")
    if gone:
        hints = "; ".join(f"{p}: {registry.program(p).get('hint', 'install it from the host')}" for p in gone)
        reason = f"needs {', '.join(gone)}, not on PATH ({hints})"
        emit(f"⏭️  {h.label}: skipped, {reason}")
        return Outcome(h, "skipped", reason=reason)
    for p in h.optional:
        if find_program(registry, p, env) is None:
            emit(f"   · {p} is not installed; {h.slug}'s harness checks without it and says what it did not exercise")
    start = time.monotonic()
    tail: deque[str] = deque(maxlen=KEEP)
    try:
        proc = subprocess.Popen(h.argv, cwd=root, env=harness_env(env), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
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
    return Outcome(h, "passed" if code == 0 else "failed", time.monotonic() - start, code, list(tail))


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


def run_openedx(registry: Any, brand: str, root: Path, env: dict[str, str], paragon: Path | None, emit: Emit) -> Outcome:
    """The brand's own Open edX harness, assurance/run.py, with PARAGON set when Paragon's CLI is given."""
    script = root / "design-systems" / brand / "assurance" / "run.py"
    h = Harness(brand, "openedx", str(script.relative_to(root)), [sys.executable, str(script.relative_to(root))])
    extra = {"PARAGON": str(paragon)} if paragon else {}
    gone = [p for p in ("node",) if paragon and find_program(registry, p, env) is None]
    emit(f"── {brand}'s Open edX package" + (f", rebuilt with {paragon}" if paragon else ""))
    if gone:
        hint = registry.program("node").get("hint", "install it from the host")
        reason = f"needs node, not on PATH ({hint})"
        emit(f"⏭️  {brand}'s Open edX package: skipped, {reason}")
        return Outcome(h, "skipped", reason=reason)
    start = time.monotonic()
    tail: deque[str] = deque(maxlen=KEEP)
    proc = subprocess.Popen(h.argv, cwd=root, env=harness_env(env, extra), stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            text=True, errors="replace")
    assert proc.stdout is not None
    for line in proc.stdout:
        tail.append(line.rstrip("\n"))
        emit(line.rstrip("\n"))
    code = proc.wait()
    return Outcome(h, "passed" if code == 0 else "failed", time.monotonic() - start, code, list(tail))


def paragon_path(option: str | None, env: dict[str, str]) -> Path | None:
    value = option or env.get("PARAGON")
    return Path(value).expanduser().resolve() if value else None
